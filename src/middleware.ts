import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, isAuthConfigured, isPublicPath, verifyToken } from "@/lib/auth";

/**
 * Gate every page and data API behind the shared password (ISIM-718 follow-on).
 *
 * Exemptions live in isPublicPath — read the comment there before adding to it.
 * Two of them keep production working: Fly's health check and the inbound
 * webhook receivers.
 */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (isPublicPath(pathname)) return NextResponse.next();

  // Fail closed. An unset password must not silently leave the console open —
  // that is how a gate quietly stops being a gate.
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { error: "CONSOLE_PASSWORD is not configured on this deployment" },
      { status: 503 },
    );
  }

  if (await verifyToken(req.cookies.get(AUTH_COOKIE)?.value)) {
    return NextResponse.next();
  }

  // API callers get a status they can act on; humans get the login page with a
  // return path so they land where they were headed.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except Next's internals and static files; isPublicPath does the
  // finer-grained work.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
