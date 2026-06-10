import { handleWebhook } from "@/server/receive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Registered as webhookUrls.callbackVoiceUrl on POST /api/v1/webhooks/register.
 *  Receives voice.status (trunk callbacks) AND voice.recording.ready. */
export async function POST(req: Request) {
  return handleWebhook(req, "voice.status");
}
