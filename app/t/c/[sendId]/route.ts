// app/t/c/[sendId]/route.ts
// Phase 1.6 / 4.3 — Email-click redirector. Every external <a href="…">
// emitted by enqueueTrackedMail() is rewritten to:
//
//   {NEXT_PUBLIC_APP_URL}/t/c/{sendId}?u=<base64url(targetUrl)>
//
// We stamp an `emailEvents` row of type "clicked" with the decoded URL +
// User-Agent, then 302 the browser to the original destination.
//
// Safety:
//   - Decoded URL MUST be absolute http(s). If decoding fails or the URL
//     points anywhere internal (same host as NEXT_PUBLIC_APP_URL), we fall
//     back to the home page rather than redirect somewhere unsafe.
//   - Unknown sendId still completes the redirect — we don't want clicks
//     to dead-end if a row was lost.
//   - This route NEVER throws; it logs and falls through to the safe
//     redirect target.

import { NextRequest, NextResponse } from "next/server";
import { createEmailEvent } from "@/lib/db/email-events";
import { base64UrlDecode as decodeUrl } from "@/lib/email/tracking";

const HOME = (process.env.NEXT_PUBLIC_APP_URL ?? "https://korrinsphotos.com").replace(/\/$/, "");

function safeRedirect(target: string): string {
  try {
    const u = new URL(target);
    if (u.protocol !== "http:" && u.protocol !== "https:") return HOME;
    const own = new URL(HOME);
    // Internal redirects are blocked — we never want a tracker to send a
    // recipient to /admin/... where the link could carry session-bearing
    // query params. If a future template legitimately needs to link
    // internally, it should not go through /t/c at all (see
    // shouldRewriteHref in lib/email/tracking.ts which exempts internal
    // URLs from rewriting in the first place).
    if (u.host.toLowerCase() === own.host.toLowerCase()) return HOME;
    return target;
  } catch {
    return HOME;
  }
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ sendId: string }> }
): Promise<NextResponse> {
  let decoded: string | null = null;
  let sendId: string | null = null;
  try {
    const params = await ctx.params;
    sendId = params.sendId ?? null;
    const u = req.nextUrl.searchParams.get("u") ?? "";
    if (u) {
      try {
        decoded = decodeUrl(u);
      } catch (err) {
        console.error("[/t/c/:sendId] failed to decode u", { sendId, err });
        decoded = null;
      }
    }

    if (sendId && /^[a-f0-9]+$/i.test(sendId)) {
      const userAgent = req.headers.get("user-agent");
      // Fire-and-forget — never block the redirect on Firestore latency.
      createEmailEvent({
        sendId,
        recipientEmail: "",
        type: "clicked",
        url: decoded,
        userAgent: userAgent ?? null,
      }).catch((err) => {
        console.error("[/t/c/:sendId] createEmailEvent failed", { sendId, err });
      });
    }
  } catch (err) {
    console.error("[/t/c/:sendId] unexpected error", err);
  }

  const target = decoded ? safeRedirect(decoded) : HOME;
  return NextResponse.redirect(target, { status: 302 });
}
