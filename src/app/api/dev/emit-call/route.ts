import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { eventBus } from "@/server/event-bus";

// TEMP dev-only route: simulate a real inbound call (handshake + transcript)
// to verify the Live Voice page renders real identity. DELETE AFTER VERIFYING.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // Mirrors the real call the user reported (note the stray leading spaces the
  // backend actually sends — exercises the trim in useLiveCalls).
  const callId = "1779881181.144";
  const hs = { callId, direction: "in", from: " 12792044328", to: " 12792180356", did: "2792180356" };

  // Two legs (inbound + outbound) share the callId, like the real stream.
  eventBus.publish({ id: randomUUID(), channel: "voice.stream.handshake", receivedAt: new Date().toISOString(), body: hs });
  eventBus.publish({ id: randomUUID(), channel: "voice.stream.handshake", receivedAt: new Date().toISOString(), body: { ...hs, direction: "out" } });

  const lines = [
    "Hello, thanks for calling — how can I help you today?",
    "Hi, I'd like to check the activation status on my new SIM.",
    "Sure, can you read me the last four digits of the SIM number?",
  ];
  const meta = { callId, from: "12792044328", to: "12792180356", did: "2792180356", direction: "in" };
  for (const text of lines) {
    const itemId = randomUUID();
    for (const w of text.split(" ")) {
      eventBus.publish({ id: randomUUID(), channel: "voice.transcript.delta", receivedAt: new Date().toISOString(), body: { ...meta, itemId, delta: " " + w } });
    }
    eventBus.publish({ id: randomUUID(), channel: "voice.transcript.segment", receivedAt: new Date().toISOString(), body: { ...meta, itemId, text } });
  }

  return NextResponse.json({ ok: true, callId });
}
