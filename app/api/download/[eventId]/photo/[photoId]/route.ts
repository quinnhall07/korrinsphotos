// app/api/download/[eventId]/photo/[photoId]/route.ts
// Phase 2.6 — Per-photo download endpoint.
//
// Returns a redirect to the appropriate URL for the requested resolution
// tier so the browser can save the file. We never inline-stream the bytes
// here — that would re-introduce the 4.5 MB Vercel body cap and burn
// bandwidth. Instead:
//
//   web      → 302 to CF Images `gallery` variant
//   print    → 302 to CF Images `download` variant
//   original → 302 to a short-lived R2 presigned GET URL (falls back to
//              `download` variant if the photo has no R2 key)
//
// Auth: requireSession() + eventAccess (admin override). The same PIN gate
// as the zip endpoints applies — if the event has a `downloadPin` set the
// request must include `?pin=...`.

import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { adminDb } from "@/lib/firebase-admin";
import { buildCdnUrl } from "@/lib/storage/images";
import { generatePresignedGetUrl } from "@/lib/storage/r2";
import { verifyDownloadPin } from "@/lib/db/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ eventId: string; photoId: string }> };

type ResolutionTier = "web" | "print" | "original";
const VALID_TIERS: ReadonlySet<ResolutionTier> = new Set(["web", "print", "original"]);

function parseResolution(input: string | null): ResolutionTier {
  if (input && VALID_TIERS.has(input as ResolutionTier)) {
    return input as ResolutionTier;
  }
  return "web";
}

export async function GET(req: NextRequest, { params }: Params) {
  const { eventId, photoId } = await params;
  const session = await requireSession();

  if (session.role !== "ADMIN") {
    const accessId = `${session.uid}_${eventId}`;
    const accessDoc = await adminDb.collection("eventAccess").doc(accessId).get();
    if (!accessDoc.exists) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const url = new URL(req.url);
  const suppliedPin = url.searchParams.get("pin");
  const pinCheck = await verifyDownloadPin(eventId, suppliedPin);
  if (pinCheck.required && !pinCheck.ok) {
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  const tier = parseResolution(url.searchParams.get("resolution"));

  const photoSnap = await adminDb
    .collection("events")
    .doc(eventId)
    .collection("photos")
    .doc(photoId)
    .get();
  if (!photoSnap.exists) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }
  const data = photoSnap.data()!;
  const cloudflareImageId = data.cloudflareImageId as string | undefined;
  const r2Key =
    (data.r2Key as string | undefined) ??
    (data.storageKey as string | undefined) ??
    null;

  let target: string | null = null;
  if (tier === "original") {
    if (r2Key) {
      try {
        target = await generatePresignedGetUrl(r2Key, 600);
      } catch (err) {
        console.error("[download/photo] presign failed", { photoId, err });
      }
    }
    if (!target && cloudflareImageId) {
      // Per-photo fallback when no R2 key is available.
      target = buildCdnUrl(cloudflareImageId, "download");
    }
  } else if (cloudflareImageId) {
    target = buildCdnUrl(
      cloudflareImageId,
      tier === "print" ? "download" : "gallery",
    );
  }

  if (!target) {
    return NextResponse.json({ error: "No downloadable variant" }, { status: 404 });
  }

  return NextResponse.redirect(target, { status: 302 });
}
