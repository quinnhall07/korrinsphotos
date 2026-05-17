# CLAUDE.md — `lib/domain/`

> Cross-collection orchestrations. Read root `CLAUDE.md` and `lib/CLAUDE.md` first.
> Re-read this file before adding a new file here or before moving a multi-collection delete out of a `db/` module.

---

## Purpose

`lib/domain/` is for operations that span multiple `lib/db/` modules and/or external storage. Functions here read and write across collection boundaries, often with batch operations and best-effort external cleanup.

Each function in this directory is server-only and importable from Server Components, Server Actions, and API routes — never from a `"use client"` file. They use the `adminDb` singleton directly (and call into `lib/storage/*` via the `lib/cloudflare.ts` re-export facade for now).

---

## Existing files

### `events.ts`

Cross-collection lifecycle for an Event and its assets.

- `deleteEventAndAssets(eventId)` — fully removes an event:
  1. Reads `events/{id}/photos`.
  2. Best-effort deletes each photo's Cloudflare Images asset (`deleteFromCloudflareImages`) and R2 object (`deleteFromR2`); failures are logged, not thrown.
  3. Batch-deletes the `events/{id}/photos` subcollection.
  4. Batch-deletes every matching `eventAccess` document.
  5. Deletes the `events/{id}` document.

- `clearEventGallery(eventId)` — same as above but stops short of deleting the event document, then bumps `updatedAt` via `FieldValue.serverTimestamp()`. Used to "wipe" a gallery without losing the booking shell.

Both functions wrap external deletes in `try/catch` per asset and use `Promise.allSettled` so a single Cloudflare failure does not abort the run. Both write through `adminDb.batch()` for the Firestore deletes.

---

## When to add a file here

Add a new file in `lib/domain/` when an operation:

- Touches two or more `lib/db/` collections, OR
- Touches a `lib/db/` collection plus external storage (`lib/storage/*`), OR
- Logically sits above a single collection's API and would force a `db/` module to import from another `db/` module.

If the operation lives entirely inside one collection, it belongs in that collection's `lib/db/<name>.ts` file instead. If the operation is a single-call wrapper that does not orchestrate anything, it does not need its own file.

---

## Not here: status-driven lifecycle hooks

Project-status side effects (auto-create Event on `BOOKED`, queue referral email on `GALLERY_DELIVERED`, etc.) live in **`lib/project-transitions.ts`**, NOT in this directory. The distinction:

- `lib/domain/*` — ad-hoc cross-collection operations triggered by admin actions (delete this event, wipe this gallery).
- `lib/project-transitions.ts` — declarative reactions to `ProjectStatus` changes, coordinated through `handleProjectTransition(projectId, fromStatus, toStatus)`.

If you find yourself writing "when status moves to X, do Y", put it in `project-transitions.ts`. If you are writing "when an admin clicks Delete, tear down N collections", put it here.

---

## Conventions

- External deletes are best-effort: wrap in `try { } catch { console.error(...) }`, never throw out of an asset cleanup loop.
- Firestore deletes use `adminDb.batch()`; commit only when there is at least one queued delete.
- Always finish with a final document write or delete so the user-visible state reflects the operation atomically from the UI's perspective.
- These functions return `Promise<void>` — surface success/failure through the calling Server Action's return contract, not through this layer.
