# CLAUDE.md — `app/gallery`

Client photo portal.

| File | Role |
|---|---|
| `layout.tsx` | `await requireSession()` gate for every `/gallery/**` route |
| `page.tsx` | Dashboard listing every event the user has access to |
| `[id]/page.tsx` | Per-event gallery — second auth layer + photo fetch |
| `[id]/GalleryViewer.tsx` | `"use client"` shell around `MasonryGrid` + download bar |

---

## Two-Layer Auth

1. **Edge cookie presence.** `middleware.ts` redirects to `/login` if
   `__session` is missing. The Edge runtime cannot verify the cookie.
2. **Server session + access doc.** `[id]/page.tsx` calls `requireSession()`
   (Admin SDK verifies the cookie), then reads `eventAccess/{accessId}`.
   Admins (`session.role === "ADMIN"`) bypass; clients without a matching
   doc receive `notFound()`.

### `eventAccess` Doc ID — Drift to Resolve

`DECISION.md` ADR-009 declares the composite ID format set in stone, but the
codebase currently has two conventions:

| Location | Format |
|---|---|
| `lib/db/event-access.ts` (grant/revoke/has) | `${eventId}_${userId}` |
| `app/gallery/[id]/page.tsx` line ~51 | `${session.uid}_${id}` → `${userId}_${eventId}` |

These do not match. Granted access docs will be missed by the gallery lookup
unless one side is corrected. Before touching either path, confirm ADR-009's
format and bring both sides into alignment in the same change — `eventAccess`
is read by multiple call sites.

---

## Photo Fetch

`[id]/page.tsx` → `getEventPhotos(eventId)` reads the **subcollection**
`events/{eventId}/photos`, ordered by `uploadedAt asc`. It does **not** use
`lib/db/photos.ts` (which queries a different top-level `photos` collection).

The gallery currently shows **every photo in the subcollection** — no
`galleryReady` or `status` filter is applied. Photos uploaded but not yet
marked ready appear immediately. If filtering is desired, add it here and
align `lib/db/photos.ts` with the subcollection schema.

The dashboard `page.tsx` similarly reads `events/{id}/photos` directly via
`adminDb` for `photoCount` and a cover photo (first by `uploadedAt asc`).

---

## Image URLs

All URLs come from `buildCdnUrl(cloudflareImageId, variant)` from
`@/lib/cloudflare`:

| Variant | Used at |
|---|---|
| `"thumbnail"` | Dashboard cover thumbs + grid tiles |
| `"gallery"` | Full-size gallery + lightbox source |

**Never** expose raw R2 URLs or `cloudflareUrl` directly. Photos without
`cloudflareImageId` fall through to a "Coming soon" placeholder.

---

## Image Protection

Every viewer `<img>` applies:

- `onContextMenu={(e) => e.preventDefault()}` — blocks right-click save.
- `draggable={false}` — blocks drag-to-desktop.
- `pointerEvents: "none"` + `userSelect: "none"` for dashboard covers.

Advisory only — not security. Real protection is the access-doc check above
plus CDN delivery. Any new client-facing image MUST replicate the pattern.

The "Request Full Download" button in `GalleryViewer.tsx` currently only
toasts. When the email-link delivery path lands, add a Server Action and
call it from `requestDownload()`.
