import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { eventBus } from "./event-bus";
import { transcribeRecording } from "./transcribe";
import type { LiveEvent } from "@/lib/events";

/**
 * Shared handler for the webhook receivers.
 *
 * Auth is intentionally OFF: we registered with authentication.type=none on
 * spenza-backend because their delivery worker is currently not attaching the
 * Authorization header even when the registration stores Basic credentials.
 * Once that's fixed upstream, restore the Basic-Auth gate from
 * src/server/basic-auth.ts and re-register with type=basic.
 *
 * For dev this is fine — the receiver is only reachable through the local
 * tunnel. Do not expose this to the open internet without restoring auth.
 *
 * Side effects: if the *body* says the event is voice.recording.ready (which
 * arrives on the callbackVoiceUrl route alongside voice.status events), kick
 * off a post-call Whisper transcription in the background. Fire-and-forget;
 * the HTTP response returns immediately.
 */
export async function handleWebhook(req: Request, channel: LiveEvent["channel"]) {
  const text = await req.text();
  let body: unknown = text;
  try {
    body = text.length ? JSON.parse(text) : null;
  } catch {
    // Keep it as the raw string so the operator can still see what arrived.
  }

  // Trust the body's `event` field over the route name — spenza-backend sends
  // both voice.status and voice.recording.ready to the same callbackVoiceUrl.
  const bodyEvent = (body as { event?: string } | null)?.event;
  const resolvedChannel: LiveEvent["channel"] =
    bodyEvent && isKnownChannel(bodyEvent) ? bodyEvent : channel;

  const event: LiveEvent = {
    id: randomUUID(),
    channel: resolvedChannel,
    receivedAt: new Date().toISOString(),
    body,
  };
  eventBus.publish(event);

  if (resolvedChannel === "voice.recording.ready") {
    void transcribeRecording(body as Parameters<typeof transcribeRecording>[0]);
  }

  return NextResponse.json({ ok: true, id: event.id, channel: resolvedChannel });
}

const KNOWN_CHANNELS = new Set<LiveEvent["channel"]>([
  "sms.incoming",
  "sms.status",
  "voice.incoming",
  "voice.status",
  "voice.call.started",
  "voice.recording.ready",
  "voice.stream.handshake",
  "voice.transcript.ready",
  "voice.qos.report",
]);

function isKnownChannel(v: string): v is LiveEvent["channel"] {
  return KNOWN_CHANNELS.has(v as LiveEvent["channel"]);
}
