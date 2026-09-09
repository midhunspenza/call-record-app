import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * HMAC verification for the QoS webhook (ISIM-718).
 *
 * Why this route authenticates when the others do not:
 *
 * The SMS/voice receivers in this app deliberately run with auth off, because
 * spenza-backend's delivery worker does not attach the Authorization header —
 * storing Basic credentials there would only make the gate reject every
 * delivery (see the comments in receive.ts and registration.ts).
 *
 * That reasoning does not carry over here. We own the sender: the QoS capture
 * agent on the SIP node. And this console answers on the open internet, so an
 * unauthenticated metrics endpoint would let anyone post fabricated call
 * quality into the very screen used to judge call quality.
 *
 * Signature covers `${unixSeconds}.${rawBody}`, so a captured body cannot be
 * replayed under a fresh timestamp.
 */

/**
 * Replay window. Generous enough that a backed-off retry from the agent's
 * outbox still lands, tight enough to bound replay of a captured request.
 */
const MAX_SKEW_MS = 5 * 60_000;

export const QOS_TIMESTAMP_HEADER = "x-spenza-timestamp";
export const QOS_SIGNATURE_HEADER = "x-spenza-signature";

export type VerifyResult = { ok: true } | { ok: false; status: 401 | 503; reason: string };

export function verifyQosSignature(params: {
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
  secret: string | undefined;
  now?: number;
}): VerifyResult {
  const { rawBody, timestamp, signature, secret, now = Date.now() } = params;

  // Fail closed. An unset secret must never degrade into "accept everything" —
  // that is exactly how an endpoint ends up unauthenticated in production
  // without anyone noticing. 503 rather than 401: the fault is ours, not the
  // caller's, and the agent's retry logic should keep the report queued.
  if (!secret) {
    return { ok: false, status: 503, reason: "QOS_WEBHOOK_SECRET is not configured" };
  }
  if (!timestamp || !signature) {
    return { ok: false, status: 401, reason: "Missing signature headers" };
  }

  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds)) {
    return { ok: false, status: 401, reason: "Malformed timestamp" };
  }
  if (Math.abs(now - seconds * 1000) > MAX_SKEW_MS) {
    return { ok: false, status: 401, reason: "Timestamp outside the accepted window" };
  }

  const expected = createHmac("sha256", secret).update(`${seconds}.${rawBody}`).digest("hex");
  const given = signature.replace(/^sha256=/i, "").trim();

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(given, "utf8");
  // timingSafeEqual throws on a length mismatch, so length is checked first.
  // That leaks signature length only, which is fixed and public anyway.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, status: 401, reason: "Invalid signature" };
  }

  return { ok: true };
}

/**
 * Produce the headers the capture agent sends. Lives here so the signing and
 * verifying halves of the scheme can never drift apart, and so tests and local
 * curl can generate a valid request without reimplementing the format.
 */
export function signQosBody(
  rawBody: string,
  secret: string,
  atMs: number = Date.now(),
): { timestamp: string; signature: string } {
  const seconds = Math.floor(atMs / 1000);
  const digest = createHmac("sha256", secret).update(`${seconds}.${rawBody}`).digest("hex");
  return { timestamp: String(seconds), signature: `sha256=${digest}` };
}
