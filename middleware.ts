// middleware.ts
import { NextRequest, NextResponse } from "next/server";

const PROTECTED_ADMIN   = /^\/admin(\/|$)/;
const PROTECTED_GALLERY = /^\/gallery(\/|$)/;
const SESSION_COOKIE    = "__session";

function inferSource(req: NextRequest): string {
  const referer = req.headers.get("referer") || "";
  if (referer.includes("instagram.com")) return "INSTAGRAM";
  if (referer.includes("google.com")) return "GOOGLE";
  if (referer) return "OTHER";
  return "DIRECT";
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const sessionCookie = req.cookies.get(SESSION_COOKIE);
  const res = NextResponse.next();

  // ── Source Attribution Cookie ──────────────────────────────────────────────
  if (!req.cookies.get("__origin")) {
    const url = new URL(req.url);
    const origin = {
      source:       url.searchParams.get("utm_source") ?? inferSource(req),
      medium:       url.searchParams.get("utm_medium") ?? null,
      campaign:     url.searchParams.get("utm_campaign") ?? null,
      referralCode: url.searchParams.get("ref") ?? null,
      landingUrl:   req.nextUrl.pathname,
      ts:           Date.now(),
    };
    res.cookies.set("__origin", JSON.stringify(origin), {
      maxAge: 60 * 60 * 24 * 30, // 30 days
      httpOnly: false,  // JS needs to read it on form submit if necessary
      sameSite: "lax",
    });
  }

  // ── Admin routes ──────────────────────────────────────────────────────────
  if (PROTECTED_ADMIN.test(pathname)) {
    if (!sessionCookie?.value) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    // Role check (ADMIN) is enforced inside app/admin/layout.tsx using
    // firebase-admin so we have full Node.js access there.
    return res;
  }

  // ── Client gallery routes ─────────────────────────────────────────────────
  if (PROTECTED_GALLERY.test(pathname)) {
    if (!sessionCookie?.value) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return res;
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};