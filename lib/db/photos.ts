import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

/**
 * Photo document shape — written to both the top-level `photos` collection
 * (portfolio) and the per-event subcollection at `events/{eventId}/photos`
 * (galleries). The subcollection is read directly via `adminDb` in
 * `app/gallery/[id]/page.tsx`, `lib/domain/events.ts`, and the various
 * `/admin/events/[id]/**` pages — but this interface remains the source of
 * truth for the field shape.
 *
 * `favoritedBy` is the Phase 2.5 proofing field — an array of `clientId`s
 * (the same `clients/{id}` ID used elsewhere in the lifecycle) for clients
 * who have favorited the photo from the public gallery viewer. Writes go
 * through `FieldValue.arrayUnion` / `arrayRemove` in
 * `app/gallery/[id]/actions.ts > toggleFavorite`.
 *
 * `tags` is the Phase 2.5 + 2.10 + 13.5 reserved tag set. v1 reserves the
 * following values (string union enforcement deliberately omitted so admins
 * can attach arbitrary metadata in the future):
 *
 *   - `"korrinsPick"` — Phase 13.5. Toggled from the admin gallery editor.
 *     Public gallery surfaces a "Just show me Korrin's favorites" filter pill
 *     that filters to photos with `tags array-contains "korrinsPick"`.
 *   - `"sneakPeek"` — Phase 2.10. Drives the cron-fired 48h post-shoot
 *     sneak-peek email (already consumed by `/api/cron/run-tasks`).
 *   - `"download"` — Phase 2.5 reserved. Marks a photo as eligible for the
 *     full-resolution download bundle (not yet enforced — all gallery-ready
 *     photos download today).
 *   - `"featured"` — Phase 2.5 reserved. Earmarks a hero/cover photo for
 *     portal surfaces (Timeline, anniversary card, etc).
 *
 * Additional ad-hoc tags are allowed.
 */
export interface PhotoDoc {
  id: string;
  eventId: string;
  cloudflareUrl: string;
  cloudflareImageId: string;
  /** R2 key for the original object (single-PUT pipeline). Used for cleanup on delete. */
  r2Key?: string;
  /** R2 key for the original object (multipart pipeline). Used for cleanup on delete. */
  storageKey?: string;
  label?: string;
  category?: string;
  /** Visible to the client in `/gallery/[id]` once `true`. Toggled in the admin gallery editor. */
  galleryReady?: boolean;
  /** Phase 2.5 — clientIds that favorited this photo. Written via `arrayUnion` / `arrayRemove`. */
  favoritedBy?: string[];
  /** Phase 2.5 / 2.10 / 13.5 — reserved tags: `korrinsPick`, `sneakPeek`, `download`, `featured`. */
  tags?: string[];
  /**
   * Phase 13.10 — Per-photo client-gallery analytics. All three counters are
   * incremented via `FieldValue.increment(1)` from public tracking endpoints
   * (`/api/track/photo-view`, `/api/track/photo-download`). Re-mounts and
   * scroll-back can over-count `viewCount` slightly — that's acceptable; we
   * use it as a popularity proxy, not an exact metric.
   */
  viewCount?: number;
  downloadCount?: number;
  lastViewedAt?: Timestamp;
  uploadedAt: Timestamp;
}

/**
 * Phase 13.10 — Increment a photo's `viewCount` and stamp `lastViewedAt`.
 *
 * Bot guard / rate-limiting is performed by the caller (the public tracking
 * endpoint). This helper is a thin Firestore atom — it assumes the caller
 * has already accepted the request. Best-effort: a missing photo doc just
 * fails the increment silently (we never throw to the public client).
 */
export async function incrementPhotoView(
  eventId: string,
  photoId: string,
): Promise<void> {
  const ref = adminDb
    .collection("events")
    .doc(eventId)
    .collection("photos")
    .doc(photoId);
  await ref.update({
    viewCount: FieldValue.increment(1),
    lastViewedAt: Timestamp.now(),
  });
}

/**
 * Phase 13.10 — Increment a photo's `downloadCount`.
 *
 * Same caller-trust contract as `incrementPhotoView`.
 */
export async function incrementPhotoDownload(
  eventId: string,
  photoId: string,
): Promise<void> {
  const ref = adminDb
    .collection("events")
    .doc(eventId)
    .collection("photos")
    .doc(photoId);
  await ref.update({
    downloadCount: FieldValue.increment(1),
  });
}

/**
 * Wave 10 — Generic in-place metadata update for a single photo.
 *
 * Used by the admin event detail UI to edit `label` / `category` /
 * `galleryReady` / `tags` after upload without touching CDN-derived fields
 * (`cloudflareUrl`, `cloudflareImageId`, `r2Key`, `storageKey`, view counters,
 * etc). Uses `update()` (not `set()`) so all other fields are preserved.
 *
 * Pass `null` to clear an optional field (`label: null`, `category: null`).
 */
type UpdatablePhotoFields = Pick<PhotoDoc, "label" | "category" | "galleryReady" | "tags">;
type PhotoUpdatePartial = {
  [K in keyof UpdatablePhotoFields]?: UpdatablePhotoFields[K] | null;
};

export async function updatePhoto(
  eventId: string,
  photoId: string,
  partial: PhotoUpdatePartial,
): Promise<void> {
  const ref = adminDb
    .collection("events")
    .doc(eventId)
    .collection("photos")
    .doc(photoId);

  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(partial)) {
    payload[key] = value === null ? FieldValue.delete() : value;
  }
  if (Object.keys(payload).length === 0) return;

  await ref.update(payload);
}
