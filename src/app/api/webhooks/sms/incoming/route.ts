import { handleWebhook } from "@/server/receive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Registered as webhookUrls.messageUrl on POST /api/v1/webhooks/register. */
export async function POST(req: Request) {
  return handleWebhook(req, "sms.incoming");
}
