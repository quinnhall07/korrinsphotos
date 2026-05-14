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

### `eventAccess` Doc ID

`DECISION.md` ADR-009 fixes the composite ID format as `${userId}_${eventId}`
(uid first, then eventId). All call sites — `lib/db/event-access.ts`
(grant/revoke/has), `app/gallery/[id]/page.tsx`, `app/api/invite/route.ts`,
`app/admin/events/[id]/actions.ts`, and `lib/project-transitions.ts` — now
agree on this order. Do not flip it back.

---

## Photo Fetch

`[id]/page.tsx` → `getEventPhotos(eventId)` reads the **subcollection**
`events/{eventId}/photos`, filtered by `where("galleryReady", "==", true)`
and ordered by `uploadedAt asc`. It does **not** use `lib/db/photos.ts`
(which queries a different top-level `photos` collection). The combination
of `where` + `orderBy` on different fields requires a Firestore composite
index — if you see an index error in logs, follow the link in the error to
create it.

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
