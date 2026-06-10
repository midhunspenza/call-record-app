import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { eventBus } from "./event-bus";
import { putJson, s3KeyFromPresignedUrl } from "./s3";

/**
 * Post-call transcription pipeline.
 *
 * Trigger:  voice.recording.ready webhook arrives in /api/webhooks/voice/recording-ready
 * Output:
 *   1) {audioKey}.json uploaded to the same S3 bucket alongside the WAV.
 *   2) voice.transcript.ready event published to eventBus so any /api/stream
 *      listener sees it in real time.
 *
 * Provider: OpenAI Whisper (`whisper-1`). Requested response format is
 * `verbose_json` with word-level timestamps so the UI can highlight the
 * current word during playback.
 */

type RecordingReadyBody = {
  event?: string;
  operator?: string;
  data?: {
    callId?: string;
    from?: string;
    to?: string;
    did?: string;
    direction?: string;
    recordingUrl?: string;     // presigned S3 URL to the WAV
    expiresAt?: string;
    durationMs?: number;
    byteCount?: number;
    format?: string;
    sampleRate?: number;
    channels?: number;
  };
};

const TRANSCRIPT_SUFFIX = ".json";
const WAV_SUFFIX = ".wav";

let _openai: OpenAI | null = null;
function openai(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  if (_openai) return _openai;
  _openai = new OpenAI({ apiKey: key });
  return _openai;
}

function transcriptKeyFor(audioKey: string): string {
  // {prefix}.wav → {prefix}.json
  if (audioKey.endsWith(WAV_SUFFIX)) {
    return audioKey.slice(0, -WAV_SUFFIX.length) + TRANSCRIPT_SUFFIX;
  }
  return audioKey + TRANSCRIPT_SUFFIX;
}

/**
 * Kick off transcription. Fire-and-forget; never throws to the caller.
 */
export async function transcribeRecording(payload: RecordingReadyBody): Promise<void> {
  const data = payload?.data ?? {};
  const presignedUrl = data.recordingUrl;
  if (!presignedUrl) {
    console.warn("[transcribe] skipped — no recordingUrl in payload");
    return;
  }

  const client = openai();
  if (!client) {
    console.warn("[transcribe] skipped — OPENAI_API_KEY not set");
    return;
  }

  const audioKey = s3KeyFromPresignedUrl(presignedUrl);
  if (!audioKey) {
    console.warn("[transcribe] skipped — could not parse S3 key from URL");
    return;
  }
  const transcriptKey = transcriptKeyFor(audioKey);

  console.log(`[transcribe] ▶ start audioKey=${audioKey} callId=${data.callId}`);
  const startedAt = Date.now();

  let wavBuffer: Buffer;
  try {
    const wavResponse = await fetch(presignedUrl);
    if (!wavResponse.ok) {
      throw new Error(`download wav: ${wavResponse.status} ${wavResponse.statusText}`);
    }
    const ab = await wavResponse.arrayBuffer();
    wavBuffer = Buffer.from(ab);
  } catch (err) {
    console.error("[transcribe] ✖ download failed:", (err as Error).message);
    return;
  }

  let verbose: OpenAI.Audio.Transcriptions.TranscriptionVerbose;
  try {
    // OpenAI SDK expects a File-like object. Convert the Buffer into a Blob
    // wrapped in a File so `name` carries through (Whisper uses it to pick
    // the codec).
    const audioFile = new File([new Uint8Array(wavBuffer)], audioKey.split("/").pop() ?? "audio.wav", {
      type: "audio/wav",
    });
    verbose = (await client.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      response_format: "verbose_json",
      timestamp_granularities: ["word", "segment"],
    })) as OpenAI.Audio.Transcriptions.TranscriptionVerbose;
  } catch (err) {
    console.error("[transcribe] ✖ Whisper failed:", (err as Error).message);
    return;
  }

  const transcriptDoc = {
    schema: "spenza.voice.transcript/v1",
    audioKey,
    transcriptKey,
    callId: data.callId,
    from: data.from,
    to: data.to,
    did: data.did,
    direction: data.direction,
    operator: payload?.operator,
    language: verbose.language,
    durationSec: verbose.duration,
    text: verbose.text,
    segments: verbose.segments ?? [],
    words: verbose.words ?? [],
    transcribedAt: new Date().toISOString(),
    transcribeMs: Date.now() - startedAt,
    model: "whisper-1",
  };

  try {
    await putJson(transcriptKey, transcriptDoc);
  } catch (err) {
    console.error("[transcribe] ✖ S3 upload failed:", (err as Error).message);
    return;
  }

  console.log(
    `[transcribe] ✔ done audioKey=${audioKey} chars=${verbose.text?.length ?? 0} words=${verbose.words?.length ?? 0} duration=${transcriptDoc.durationSec}s took=${transcriptDoc.transcribeMs}ms`,
  );

  eventBus.publish({
    id: randomUUID(),
    channel: "voice.transcript.ready",
    receivedAt: new Date().toISOString(),
    body: {
      audioKey,
      transcriptKey,
      callId: data.callId,
      from: data.from,
      to: data.to,
      direction: data.direction,
      durationSec: transcriptDoc.durationSec,
      text: transcriptDoc.text,
      preview: (transcriptDoc.text ?? "").slice(0, 200),
    },
  });
}
