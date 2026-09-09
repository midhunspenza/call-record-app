import { NextResponse } from "next/server";
import { QosReport } from "@/lib/qos";
import { eventBus } from "@/server/event-bus";
import {
  QOS_SIGNATURE_HEADER,
  QOS_TIMESTAMP_HEADER,
  verifyQosSignature,
} from "@/server/qos-auth";
import { qosStore } from "@/server/qos-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Receiver for per-call QoS reports from the capture agent on the SIP node
 * (ISIM-718).
 *
 * Unlike the SMS/voice receivers, this route verifies an HMAC signature and
 * rejects anything unsigned — see the header comment in qos-auth.ts for why the
 * "auth is off" reasoning that applies to spenza-backend deliveries does not
 * apply to a sender we own.
 *
 * The response body distinguishes `stored` from `duplicate` so the agent's
 * outbox can retire a report on either, and a human reading the agent's logs
 * can tell a successful retry from a first delivery.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();

  const auth = verifyQosSignature({
    rawBody,
    timestamp: req.headers.get(QOS_TIMESTAMP_HEADER),
    signature: req.headers.get(QOS_SIGNATURE_HEADER),
    secret: process.env.QOS_WEBHOOK_SECRET,
  });
  if (!auth.ok) {
    console.warn(`[qos] rejected delivery: ${auth.reason}`);
    return NextResponse.json({ ok: false, error: auth.reason }, { status: auth.status });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "Body is not valid JSON" }, { status: 400 });
  }

  // Validate rather than relay. The other receivers pass spenza-backend's body
  // through untouched because we do not own that schema; we own this one, and a
  // malformed report reaching the UI would be displayed as if it were measured.
  const parsed = QosReport.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 8).map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    console.warn("[qos] rejected malformed report:", issues);
    return NextResponse.json({ ok: false, error: "Report failed validation", issues }, { status: 400 });
  }

  const report = parsed.data;
  const stored = await qosStore.add(report);

  // reportId is the bus event id, so a retried delivery dedupes in the bus the
  // same way it does in the store and the UI never shows the call twice.
  eventBus.publish({
    id: report.reportId,
    channel: "voice.qos.report",
    receivedAt: new Date().toISOString(),
    body: report,
  });

  console.log(
    `[qos] ${stored ? "stored" : "duplicate"} ${report.reportId} ` +
      `${report.call.gatedNumber} verdict=${report.verdict}`,
  );

  return NextResponse.json({
    ok: true,
    reportId: report.reportId,
    result: stored ? "stored" : "duplicate",
  });
}
