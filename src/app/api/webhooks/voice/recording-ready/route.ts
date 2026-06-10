import { handleWebhook } from "@/server/receive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Alternate landing for voice.recording.ready (also delivered to callbackVoiceUrl).
 *  The body contains the presigned S3 URL the customer can use to download the WAV. */
export async function POST(req: Request) {
  return handleWebhook(req, "voice.recording.ready");
}
