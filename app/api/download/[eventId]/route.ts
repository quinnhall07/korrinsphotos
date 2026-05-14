// app/api/download/[eventId]/route.ts
// Returns the list of gallery-ready photos for a given event with
// `download` variant CDN URLs. Used by the client when it wants to
// build its own custom download flow (e.g. per-photo download links).
//
// Auth: requireSession() + eventAccess/{uid}_{eventId} (admin override).

import { NextRequest, NextResponse } from "next/server";
import { requireSession }            from "@/lib/session";
import { adminDb }                   from "@/lib/firebase-admin";
import { buildCdnUrl }               from "@/lib/storage/images";

type Params = { params: Promise<{ eventId: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { eventId } = await params;
  const session = await requireSession();

  // Admins bypass the access doc; clients need an explicit grant.
  if (session.role !== "ADMIN") {
    const accessId = `${session.uid}_${eventId}`;
    const accessDoc = await adminDb.collection("eventAccess").doc(accessId).get();
    if (!accessDoc.exists) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const snap = await adminDb
    .collection("events")
    .doc(eventId)
    .collection("photos")
    .where("galleryReady", "==", true)
    .orderBy("uploadedAt", "asc")
    .get();

  const photos = snap.docs
    .map((doc) => {
      const data = doc.data();
      if (!data.cloudflareImageId) return null;
      return {
        id: doc.id,
        url: buildCdnUrl(data.cloudflareImageId as string, "download"),
        label: (data.label as string | undefined) ?? null,
      };
    })
    .filter((p): p is { id: string; url: string; label: string | null } => p !== null);

  return NextResponse.json({ photos });
}
