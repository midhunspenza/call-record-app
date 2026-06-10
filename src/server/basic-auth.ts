import { timingSafeEqual } from "node:crypto";

/**
 * Verifies the Authorization: Basic header against the credentials we used
 * when calling POST /api/v1/webhooks/register. Constant-time comparison so an
 * attacker can't probe the password byte-by-byte via timing.
 */
export function verifyBasicAuth(
  header: string | null,
  expectedUser: string | undefined,
  expectedPass: string | undefined,
): boolean {
  if (!expectedUser || !expectedPass) return false;
  if (!header || !header.toLowerCase().startsWith("basic ")) return false;
  let decoded: string;
  try {
    decoded = Buffer.from(header.slice(6).trim(), "base64").toString("utf-8");
  } catch {
    return false;
  }
  const idx = decoded.indexOf(":");
  if (idx === -1) return false;
  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);

  const u1 = Buffer.from(user);
  const u2 = Buffer.from(expectedUser);
  const p1 = Buffer.from(pass);
  const p2 = Buffer.from(expectedPass);
  if (u1.length !== u2.length || p1.length !== p2.length) return false;
  return timingSafeEqual(u1, u2) && timingSafeEqual(p1, p2);
}
