import { z } from "zod";

/**
 * Event contract used by the receiving routes (Basic-Auth-gated webhooks
 * registered via POST /api/v1/webhooks/register), the in-memory bus, and
 * the React hook.
 *
 * The api-documentation only specifies the *registration* endpoints, not
 * the delivery payload shape, so `data` is intentionally typed as unknown
 * JSON — we relay whatever spenza-backend posts to us, untouched.
 */

export const LiveEvent = z.object({
  /** Stable id so duplicates from retries dedupe. */
  id: z.string().min(1),
  /** Which receiver got hit: SMS or voice-related event. */
  channel: z.enum([
    "sms.incoming",
    "sms.status",
    "voice.incoming",
    "voice.status",
    "voice.call.started",
    "voice.recording.ready",
    "voice.stream.handshake",
    "voice.transcript.ready",
    // Live (in-call) transcription streamed off the inbound voice WS:
    //   .delta   — incremental text for an in-progress utterance (item_id groups them)
    //   .segment — a finalized utterance once server VAD detects end of speech
    "voice.transcript.delta",
    "voice.transcript.segment",
  ]),
  /** When we received it (server-side wall clock). */
  receivedAt: z.string(),
  /** Raw body posted by spenza-backend to our registered webhookUrls.*Url. */
  body: z.unknown(),
});
export type LiveEvent = z.infer<typeof LiveEvent>;

/** WebSocket envelope. Frontend branches on `kind` cheaply. */
export const WsMessage = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("hello"), serverTime: z.string(), replayCount: z.number().int() }),
  z.object({ kind: z.literal("event"), event: LiveEvent }),
  z.object({ kind: z.literal("ping") }),
  z.object({ kind: z.literal("pong") }),
]);
export type WsMessage = z.infer<typeof WsMessage>;
