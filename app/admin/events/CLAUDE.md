# CLAUDE.md — /admin/events

Events are the **media-delivery sub-record** that hangs off a Project. They own the photo subcollection and the client-access grants that power `/gallery/[id]`.

Root conventions: see root CLAUDE.md. Upload pipeline (single-PUT vs multipart, `buildCdnUrl`): see root CLAUDE.md > "Image Upload Pipeline".

---

## Provenance — Auto vs Manual

The expected flow is automatic: when a project transitions to `BOOKED`, `lib/project-transitions.ts > onProjectBooked` writes an `events/{id}` doc with `projectId`, `clientId`, `title`, `shootDate`, `status: "UPCOMING"` and grants `eventAccess` in the same step.

The "Create Event" button in `page.tsx` (and `createEvent` in `actions.ts`) is the **legacy/manual** path — it creates a bare event with just `title` and timestamps. Useful for ad-hoc galleries that have no associated project, but most events should arrive via the project lifecycle. The legacy `updateBookingStatus(_, "BOOKED")` in `app/admin/bookings/inquiry-actions.ts` also auto-creates events; that branch will be removed when dual-write retires.

## Files

| File | Role |
|---|---|
| `page.tsx` | Lists all events with photo + access counts (parallel `count()` queries) |
| `[id]/page.tsx` | Detail page: TitleEditor, ShootDateEditor, UploadZone, InvitePanel, PhotoGrid, EventActions (danger zone) |
| `[id]/gallery/page.tsx` | Gallery preparation — toggle `galleryReady` flag per photo before client delivery |
| `[id]/gallery/actions.ts` | `toggleGalleryReady(eventId, photoIds[], galleryReady)` — batch update |
| `actions.ts` | `createEvent`, `deleteEvent`, `clearGallery` |
| `EventsTable.tsx`, `PhotoGrid.tsx`, etc. | Client components, receive serialised props |

## Schema

`lib/db/events.ts` `EventDoc`:

```
title, status ("UPCOMING" | "COMPLETED"), startDate, endDate,
startTime, endTime, isMultiDay, location,
bookingId? (legacy), clientEmail? (legacy), clientName? (legacy),
projectId? + clientId? (new, written by handleProjectTransition),
createdAt, updatedAt
```

Photos live at `events/{id}/photos/{photoId}` with `cloudflareImageId`, `r2Key`/`storageKey`, `label`, `category`, `galleryReady`, `uploadedAt`, `status`, `isRaw`. The public gallery filters by `galleryReady === true` — admins toggle this in `[id]/gallery/`.

## Cross-Collection Operations

Anything that touches more than one collection lives in `lib/domain/events.ts`, NOT in `actions.ts`:

| Function | Cleans up |
|---|---|
| `deleteEventAndAssets(eventId)` | Photos subcollection + Cloudflare Images + R2 objects + `eventAccess` docs + the event itself |
| `clearEventGallery(eventId)` | Same as above except keeps the event doc and bumps `updatedAt` |

Both use `Promise.allSettled` for external deletes and batch the Firestore deletes. External deletes are best-effort — Firestore is the source of truth, so an orphaned CF Image is acceptable but a stale Firestore reference is not. `actions.ts > deleteEvent` and `clearGallery` are thin wrappers that add `await requireAdmin()` + `revalidatePath`.

## Gotchas

- `EventDoc.shootDate` does not exist on the type; the detail page reads `startDate` / `endDate` / `startTime` / `endTime` as separate string fields. `handleProjectTransition` writes `shootDate` (Timestamp) when auto-creating from a project — the type definition needs to absorb that field.
- Photo subcollection counts use `.count().get()` (cheap). Do not iterate `.docs` just to count.
- `revalidatePath` both `/admin/events` and `/admin` after destructive ops — the dashboard reads event counts.
