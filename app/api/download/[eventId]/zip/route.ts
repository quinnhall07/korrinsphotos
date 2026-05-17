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
import { generatePresignedGetUrl }   from "@/lib/storage/r2";
import { verifyDownloadPin }         from "@/lib/db/events";
import { ZipArchive }                from "archiver";
import { Readable }                  from "stream";

// Phase 2.6 — Resolution tier picker.
// `web`      → CF Images `gallery` variant (~1200px wide, default).
// `print`    → CF Images `download` variant (~2048px wide).
// `original` → presigned R2 GET URL against `r2Key` / `storageKey`. Falls
//              back to `download` per-photo if neither key exists; the
//              archive's MANIFEST.txt records each fallback.
type ResolutionTier = "web" | "print" | "original";
const VALID_TIERS: ReadonlySet<ResolutionTier> = new Set(["web", "print", "original"]);

function parseResolution(input: string | null): ResolutionTier {
  if (input && VALID_TIERS.has(input as ResolutionTier)) {
    return input as ResolutionTier;
  }
  return "web";
}

function variantForTier(tier: Exclude<ResolutionTier, "original">) {
  return tier === "print" ? "download" : "gallery";
}

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

export async function POST(req: NextRequest, { params }: Params) {
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

  // Phase 2.6 — Per-event download PIN gate. Admin sessions still must
  // satisfy the PIN when one is set; that's a deliberate "preview-as-client"
  // check that catches a bad PIN before it ships to a real client.
  const url = new URL(req.url);
  const suppliedPin = url.searchParams.get("pin");
  const pinCheck = await verifyDownloadPin(eventId, suppliedPin);
  if (pinCheck.required && !pinCheck.ok) {
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  const tier = parseResolution(url.searchParams.get("resolution"));

  // Pull the photo list.
  const snap = await adminDb
    .collection("events")
    .doc(eventId)
    .collection("photos")
    .where("galleryReady", "==", true)
    .orderBy("uploadedAt", "asc")
    .get();

  // For each photo, resolve the URL appropriate to the requested tier.
  // `original` requires an R2 key (`r2Key` for single-PUT, `storageKey` for
  // multipart). If neither exists we fall back to the `download` variant per
  // photo and note it in the manifest text file at the end of the archive.
  const fallbackNotes: string[] = [];
  const photos: { id: string; url: string; label: string | null }[] = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    const cloudflareImageId = data.cloudflareImageId as string | undefined;
    const r2Key =
      (data.r2Key as string | undefined) ??
      (data.storageKey as string | undefined) ??
      null;

    let url: string | null = null;
    if (tier === "original") {
      if (r2Key) {
        try {
          url = await generatePresignedGetUrl(r2Key, 3600);
        } catch (err) {
          console.error("[download/zip] presign failed", { id: doc.id, err });
        }
      }
      if (!url) {
        // Fall back to the print variant if we have a Cloudflare image id.
        if (cloudflareImageId) {
          url = buildCdnUrl(cloudflareImageId, "download");
          fallbackNotes.push(
            `${doc.id}: no R2 original available, exported "print" variant instead.`,
          );
        }
      }
    } else {
      if (cloudflareImageId) {
        url = buildCdnUrl(cloudflareImageId, variantForTier(tier));
      }
    }

    if (!url) continue;
    photos.push({
      id: doc.id,
      url,
      label: (data.label as string | undefined) ?? null,
    });
  }

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

      // Phase 2.6 — drop a MANIFEST.txt at the root of the zip describing the
      // tier the user picked and any per-photo fallbacks (e.g. `original`
      // tier with no R2 key falls back to `print`).
      const manifestLines = [
        `Gallery: ${eventTitle}`,
        `Resolution tier requested: ${tier}`,
        `Photos exported: ${photos.length}`,
        "",
        fallbackNotes.length === 0
          ? "All photos exported at the requested tier."
          : "Fallbacks:",
        ...fallbackNotes,
      ];
      archive.append(Buffer.from(manifestLines.join("\n"), "utf8"), {
        name: "MANIFEST.txt",
      });

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

  const filename = `${sanitiseFilename(eventTitle)}-${tier}.zip`;

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
