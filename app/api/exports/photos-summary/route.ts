// app/api/exports/photos-summary/route.ts
// Wave 11 — Per-event photo summary CSV.
//
// One row per event:
//   eventId, eventTitle, photoCount, galleryReadyCount, favoritesCount,
//   viewCount, downloadCount.
//
// Strategy choice: a single `collectionGroup("photos")` read + group-by in
// memory is roughly N reads where N = total photos in the studio. Sequential
// per-event reads would be E reads (one count per event) PLUS a second read
// per event to sum counters — strictly worse. We pay the one-shot scan cost
// and aggregate in memory. At studio scale (<<100k photos) this is fine.

import { requireAdmin } from "@/lib/session";
import { adminDb } from "@/lib/firebase-admin";
import { eventsCol, type EventDoc } from "@/lib/db/events";
import type { PhotoDoc } from "@/lib/db/photos";
import { rowsToCsv, csvFilename } from "@/lib/csv";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = [
  "eventId",
  "eventTitle",
  "photoCount",
  "galleryReadyCount",
  "favoritesCount",
  "viewCount",
  "downloadCount",
];

interface PhotoAggregate {
  photoCount: number;
  galleryReadyCount: number;
  favoritesCount: number;
  viewCount: number;
  downloadCount: number;
}

function emptyAgg(): PhotoAggregate {
  return {
    photoCount: 0,
    galleryReadyCount: 0,
    favoritesCount: 0,
    viewCount: 0,
    downloadCount: 0,
  };
}

export async function GET(): Promise<Response> {
  await requireAdmin();

  try {
    const [eventSnap, photoSnap] = await Promise.all([
      eventsCol().get(),
      adminDb.collectionGroup("photos").get(),
    ]);

    const events: EventDoc[] = eventSnap.docs.map(
      (d) => ({ id: d.id, ...d.data() } as EventDoc),
    );

    // Group photos by their parent event id (the document path is
    // `events/{eventId}/photos/{photoId}`, so the parent of the parent is
    // the event doc).
    const aggByEventId = new Map<string, PhotoAggregate>();
    for (const photoDoc of photoSnap.docs) {
      const parentEventId = photoDoc.ref.parent.parent?.id;
      if (!parentEventId) continue;

      const photo = photoDoc.data() as Omit<PhotoDoc, "id">;
      const agg = aggByEventId.get(parentEventId) ?? emptyAgg();
      agg.photoCount += 1;
      if (photo.galleryReady) agg.galleryReadyCount += 1;
      if (Array.isArray(photo.favoritedBy)) {
        agg.favoritesCount += photo.favoritedBy.length;
      }
      agg.viewCount += typeof photo.viewCount === "number" ? photo.viewCount : 0;
      agg.downloadCount +=
        typeof photo.downloadCount === "number" ? photo.downloadCount : 0;
      aggByEventId.set(parentEventId, agg);
    }

    // One row per known event; events with zero photos still appear with
    // zero counters, which is the most useful default for spotting empty
    // galleries.
    const rows = events
      .map((e) => {
        const agg = aggByEventId.get(e.id) ?? emptyAgg();
        return [
          e.id,
          e.title ?? "",
          agg.photoCount,
          agg.galleryReadyCount,
          agg.favoritesCount,
          agg.viewCount,
          agg.downloadCount,
        ] as const;
      })
      .sort((a, b) => Number(b[2]) - Number(a[2]));

    const body = rowsToCsv(HEADERS, rows);

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${csvFilename("photos-summary")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[exports/photos-summary] read failed:", err);
    return new Response("Failed to read photos summary.", { status: 500 });
  }
}
