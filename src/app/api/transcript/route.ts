import { NextResponse } from "next/server";
import { getJson, RECORDINGS_BUCKET } from "@/server/s3";
import { liveTranscriptKey } from "@/server/live-transcript-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Browser-callable transcript proxy.
 *
 *   GET /api/transcript?audioKey={key}.wav   → canonical Whisper transcript
 *   GET /api/transcript?key={key}.json       → explicit S3 key
 *   GET /api/transcript?callId={callId}       → live (in-call) transcript
 *
 * Returns:
 *   200 { transcript } when the JSON exists in S3.
 *   202 { status: "pending" } when the audio key is known but transcript isn't there yet.
 *   400 when no key was provided.
 *   404 if no key resolution is possible.
 *
 * Keeps AWS credentials server-side; the browser never talks to S3 directly.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const explicitKey = url.searchParams.get("key");
  const audioKey = url.searchParams.get("audioKey");
  const callId = url.searchParams.get("callId");

  const transcriptKey =
    explicitKey ??
    (callId ? liveTranscriptKey({ callId, tag: callId }) : null) ??
    deriveTranscriptKey(audioKey);
  if (!transcriptKey) {
    return NextResponse.json(
      { error: "Provide ?key=<transcript.json>, ?audioKey=<recording.wav>, or ?callId=<callId>" },
      { status: 400 },
    );
  }

  try {
    const doc = await getJson(transcriptKey);
    if (!doc) {
      return NextResponse.json(
        { status: "pending", bucket: RECORDINGS_BUCKET, transcriptKey },
        { status: 202 },
      );
    }
    return NextResponse.json({ status: "ready", transcript: doc });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message, transcriptKey },
      { status: 500 },
    );
  }
}

function deriveTranscriptKey(audioKey: string | null): string | null {
  if (!audioKey) return null;
  if (audioKey.endsWith(".wav")) return audioKey.slice(0, -4) + ".json";
  if (audioKey.endsWith(".json")) return audioKey;
  return audioKey + ".json";
}
