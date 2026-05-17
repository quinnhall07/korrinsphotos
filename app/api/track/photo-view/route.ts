// app/api/track/photo-view/route.ts
// Phase 13.10 — Public photo-view tracking endpoint.
//
// Receives a batch of photoIds that just entered the client-gallery viewport
// and increments each photo's `viewCount` (capped at 50 ids/request). The
// gallery viewer fires this on every IntersectionObserver hit, debounced via
// a 2s / 10-ids window — so traffic is roughly one POST per chunk of photos
// scrolled into view.
//
// Bot guard heuristics (cheap filter, NOT a fortress):
//   - User-Agent matches /(bot|crawler|spider|preview|headless|wget|curl)/i
//   - Missing `Referer` header
//   - Missing `User-Agent` header
// On reject we return `{ ok: true, skipped: true }` (200) — never leak that
// we filtered.
//
// No `requireSession` — public clients hit this from the gallery viewer.
// Event ownership is implicitly verified: we can only `update` photos that
// already exist, and a non-existent photoId silently no-ops.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { incrementPhotoView } from "@/lib/db/photos";

const BodySchema = z.object({
  eventId: z.string().min(1).max(128),
  photoIds: z.array(z.string().min(1).max(128)).min(1).max(50),
});

const BOT_UA_REGEX = /(bot|crawler|spider|preview|headless|wget|curl)/i;

function isLikelyBot(req: NextRequest): boolean {
  const ua = req.headers.get("user-agent");
  const referer = req.headers.get("referer");
  if (!ua) return true;
  if (!referer) return true;
  if (BOT_UA_REGEX.test(ua)) return true;
  return false;
}

function honorsPrivacySignals(req: NextRequest): boolean {
  if (req.headers.get("dnt") === "1") return true;
  if (req.headers.get("sec-gpc") === "1") return true;
  return false;
}

export async function POST(req: NextRequest) {
  if (isLikelyBot(req) || honorsPrivacySignals(req)) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const { eventId, photoIds } = parsed.data;
  // De-dupe within the batch — the debouncer should already do this, but
  // be defensive against duplicate ids inflating the increment count.
  const uniqueIds = Array.from(new Set(photoIds));

  await Promise.allSettled(
    uniqueIds.map((photoId) => incrementPhotoView(eventId, photoId)),
  );

  return NextResponse.json({ ok: true });
}
