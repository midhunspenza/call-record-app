import { handleWebhook } from "@/server/receive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Registered as webhookUrls.callbackMessageUrl on POST /api/v1/webhooks/register. */
export async function POST(req: Request) {
  return handleWebhook(req, "sms.status");
}
