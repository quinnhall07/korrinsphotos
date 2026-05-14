// app/api/download/[eventId]/favorites/route.ts
// Phase 2.5 — Streams a ZIP archive of every photo a client has favorited in
// the given event. Mirrors the public `/zip` route but filters the photo set
// by `favoritedBy.length > 0`.
//
// Auth: ADMIN only. Korrin is the consumer ("send me what they picked"); no
// client-facing download URL is generated. If we later want clients to
// re-download just their own picks, add a separate client-scoped variant.
//
// Implementation notes: identical streaming pipeline to
// `/api/download/[eventId]/zip` — `archiver` v8 ESM `ZipArchive`, store-only
// (no recompression), 200-photo cap, 5-minute maxDuration.

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin }              from "@/lib/session";
import { adminDb }                   from "@/lib/firebase-admin";
import { buildCdnUrl }               from "@/lib/storage/images";
import { ZipArchive }                from "archiver";
import { Readable }                  from "stream";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";
export const maxDuration = 300;

const MAX_PHOTOS_PER_ZIP = 200;

type Params = { params: Promise<{ eventId: string }> };

function sanitiseFilename(input: string): string {
  return input
    .replace(/[\/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "picks";
}

function extensionFromContentType(contentType: string | null): string {
  if (!contentType) return "jpg";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("heic")) return "heic";
  if (contentType.includes("avif")) return "avif";
  return "jpg";
}

export async function POST(_req: NextRequest, { params }: Params) {
  const { eventId } = await params;
  await requireAdmin();

  const eventDoc = await adminDb.collection("events").doc(eventId).get();
  if (!eventDoc.exists) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  const eventTitle = (eventDoc.data()?.title as string | undefined) ?? "gallery";

  // Pull every photo in the event, then filter to ones with at least one
  // favoriting client. We intentionally do NOT require `galleryReady` —
  // clients can only favorite gallery-ready photos, but admins may have
  // since toggled `galleryReady` off; the picks export should still capture
  // everything that was ever favorited.
  const snap = await adminDb
    .collection("events")
    .doc(eventId)
    .collection("photos")
    .orderBy("uploadedAt", "asc")
    .get();

  const photos = snap.docs
    .map((doc) => {
      const data = doc.data();
      const cloudflareImageId = data.cloudflareImageId as string | undefined;
      const favoritedBy = (data.favoritedBy as string[] | undefined) ?? [];
      if (!cloudflareImageId) return null;
      if (favoritedBy.length === 0) return null;
      return {
        id: doc.id,
        url: buildCdnUrl(cloudflareImageId, "download"),
        label: (data.label as string | undefined) ?? null,
        favoriteCount: favoritedBy.length,
      };
    })
    .filter(
      (p): p is { id: string; url: string; label: string | null; favoriteCount: number } =>
        p !== null
    );

  if (photos.length === 0) {
    return NextResponse.json({ error: "No client picks yet." }, { status: 404 });
  }

  if (photos.length > MAX_PHOTOS_PER_ZIP) {
    return NextResponse.json(
      {
        error: `Too many picks to export in a single zip (${photos.length}). The limit is ${MAX_PHOTOS_PER_ZIP}.`,
      },
      { status: 413 }
    );
  }

  const archive = new ZipArchive({ store: true });

  const filenameUsed = new Set<string>();
  const appendPromise = (async () => {
    try {
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        const res = await fetch(photo.url);
        if (!res.ok || !res.body) {
          console.error(
            `[favorites/zip] Failed to fetch photo ${photo.id}: ${res.status} ${res.statusText}`
          );
          continue;
        }

        const ext = extensionFromContentType(res.headers.get("content-type"));
        const baseLabel =
          photo.label?.trim() ||
          `pick-${String(i + 1).padStart(3, "0")}-${photo.favoriteCount}fav`;
        let name = `${sanitiseFilename(baseLabel)}.${ext}`;
        let n = 2;
        while (filenameUsed.has(name)) {
          name = `${sanitiseFilename(baseLabel)}-${n}.${ext}`;
          n++;
        }
        filenameUsed.add(name);

        const nodeStream = Readable.fromWeb(
          res.body as Parameters<typeof Readable.fromWeb>[0]
        );
        archive.append(nodeStream, { name });
      }
      await archive.finalize();
    } catch (err) {
      console.error("[favorites/zip] Archive build failed:", err);
      archive.abort();
    }
  })();
  appendPromise.catch((err) =>
    console.error("[favorites/zip] appendPromise rejected:", err)
  );

  const webStream = new ReadableStream({
    start(controller) {
      archive.on("data", (chunk: Buffer) => {
        try {
          controller.enqueue(new Uint8Array(chunk));
        } catch {
          /* controller may already be closed */
        }
      });
      archive.on("end", () => {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
      archive.on("warning", (err: Error) => {
        console.warn("[favorites/zip] archiver warning:", err);
      });
      archive.on("error", (err: Error) => {
        console.error("[favorites/zip] archiver error:", err);
        try {
          controller.error(err);
        } catch {
          /* already errored */
        }
      });
    },
    cancel() {
      archive.abort();
    },
  });

  const filename = `${sanitiseFilename(eventTitle)}-client-picks.zip`;

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
