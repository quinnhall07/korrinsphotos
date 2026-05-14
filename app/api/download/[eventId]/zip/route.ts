// app/api/download/[eventId]/zip/route.ts
// Streams a ZIP archive of every gallery-ready photo in an event.
//
// Auth: requireSession() + eventAccess/{uid}_{eventId} (admin override).
// Cap:  200 photos per request — anything larger returns 413.
//
// Implementation: streams the archive directly to the client via a
// `ReadableStream` so we never buffer the whole archive in memory.
// Each photo is fetched from the Cloudflare Images `download` variant
// and piped through `archiver` with `store` (no recompression — photos
// are already compressed, so deflate would burn CPU for no gain).
//
// `ZipArchive` is a named export of archiver v8 (ESM). The published
// `@types/archiver` is still on the v7 CJS shape; `types/archiver.d.ts`
// augments the module declaration so TS can see the class.

import { NextRequest, NextResponse } from "next/server";
import { requireSession }            from "@/lib/session";
import { adminDb }                   from "@/lib/firebase-admin";
import { buildCdnUrl }               from "@/lib/storage/images";
import { ZipArchive }                from "archiver";
import { Readable }                  from "stream";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";
export const maxDuration = 300; // up to 5 minutes for very large galleries

const MAX_PHOTOS_PER_ZIP = 200;

type Params = { params: Promise<{ eventId: string }> };

function sanitiseFilename(input: string): string {
  return input
    .replace(/[\/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "gallery";
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
  const session = await requireSession();

  // Auth: admins bypass, clients need an explicit eventAccess doc.
  if (session.role !== "ADMIN") {
    const accessId = `${session.uid}_${eventId}`;
    const accessDoc = await adminDb.collection("eventAccess").doc(accessId).get();
    if (!accessDoc.exists) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Load the event metadata for the filename.
  const eventDoc = await adminDb.collection("events").doc(eventId).get();
  if (!eventDoc.exists) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  const eventTitle = (eventDoc.data()?.title as string | undefined) ?? "gallery";

  // Pull the photo list.
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
      const cloudflareImageId = data.cloudflareImageId as string | undefined;
      if (!cloudflareImageId) return null;
      return {
        id: doc.id,
        url: buildCdnUrl(cloudflareImageId, "download"),
        label: (data.label as string | undefined) ?? null,
      };
    })
    .filter((p): p is { id: string; url: string; label: string | null } => p !== null);

  if (photos.length === 0) {
    return NextResponse.json({ error: "No photos available for download" }, { status: 404 });
  }

  if (photos.length > MAX_PHOTOS_PER_ZIP) {
    return NextResponse.json(
      {
        error: `Gallery is too large for a single zip (${photos.length} photos). Please contact us for a delivery link — the limit is ${MAX_PHOTOS_PER_ZIP} per request.`,
      },
      { status: 413 }
    );
  }

  // Build the archive. `store: true` skips recompression — photos
  // are already compressed, so deflate would just burn CPU.
  const archive = new ZipArchive({ store: true });

  // Pipe each remote photo into the archive sequentially. We fetch
  // sequentially so we don't open 200 concurrent sockets to the CDN
  // and so backpressure naturally flows from the response stream.
  const filenameUsed = new Set<string>();
  const appendPromise = (async () => {
    try {
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        const res = await fetch(photo.url);
        if (!res.ok || !res.body) {
          console.error(
            `[download/zip] Failed to fetch photo ${photo.id}: ${res.status} ${res.statusText}`
          );
          continue;
        }

        const ext = extensionFromContentType(res.headers.get("content-type"));
        const baseLabel = photo.label?.trim() || `photo-${String(i + 1).padStart(3, "0")}`;
        let name = `${sanitiseFilename(baseLabel)}.${ext}`;
        // Deduplicate filenames (labels can collide).
        let n = 2;
        while (filenameUsed.has(name)) {
          name = `${sanitiseFilename(baseLabel)}-${n}.${ext}`;
          n++;
        }
        filenameUsed.add(name);

        // Convert the WHATWG ReadableStream → Node Readable for archiver.
        const nodeStream = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]);
        archive.append(nodeStream, { name });
      }
      await archive.finalize();
    } catch (err) {
      console.error("[download/zip] Archive build failed:", err);
      archive.abort();
    }
  })();
  // Surface unhandled rejections in the build pipeline.
  appendPromise.catch((err) => console.error("[download/zip] appendPromise rejected:", err));

  // Bridge the Node Readable archiver stream → Web ReadableStream
  // so we can return it as the body of a `Response`.
  const webStream = new ReadableStream({
    start(controller) {
      archive.on("data", (chunk: Buffer) => {
        try {
          controller.enqueue(new Uint8Array(chunk));
        } catch {
          // controller may already be closed if client disconnected.
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
        console.warn("[download/zip] archiver warning:", err);
      });
      archive.on("error", (err: Error) => {
        console.error("[download/zip] archiver error:", err);
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

  const filename = `${sanitiseFilename(eventTitle)}.zip`;

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
