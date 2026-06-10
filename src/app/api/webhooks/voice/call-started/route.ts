import { handleWebhook } from "@/server/receive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Alternate landing for voice.call.started (also delivered to voiceUrl).
 *  Kept as a separate route in case the user wants to split incoming-call
 *  vs call-started in the UI. */
export async function POST(req: Request) {
  return handleWebhook(req, "voice.call.started");
}
