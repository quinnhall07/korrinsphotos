// app/welcome-packet/[projectId]/route.ts
//
// Phase 2.7 — Public read route for the welcome packet.
//
// Auth model: the projectId + the `?t=<token>` query parameter together form
// the credential. No Firebase session is required — this mirrors the
// magic-link pattern used by `/sign-contract/[id]`. The token is minted
// in `lib/domain/welcome-packet.ts > generateAndUploadWelcomePacket` and
// persisted on `projects/{id}.welcomePacketToken`. Constant-time comparison
// avoids leaking the token via response-time side channels.
//
// On success: 302-redirect to a 1-hour R2 presigned GET URL. We mint a
// short-lived URL at request time (rather than reusing the 24h URL stored
// at generation) so the link survives indefinitely as long as the token
// is still valid.
//
// On token mismatch / missing token / no packet on file: return a small
// HTML "expired link" page asking the visitor to reach out to Korrin.

import { timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { generatePresignedGetUrl } from "@/lib/storage/r2";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

function tokensMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

function expiredHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Welcome packet — link expired</title>
  <style>
    :root { --white: #FAF9F6; --charcoal: #2A2A28; --charcoal-light: #4A4A47; --olive: #6B7845; --border: rgba(42,42,40,0.12); }
    html, body { margin: 0; padding: 0; background: var(--white); color: var(--charcoal); }
    body { font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif; font-weight: 300; line-height: 1.7; }
    .wrap { max-width: 520px; margin: 0 auto; padding: 6rem 1.5rem; text-align: center; }
    .eyebrow { font-size: 0.65rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--olive); margin: 0 0 0.75rem 0; }
    h1 { font-family: "Cormorant Garamond", Georgia, serif; font-weight: 300; font-style: italic; font-size: 2.4rem; margin: 0 0 1rem 0; }
    p { color: var(--charcoal-light); margin: 0 0 1rem 0; }
    a { color: var(--olive); }
  </style>
</head>
<body>
  <div class="wrap">
    <p class="eyebrow">Welcome packet</p>
    <h1>This packet link has expired</h1>
    <p>Please email Korrin and a fresh link will be sent your way.</p>
    <p><a href="mailto:korrin@korrinsphotos.com">korrin@korrinsphotos.com</a></p>
  </div>
</body>
</html>`;
}

function expiredResponse(): NextResponse {
  return new NextResponse(expiredHtml(), {
    status: 404,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { projectId } = await context.params;
  const rawToken = req.nextUrl.searchParams.get("t");
  if (!projectId || !rawToken) return expiredResponse();

  try {
    const snap = await adminDb.collection("projects").doc(projectId).get();
    if (!snap.exists) return expiredResponse();
    const data = snap.data() ?? {};
    const stored: string | undefined = data.welcomePacketToken;
    const r2Key: string | undefined = data.welcomePacketR2Key;
    if (!stored || !r2Key) return expiredResponse();
    if (!tokensMatch(stored, rawToken)) return expiredResponse();

    // Mint a 1h presigned GET and redirect. The browser fetches the HTML
    // straight from R2, which keeps the page weight off our Next.js
    // server and lets the visitor download it as a file if they want.
    const url = await generatePresignedGetUrl(r2Key, 60 * 60);
    return NextResponse.redirect(url, {
      status: 302,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[welcome-packet] route failed", { projectId, err });
    return expiredResponse();
  }
}
