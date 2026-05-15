// app/api/track/photo-download/route.ts
// Phase 13.10 — Public photo-download tracking endpoint.
//
// Fired by the client gallery whenever a viewer triggers a download (full-zip
// or per-photo). Downloads are user actions so we don't batch — one POST per
// photoId. The gallery viewer uses `fetch(... { keepalive: true })` so the
// request survives navigation after the download starts.
//
// Same bot-guard heuristics as `/api/track/photo-view`. See that file for
// the rationale.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { incrementPhotoDownload } from "@/lib/db/photos";

const BodySchema = z.object({
  eventId: z.string().min(1).max(128),
  photoId: z.string().min(1).max(128),
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

  const { eventId, photoId } = parsed.data;

  try {
    await incrementPhotoDownload(eventId, photoId);
  } catch {
    // Best-effort — never break the user's download.
  }

  return NextResponse.json({ ok: true });
}
