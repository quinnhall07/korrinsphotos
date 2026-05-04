// middleware.ts
// Protects /admin and /gallery using the Firebase session cookie.
// Runs on the Edge — cannot use firebase-admin directly (no Node.js APIs).
// Strategy: check cookie existence here; actual token verification happens
// inside the Server Components / Route Handlers that need real user data.

import { NextRequest, NextResponse } from "next/server";

const PROTECTED_ADMIN   = /^\/admin(\/|$)/;
const PROTECTED_GALLERY = /^\/gallery(\/|$)/;
const SESSION_COOKIE    = "__session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const sessionCookie = req.cookies.get(SESSION_COOKIE);

  // ── Admin routes ──────────────────────────────────────────────────────────
  if (PROTECTED_ADMIN.test(pathname)) {
    if (!sessionCookie?.value) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    // Role check (ADMIN) is enforced inside app/admin/layout.tsx using
    // firebase-admin so we have full Node.js access there.
    return NextResponse.next();
  }

  // ── Client gallery routes ─────────────────────────────────────────────────
  if (PROTECTED_GALLERY.test(pathname)) {
    if (!sessionCookie?.value) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/gallery/:path*"],
};