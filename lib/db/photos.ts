import type { Timestamp } from "firebase-admin/firestore";

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
  uploadedAt: Timestamp;
}
