import type { IncomingMessage, Server as HttpServer } from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { eventBus } from "./event-bus";
import { verifyBasicAuth } from "./basic-auth";
import { createLiveTranscriber, type LiveTranscriber } from "./live-transcribe";
import { persistLiveTranscript, type LiveSegment } from "./live-transcript-store";
import type { LiveEvent, WsMessage } from "@/lib/events";

/**
 * Attaches two WebSocket servers to the same HTTP server:
 *
 * 1) /api/stream            — outbound to the browser/UI. Sends JSON envelopes
 *                             (hello/event/ping/pong) AND raw binary voice frames
 *                             pushed in from (2). Heartbeat 30s.
 *
 * 2) /api/ws/voice/incoming — inbound from spenza-backend. Receives a JSON
 *                             handshake frame, then raw binary PCM (8 kHz / 16-bit / mono).
 *                             Gated by Basic Auth from WEBHOOK_BASIC_USER/PASS.
 *                             Each frame is broadcast to (1)'s listeners as
 *                             binary, so the browser can decode and play it.
 *
 * Backpressure: if a /api/stream client's send buffer is over 1 MB, drop the
 * message for that client instead of letting everyone get queued behind a slow
 * socket.
 */

const STREAM_PATH = "/api/stream";
const VOICE_IN_PATH = "/api/ws/voice/incoming";
const HEARTBEAT_MS = 30_000;
const SEND_BUFFER_HIGH_WATERMARK = 1_000_000;

type AliveSocket = WebSocket & { isAlive: boolean };

// In-memory fan-out for binary voice frames. The inbound voice WS pushes
// Buffers in; every /api/stream listener gets a copy (subject to backpressure).
type BinaryListener = (frame: Buffer) => void;
const binaryListeners = new Set<BinaryListener>();

function publishBinaryFrame(frame: Buffer) {
  for (const fn of binaryListeners) {
    try {
      fn(frame);
    } catch {
      // never let a slow listener kill the publisher
    }
  }
}

export function attachWebsocket(server: HttpServer) {
  const wssStream = new WebSocketServer({ noServer: true });
  const wssVoiceIn = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req: IncomingMessage, socket, head) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === STREAM_PATH) {
      wssStream.handleUpgrade(req, socket, head, (ws) => {
        wssStream.emit("connection", ws, req);
      });
      return;
    }
    if (url.pathname === VOICE_IN_PATH) {
      // Auth intentionally OFF (mirrors the SMS receivers): spenza-backend's
      // outbound delivery does not attach Authorization headers, so gating
      // here just guarantees every upgrade gets rejected. Restore the
      // verifyBasicAuth gate once that's fixed upstream.
      wssVoiceIn.handleUpgrade(req, socket, head, (ws) => {
        wssVoiceIn.emit("connection", ws, req);
      });
      return;
    }
    socket.destroy();
  });

  // ─────────────────────────────────────────────────────────────
  // (1) /api/stream — outbound to browser/UI
  // ─────────────────────────────────────────────────────────────
  wssStream.on("connection", (raw, req) => {
    const ws = raw as AliveSocket;
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    const safeSend = (msg: WsMessage) => {
      if (ws.readyState !== ws.OPEN) return;
      if (ws.bufferedAmount > SEND_BUFFER_HIGH_WATERMARK) return;
      ws.send(JSON.stringify(msg));
    };

    const safeSendBinary = (frame: Buffer) => {
      if (ws.readyState !== ws.OPEN) return;
      if (ws.bufferedAmount > SEND_BUFFER_HIGH_WATERMARK) return;
      ws.send(frame, { binary: true });
    };

    // Replay recent JSON buffer so a new client doesn't see a blank screen.
    const replay = eventBus.replay();
    safeSend({ kind: "hello", serverTime: new Date().toISOString(), replayCount: replay.length });
    for (const ev of replay) safeSend({ kind: "event", event: ev });

    // Live forward.
    const unsubEvents = eventBus.subscribe((event: LiveEvent) => safeSend({ kind: "event", event }));
    binaryListeners.add(safeSendBinary);

    ws.on("message", (raw) => {
      try {
        const parsed = JSON.parse(raw.toString());
        if (parsed?.kind === "ping") safeSend({ kind: "pong" });
      } catch {
        // ignore malformed client messages
      }
    });

    ws.on("close", () => {
      unsubEvents();
      binaryListeners.delete(safeSendBinary);
    });

    ws.on("error", (err) => {
      console.error("[ws/stream] socket error:", err.message);
      unsubEvents();
      binaryListeners.delete(safeSendBinary);
    });

    void req;
  });

  // ─────────────────────────────────────────────────────────────
  // (2) /api/ws/voice/incoming — inbound from spenza-backend
  // ─────────────────────────────────────────────────────────────
  wssVoiceIn.on("connection", (ws, req) => {
    let handshake: Record<string, unknown> | null = null;
    let frameCount = 0;
    let byteCount = 0;
    const startedAt = Date.now();
    const callTag = randomUUID();

    // Per-call live transcription. Created on the handshake (so we know the
    // call metadata + sample rate) or lazily on the first audio frame if the
    // handshake never arrives. Stays null when OPENAI_API_KEY is unset.
    let transcriber: LiveTranscriber | null = null;
    let transcriberStarted = false;

    // Accumulate finalized utterances so we can persist the whole live
    // transcript to S3 when the call ends (see ws.on("close")).
    const liveSegments: LiveSegment[] = [];

    // Carries call metadata onto each transcript event so the UI can attribute
    // and (optionally) filter by call.
    const callMeta = () => {
      const h = (handshake ?? {}) as Record<string, unknown>;
      return {
        callId: h.callId as string | undefined,
        from: h.from as string | undefined,
        to: h.to as string | undefined,
        direction: h.direction as string | undefined,
        tag: callTag,
      };
    };

    const startTranscriber = () => {
      if (transcriberStarted) return;
      transcriberStarted = true;
      const h = (handshake ?? {}) as Record<string, unknown>;
      const inputSampleRate = typeof h.sampleRate === "number" ? (h.sampleRate as number) : undefined;
      transcriber = createLiveTranscriber({
        inputSampleRate,
        onDelta: ({ itemId, delta }) => {
          eventBus.publish({
            id: randomUUID(),
            channel: "voice.transcript.delta",
            receivedAt: new Date().toISOString(),
            body: { ...callMeta(), itemId, delta },
          });
        },
        onCompleted: ({ itemId, transcript }) => {
          liveSegments.push({ itemId, text: transcript, at: new Date().toISOString() });
          eventBus.publish({
            id: randomUUID(),
            channel: "voice.transcript.segment",
            receivedAt: new Date().toISOString(),
            body: { ...callMeta(), itemId, text: transcript },
          });
        },
        onError: (message) => console.warn(`[ws/voice-in] live transcribe error tag=${callTag}: ${message}`),
      });
      if (transcriber) console.log(`[ws/voice-in] live transcription started tag=${callTag}`);
    };

    console.log(`[ws/voice-in] ▶ connected tag=${callTag} from=${req.socket.remoteAddress}`);

    ws.on("message", (data, isBinary) => {
      if (isBinary) {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
        frameCount += 1;
        byteCount += buf.length;
        publishBinaryFrame(buf);
        if (!transcriberStarted) startTranscriber();
        transcriber?.pushAudio(buf);
        return;
      }

      // First non-binary frame = JSON handshake from spenza-backend.
      try {
        const parsed = JSON.parse(data.toString());
        handshake = parsed as Record<string, unknown>;
        console.log(
          `[ws/voice-in] handshake tag=${callTag} call_id=${handshake.callId} direction=${handshake.direction} from=${handshake.from} to=${handshake.to}`,
        );
        const event: LiveEvent = {
          id: randomUUID(),
          channel: "voice.stream.handshake",
          receivedAt: new Date().toISOString(),
          body: handshake,
        };
        eventBus.publish(event);
        startTranscriber();
      } catch (e) {
        console.warn(`[ws/voice-in] non-JSON text frame on tag=${callTag}:`, (e as Error).message);
      }
    });

    ws.on("close", (code, reason) => {
      transcriber?.close();
      const endedAt = Date.now();
      const durationMs = endedAt - startedAt;
      console.log(
        `[ws/voice-in] ✖ closed tag=${callTag} code=${code} reason=${reason?.toString() || ""} frames=${frameCount} bytes=${byteCount} duration=${durationMs}ms`,
      );

      // Persist the accumulated live transcript to S3 alongside the call.
      // Fire-and-forget; never blocks teardown. The post-call Whisper pipeline
      // still produces the canonical {audioKey}.json separately.
      if (liveSegments.length) {
        const meta = callMeta();
        void persistLiveTranscript({ meta, segments: liveSegments, startedAt, endedAt })
          .then((key) => {
            console.log(
              `[ws/voice-in] ✔ live transcript saved tag=${callTag} callId=${meta.callId} key=${key} segments=${liveSegments.length}`,
            );
            eventBus.publish({
              id: randomUUID(),
              channel: "voice.transcript.ready",
              receivedAt: new Date().toISOString(),
              body: {
                source: "live",
                transcriptKey: key,
                callId: meta.callId,
                from: meta.from,
                to: meta.to,
                direction: meta.direction,
                tag: callTag,
                text: liveSegments.map((s) => s.text).join(" ").trim(),
                preview: liveSegments.map((s) => s.text).join(" ").trim().slice(0, 200),
              },
            });
          })
          .catch((err) =>
            console.error(`[ws/voice-in] ✖ live transcript save failed tag=${callTag}:`, (err as Error).message),
          );
      }

      const event: LiveEvent = {
        id: randomUUID(),
        channel: "voice.stream.handshake",
        receivedAt: new Date().toISOString(),
        body: {
          tag: callTag,
          closed: true,
          handshake,
          frames: frameCount,
          bytes: byteCount,
          durationMs,
        },
      };
      eventBus.publish(event);
    });

    ws.on("error", (err) => {
      transcriber?.close();
      console.error(`[ws/voice-in] socket error tag=${callTag}:`, err.message);
    });
  });

  const heartbeat = setInterval(() => {
    for (const client of wssStream.clients) {
      const ws = client as AliveSocket;
      if (!ws.isAlive) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, HEARTBEAT_MS);

  wssStream.on("close", () => clearInterval(heartbeat));

  // Graceful shutdown: close all client sockets on SIGTERM/SIGINT.
  const shutdown = () => {
    clearInterval(heartbeat);
    for (const client of wssStream.clients) client.close(1001, "server shutting down");
    for (const client of wssVoiceIn.clients) client.close(1001, "server shutting down");
    wssStream.close();
    wssVoiceIn.close();
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);

  return { wssStream, wssVoiceIn };
}
