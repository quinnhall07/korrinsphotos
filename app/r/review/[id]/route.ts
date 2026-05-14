// app/r/review/[id]/route.ts
// Phase 4.6 — click-tracking redirect for review request emails.
//
// Email links use the shape `/r/review/{reviewRequestId}?target={encodedUrl}`.
// We accept the GET, stamp `clickedAt` + flip status QUEUED|SENT → CLICKED,
// then 302 the browser at the original `target` URL.
//
// No auth: this is intentionally a public endpoint — the click is the auth
// signal. The `id` segment is treated as opaque; an attacker guessing IDs
// can at worst force a CLICKED state on a doc they don't know exists. They
// cannot read it. We do require `target` to be an absolute http(s) URL so
// the redirect can't be turned into an arbitrary open-redirect on a relative
// path that we don't control.

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { reviewRequestsCol } from "@/lib/db/reviews";

const HOME = (process.env.NEXT_PUBLIC_APP_URL ?? "https://korrinsphotos.com").replace(/\/$/, "");

function isSafeUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await ctx.params;
  const target = req.nextUrl.searchParams.get("target") ?? "";

  // Fire-and-forget the click stamp. If the doc isn't QUEUED|SENT we still
  // honor the redirect — the click is what the user paid for in patience.
  try {
    const ref = reviewRequestsCol().doc(id);
    const snap = await ref.get();
    if (snap.exists) {
      const data = snap.data();
      const status = data?.status;
      if (status === "QUEUED" || status === "SENT") {
        await ref.update({
          status: "CLICKED",
          clickedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }
  } catch (err) {
    console.error("[/r/review/:id] click stamp failed", { id, err });
  }

  const safeTarget = target && isSafeUrl(target) ? target : HOME;
  return NextResponse.redirect(safeTarget, { status: 302 });
}
