import type { LiveEvent } from "@/lib/events";
import type { Conversation, Message, NumberRow } from "./data";

/**
 * Pulls (from, to, body, messageId, status, ms) out of whatever the bridge
 * actually posted. spenza-backend's orchestrator normalizes to camelCase
 * (from, to, body, messageId, …), but raw Joonto payloads use Capitalised
 * keys (From, To, Message_Body, Message_ID, …). We accept both so the UI
 * doesn't care which layer the event came from.
 */
type AnyRecord = Record<string, unknown>;

function pick(obj: AnyRecord | undefined, ...keys: string[]): string | undefined {
  if (!obj) return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 0) return v;
    if (typeof v === "number") return String(v);
  }
  return undefined;
}

export type ParsedSms = {
  messageId: string;
  from: string;
  to: string;          // the Spenza number this message belongs to
  body: string;
  ms: number;
  status: "delivered" | "pending" | "failed";
};

export function parseSmsEvent(event: LiveEvent): ParsedSms | null {
  const root = (event.body ?? {}) as AnyRecord;
  const data = (root.data ?? root) as AnyRecord;

  const messageId = pick(data, "messageId", "Message_ID", "messageID") ?? event.id;
  const from = pick(data, "from", "From");
  const to = pick(data, "to", "To", "owner", "Owner");
  const body = pick(data, "body", "Message_Body", "text") ?? "";
  const ts = pick(data, "dateCreated", "Date_Created", "dateUpdated", "Date_Updated") ?? event.receivedAt;
  const statusRaw = (pick(data, "status", "Status") ?? "delivered").toLowerCase();

  if (!from || !to) return null;

  const parsed = Date.parse(ts);
  const ms = Number.isFinite(parsed) ? parsed : Date.now();

  const status: ParsedSms["status"] =
    statusRaw.includes("fail") ? "failed" : statusRaw.includes("pend") ? "pending" : "delivered";

  return { messageId, from, to, body, ms, status };
}

/** Stable id derived from the To (Spenza) number — keeps repeated events grouped. */
export function liveNumberId(to: string) {
  return `live:${to.replace(/\s+/g, "")}`;
}

/** A NumberRow describing a Spenza number we just learned about from a live event. */
export function makeLiveNumberRow(to: string, lastBody: string): NumberRow {
  return {
    id: liveNumberId(to),
    num: to,
    country: "🛰",
    unread: 0,
    last: lastBody || "Live SMS",
  };
}

/** Conversation id derived from (to, from) so the same pair always reuses one thread. */
export function liveConvoId(to: string, from: string) {
  return `live:${to.replace(/\s+/g, "")}::${from.replace(/\s+/g, "")}`;
}

/**
 * Apply an incoming SMS to the conversation array. Pure: returns a new array,
 * doesn't mutate. If a conversation for (to, from) already exists (live or
 * mock), append the message; otherwise create a new one.
 */
export function applyIncoming(
  convos: Conversation[],
  sms: ParsedSms,
  spenzaNumberId: string,
): Conversation[] {
  const msg: Message = {
    dir: "in",
    text: sms.body,
    ms: sms.ms,
    status: sms.status,
    errCode: null,
  };

  const idx = convos.findIndex(
    (c) => c.spenzaNumberId === spenzaNumberId && stripWs(c.peerDisplay) === stripWs(sms.from),
  );

  if (idx >= 0) {
    const existing = convos[idx];
    const updated: Conversation = {
      ...existing,
      msgs: [...existing.msgs, msg],
      lastMs: msg.ms,
      lastDir: "in",
      lastText: msg.text || existing.lastText,
    };
    const next = convos.slice();
    next.splice(idx, 1, updated);
    return next;
  }

  const created: Conversation = {
    id: liveConvoId(sms.to, sms.from),
    spenzaNumberId,
    peerDisplay: sms.from,
    contactName: "Live caller",
    msgs: [msg],
    hasFailure: msg.status === "failed",
    lastMs: msg.ms,
    lastDir: "in",
    lastText: msg.text || "(empty body)",
  };
  return [created, ...convos];
}

function stripWs(s: string) {
  return s.replace(/\s+/g, "");
}
