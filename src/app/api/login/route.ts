import { NextResponse } from "next/server";
import { AUTH_COOKIE, SESSION_MAX_AGE_S, isAuthConfigured, issueToken, passwordMatches } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Small, fixed delay on failure — blunts trivial online guessing. */
const FAILURE_DELAY_MS = 400;

export async function POST(req: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json({ error: "Login is not configured" }, { status: 503 });
  }

  let password = "";
  try {
    password = String(((await req.json()) as { password?: string })?.password ?? "");
  } catch {
    return NextResponse.json({ error: "Malformed request" }, { status: 400 });
  }

  if (!(await passwordMatches(password))) {
    await new Promise((r) => setTimeout(r, FAILURE_DELAY_MS));
    // Deliberately vague: naming which part was wrong tells an attacker things.
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const token = await issueToken();
  if (!token) return NextResponse.json({ error: "Login is not configured" }, { status: 503 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Secure in production only, so local http development still works.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
  return res;
}
