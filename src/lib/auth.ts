/**
 * Shared-password gate for the console (ISIM-718 follow-on).
 *
 * Deliberately modest: one password, one cookie. That is what was asked for and
 * it is a real improvement on an open console, but it is worth being clear-eyed
 * about what it is — a single shared secret with no per-user identity, no
 * rotation and no audit trail. It keeps a passer-by out. It is not an access
 * control system, and it should not be treated as one once real customer data
 * lands on these screens.
 *
 * The cookie carries an HMAC rather than a flag, so it cannot be forged by
 * typing `authed=true` into devtools.
 *
 * Web Crypto rather than node:crypto throughout, because the middleware that
 * enforces this runs on the Edge runtime where node:crypto does not exist.
 */

export const AUTH_COOKIE = "spenza_console_auth";

/** Cookie lifetime. Long enough not to nag, short enough to expire a stolen laptop. */
export const SESSION_MAX_AGE_S = 60 * 60 * 12;

const encoder = new TextEncoder();

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * The signing key. Derived from the password when no separate secret is set, so
 * there is one thing to configure rather than two — changing the password
 * therefore invalidates every existing session, which is the behaviour you want
 * from a password change anyway.
 */
function signingKey(): string | null {
  const password = process.env.CONSOLE_PASSWORD?.trim();
  if (!password) return null;
  return `${process.env.CONSOLE_SESSION_SECRET?.trim() ?? ""}:${password}`;
}

/** Constant-time compare so a wrong password cannot be probed by timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isAuthConfigured(): boolean {
  return signingKey() !== null;
}

export async function passwordMatches(candidate: string): Promise<boolean> {
  const expected = process.env.CONSOLE_PASSWORD?.trim();
  if (!expected) return false;
  // Compare hashes rather than raw strings: equal-length comparison regardless
  // of how long the submitted value is.
  const [a, b] = await Promise.all([hmac(expected, "pw"), hmac(candidate, "pw")]);
  return timingSafeEqual(a, b);
}

/** Token is `issuedAt.signature`, signature covering the issue time. */
export async function issueToken(nowMs: number = Date.now()): Promise<string | null> {
  const key = signingKey();
  if (!key) return null;
  const issuedAt = Math.floor(nowMs / 1000);
  return `${issuedAt}.${await hmac(key, String(issuedAt))}`;
}

export async function verifyToken(
  token: string | undefined,
  nowMs: number = Date.now(),
): Promise<boolean> {
  const key = signingKey();
  if (!key || !token) return false;

  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const issuedAt = Number(token.slice(0, dot));
  const signature = token.slice(dot + 1);
  if (!Number.isFinite(issuedAt)) return false;

  const ageS = Math.floor(nowMs / 1000) - issuedAt;
  if (ageS < 0 || ageS > SESSION_MAX_AGE_S) return false;

  return timingSafeEqual(signature, await hmac(key, String(issuedAt)));
}

/**
 * Paths that must never be gated.
 *
 * Two of these are load-bearing and getting them wrong breaks production:
 *
 *   /api/health          — fly.toml runs an HTTP health check against it. Gate
 *                          it and Fly marks the machine unhealthy and restarts
 *                          it, forever.
 *   /api/webhooks/*      — inbound deliveries from spenza-backend and from the
 *                          QoS capture agent. They carry their own auth (HMAC
 *                          for QoS); a login redirect here would silently break
 *                          every report.
 */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/api/login" ||
    pathname === "/api/logout" ||
    pathname === "/api/health" ||
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/pcm-player-worklet")
  );
}
