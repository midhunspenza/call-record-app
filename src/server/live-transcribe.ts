import { WebSocket } from "ws";

/**
 * Live (in-call) transcription via the OpenAI Realtime API.
 *
 * The inbound voice WS (/api/ws/voice/incoming) hands us raw PCM frames as the
 * call happens. We open a per-call WebSocket to OpenAI's realtime transcription
 * endpoint, stream the audio in, and surface text back through callbacks the
 * caller turns into voice.transcript.delta / voice.transcript.segment events.
 *
 * Protocol (GA /v1/realtime?intent=transcription — no OpenAI-Beta header):
 *   → session.update                 configure transcription session (model,
 *                                    VAD, audio.input.format = pcm 24 kHz)
 *   → input_audio_buffer.append      base64 PCM16 chunks (must be 24 kHz)
 *   ← conversation.item.input_audio_transcription.delta      incremental text
 *   ← conversation.item.input_audio_transcription.completed  finalized utterance
 *
 * Audio note: spenza-backend streams 8 kHz / 16-bit / mono PCM, but the
 * realtime API's `pcm16` format is fixed at 24 kHz. We upsample 8 kHz → 24 kHz
 * with linear interpolation before sending.
 */

const REALTIME_URL = "wss://api.openai.com/v1/realtime?intent=transcription";
const TARGET_SAMPLE_RATE = 24_000;
const DEFAULT_INPUT_SAMPLE_RATE = 8_000;
const MODEL = process.env.OPENAI_REALTIME_TRANSCRIBE_MODEL ?? "gpt-4o-mini-transcribe";

// Cap audio queued before the upstream socket is ready, so a stalled OpenAI
// connection can't grow memory without bound (~a few seconds of 24 kHz audio).
const PENDING_QUEUE_MAX = 400;

export type LiveTranscriberCallbacks = {
  /** Incremental text for the in-progress utterance identified by itemId. */
  onDelta: (e: { itemId: string; delta: string }) => void;
  /** A finalized utterance (server VAD detected end of speech). */
  onCompleted: (e: { itemId: string; transcript: string }) => void;
  onError?: (message: string) => void;
};

export type LiveTranscriber = {
  /** Feed a raw PCM frame (16-bit LE mono at the configured input rate). */
  pushAudio: (frame: Buffer) => void;
  /** Tear down the upstream session. */
  close: () => void;
};

/**
 * Open a live transcription session. Returns null (no-op) when transcription
 * isn't configured, so callers can stay oblivious — audio still fans out to the
 * browser, there's just no transcript.
 */
export function createLiveTranscriber(
  opts: { inputSampleRate?: number; language?: string } & LiveTranscriberCallbacks,
): LiveTranscriber | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  if (process.env.LIVE_TRANSCRIBE === "off") return null;

  const inputSampleRate = opts.inputSampleRate || DEFAULT_INPUT_SAMPLE_RATE;

  let ready = false;
  let closed = false;
  let carry = Buffer.alloc(0); // leftover odd byte spanning two frames
  const pending: string[] = []; // base64 chunks buffered until `ready`

  const ws = new WebSocket(REALTIME_URL, {
    headers: {
      Authorization: `Bearer ${key}`,
    },
  });

  const send = (msg: Record<string, unknown>) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  };

  const appendAudio = (b64: string) => send({ type: "input_audio_buffer.append", audio: b64 });

  ws.on("open", () => {
    send({
      type: "session.update",
      session: {
        type: "transcription",
        audio: {
          input: {
            format: { type: "audio/pcm", rate: TARGET_SAMPLE_RATE },
            transcription: {
              model: MODEL,
              ...(opts.language ? { language: opts.language } : {}),
            },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500,
            },
            noise_reduction: { type: "near_field" },
          },
        },
      },
    });
    // Appends are processed after the session update we just queued, so it's
    // safe to flush anything that arrived before the socket opened.
    ready = true;
    for (const b64 of pending) appendAudio(b64);
    pending.length = 0;
  });

  ws.on("message", (raw) => {
    let event: { type?: string; item_id?: string; delta?: string; transcript?: string; error?: { message?: string } };
    try {
      event = JSON.parse(raw.toString());
    } catch {
      return;
    }
    switch (event.type) {
      case "conversation.item.input_audio_transcription.delta":
        if (event.item_id && typeof event.delta === "string") {
          opts.onDelta({ itemId: event.item_id, delta: event.delta });
        }
        break;
      case "conversation.item.input_audio_transcription.completed":
        if (event.item_id && typeof event.transcript === "string") {
          opts.onCompleted({ itemId: event.item_id, transcript: event.transcript });
        }
        break;
      case "error":
        opts.onError?.(event.error?.message ?? "unknown realtime error");
        break;
    }
  });

  ws.on("error", (err) => {
    opts.onError?.(err.message);
  });

  ws.on("close", () => {
    ready = false;
    closed = true;
  });

  return {
    pushAudio(frame: Buffer) {
      if (closed) return;

      // Reassemble 16-bit samples across frame boundaries (carry the odd byte).
      let buf = carry.length ? Buffer.concat([carry, frame]) : frame;
      if (buf.length % 2 === 1) {
        carry = Buffer.from(buf.subarray(buf.length - 1));
        buf = buf.subarray(0, buf.length - 1);
      } else {
        carry = Buffer.alloc(0);
      }
      if (buf.length === 0) return;

      const samples = bufToInt16(buf);
      const upsampled = resampleTo24k(samples, inputSampleRate);
      const b64 = int16ToBuf(upsampled).toString("base64");

      if (ready) {
        appendAudio(b64);
      } else if (pending.length < PENDING_QUEUE_MAX) {
        pending.push(b64);
      }
    },
    close() {
      closed = true;
      pending.length = 0;
      try {
        if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) ws.close(1000, "call ended");
      } catch {
        // ignore
      }
    },
  };
}

function bufToInt16(buf: Buffer): Int16Array {
  const n = buf.length >> 1;
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) out[i] = buf.readInt16LE(i * 2);
  return out;
}

function int16ToBuf(samples: Int16Array): Buffer {
  const buf = Buffer.allocUnsafe(samples.length * 2);
  for (let i = 0; i < samples.length; i++) buf.writeInt16LE(samples[i], i * 2);
  return buf;
}

/**
 * Linear-interpolation upsample to 24 kHz. For the common 8 kHz → 24 kHz case
 * this is a clean 3× ratio; the generic path also handles 16 kHz etc.
 */
function resampleTo24k(samples: Int16Array, inputRate: number): Int16Array {
  if (inputRate === TARGET_SAMPLE_RATE || samples.length === 0) return samples;
  const ratio = TARGET_SAMPLE_RATE / inputRate;
  const outLen = Math.max(1, Math.floor(samples.length * ratio));
  const out = new Int16Array(outLen);
  const lastIdx = samples.length - 1;
  for (let i = 0; i < outLen; i++) {
    const srcPos = i / ratio;
    const i0 = Math.floor(srcPos);
    const i1 = Math.min(i0 + 1, lastIdx);
    const frac = srcPos - i0;
    out[i] = (samples[i0] + (samples[i1] - samples[i0]) * frac) | 0;
  }
  return out;
}
