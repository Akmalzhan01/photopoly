import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, STALE_SESSION_PARAM, decodeSession } from "@/lib/server/session";

/**
 * Optimistic route gating.
 *
 * This only reads the signed cookie — no database — because it runs on every
 * request including prefetches. It is a redirect for the common case, not a
 * security boundary; the real checks live in the DAL and in each server action,
 * where a revoked session or a blocked user is actually noticed.
 */

const NEEDS_LOGIN = ["/studio", "/hisob", "/admin"];
const AUTH_PAGES = ["/kirish", "/royxat"];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await decodeSession(request.cookies.get(SESSION_COOKIE)?.value);

  if (NEEDS_LOGIN.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    if (!session) {
      const login = new URL("/kirish", request.nextUrl);
      // Send them back where they were heading once they are through.
      login.searchParams.set("keyin", pathname);
      return NextResponse.redirect(login);
    }
    if (pathname.startsWith("/admin") && session.role !== "ADMIN" && session.role !== "SUPERADMIN") {
      return NextResponse.redirect(new URL("/", request.nextUrl));
    }
  }

  if (session && AUTH_PAGES.includes(pathname)) {
    // The DAL sends people here with this marker when the database rejected a
    // session the cookie still vouches for — revoked, or a blocked account.
    // Bouncing them back to the studio would loop, so clear the cookie instead
    // and let the login page render.
    if (request.nextUrl.searchParams.has(STALE_SESSION_PARAM)) {
      const response = NextResponse.next();
      response.cookies.delete(SESSION_COOKIE);
      return response;
    }
    return NextResponse.redirect(new URL("/studio", request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  // `api` is excluded so the Finik webhook is never redirected, and the PWA
  // files are excluded so an expired session cannot break offline mode.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|.*\\.png$).*)",
  ],
};
