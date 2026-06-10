import { putJson } from "./s3";

/**
 * Persistence for the LIVE (in-call) transcript.
 *
 * The realtime transcriber in live-transcribe.ts surfaces finalized utterances
 * through ws.ts as `voice.transcript.segment` events, but those are fire-and-
 * forget to the browser — once the call ends they're gone. This module gives
 * ws.ts a place to dump the accumulated segments at call close so the transcript
 * survives alongside the recording.
 *
 * Storage: same bucket as the recordings/whisper transcripts, under a dedicated
 * prefix so it never collides with the canonical `{audioKey}.json` that the
 * post-call Whisper pipeline (transcribe.ts) writes. Keyed by callId because
 * that's all we know during the live call — the WAV's S3 key isn't assigned
 * until spenza-backend uploads it and fires voice.recording.ready later.
 *
 *   live-transcripts/{callId}.json
 *
 * The Whisper transcript remains the canonical one the recordings UI reads; this
 * is the immediately-available, in-call copy.
 */

const LIVE_PREFIX = process.env.LIVE_TRANSCRIPT_PREFIX ?? "live-transcripts/";

export type LiveSegment = {
  /** Realtime item_id that groups the utterance. */
  itemId: string;
  /** Finalized text for the utterance. */
  text: string;
  /** When we received the completed utterance (server wall clock, ISO). */
  at: string;
};

export type LiveTranscriptMeta = {
  callId?: string;
  from?: string;
  to?: string;
  direction?: string;
  /** Per-connection tag from ws.ts; fallback key when callId is absent. */
  tag: string;
};

/** S3 key for a live transcript. Prefers callId; falls back to the WS tag. */
export function liveTranscriptKey(meta: { callId?: string; tag: string }): string {
  const id = meta.callId && meta.callId.length ? meta.callId : meta.tag;
  return `${LIVE_PREFIX}${id}.json`;
}

/**
 * Write the accumulated live transcript to S3. Fire-and-forget friendly:
 * returns the key on success, throws on failure so the caller can log it.
 */
export async function persistLiveTranscript(args: {
  meta: LiveTranscriptMeta;
  segments: LiveSegment[];
  startedAt: number;
  endedAt: number;
}): Promise<string> {
  const { meta, segments, startedAt, endedAt } = args;
  const key = liveTranscriptKey(meta);

  const doc = {
    schema: "spenza.voice.transcript.live/v1",
    source: "live" as const,
    transcriptKey: key,
    callId: meta.callId,
    from: meta.from,
    to: meta.to,
    direction: meta.direction,
    tag: meta.tag,
    text: segments.map((s) => s.text).join(" ").trim(),
    segments,
    startedAt: new Date(startedAt).toISOString(),
    endedAt: new Date(endedAt).toISOString(),
    durationMs: Math.max(0, endedAt - startedAt),
    model: process.env.OPENAI_REALTIME_TRANSCRIBE_MODEL ?? "gpt-4o-mini-transcribe",
  };

  await putJson(key, doc);
  return key;
}
