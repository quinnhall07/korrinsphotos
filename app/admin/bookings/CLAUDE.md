# CLAUDE.md — /admin/bookings

> **Legacy Kanban.** This view reads `bookingInquiries`. New CRM work should target `/admin/projects` (canonical state machine — see `app/admin/projects/CLAUDE.md`). Keep this directory functional until the dual-write retirement completes; see PROGRESS.md "In-flight".

Root conventions (auth guard, server/client boundary, env): see root CLAUDE.md.

---

## Data Flow

```
public booking form → app/booking/actions.ts → submitBooking()
                                 │
                  ┌──────────────┴──────────────┐
                  ▼                             ▼
       clients/ + projects/ (NEW)      bookingInquiries/ (LEGACY)
                  │                             │
                  ▼                             ▼
        /admin/projects                /admin/bookings (this dir)
```

The dual write is intentional and temporary. Any change to the legacy shape (status enum, tag vocabulary, lead-score weighting) MUST be mirrored in the new pipeline or the two views drift apart.

## Kanban Columns

`lib/booking-kanban.ts` is the single source of truth for the column model:

| Export | Purpose |
|---|---|
| `LeadStatus` | Union of `PENDING \| QUALIFIED \| SENT_PROPOSAL \| CONTRACT_SENT \| BOOKED \| ARCHIVED` |
| `KANBAN_STATUSES` | Visible columns + badge styles (note: `ARCHIVED` is in `ALL_STATUSES` but NOT in the visible board) |
| `LeadSource` | `WEBSITE \| INSTAGRAM \| REFERRAL \| GOOGLE \| OTHER` |
| `PRESET_TAGS` | Preset chip vocabulary for the tag selector |

`lib/db/bookings.ts` re-exports the three type unions so callers can import either path. The `BookingInquiryDoc` interface lives there and is what `calculateLeadScore` is typed against.

## Actions

| File | Exports | Notes |
|---|---|---|
| `inquiry-actions.ts` | `updateBookingStatus`, `updateBookingDetails`, `updateLeadSource`, `setFollowUpDate`, `deleteBookingInquiry`, `createBookingInquiry`, `linkEventToInquiry` | Status transition auto-creates an Event when status becomes `BOOKED` and the inquiry has no `eventId` yet. Mirrors `handleProjectTransition`'s booked side effect — see gotcha below. |
| `comms-actions.ts` | `logCommunication`, `deleteCommunicationLog`, `sendBookingResponse` | Adds entries to the `communicationLog[]` array on the inquiry doc (NOT a subcollection). `sendBookingResponse` writes to the Firebase Trigger Email `mail` collection and auto-promotes `PENDING → QUALIFIED`. |
| `tag-actions.ts` | Tag mutations | Recompute lead score on tag changes. |

## Lead Score Recalculation

`calculateLeadScore()` from `lib/lead-scoring.ts` must be recomputed whenever any scoring input changes: `tags`, `estimatedValue`, `sessionType`, `message`, `preferredDate`, `leadSource`. See `updateBookingDetails` (estimatedValue branch) and `updateLeadSource` (always recomputes) in `inquiry-actions.ts` for the pattern — re-read the doc after mutation, score it, write the score back.

## Gotchas

- **Double event creation:** `updateBookingStatus(id, "BOOKED")` in this directory creates an `events/{id}` doc directly. The new pipeline does the same in `lib/project-transitions.ts > onProjectBooked`. While dual-write is live, BOTH paths must remain idempotent. The legacy path guards with `!data.eventId`; preserve that guard.
- `revalidatePath("/admin")` is required after status mutations because the dashboard reads `bookingInquiries` counts.
- `BookingsClientPage.tsx`, `KanbanBoard.tsx`, `LeadDetailDrawer.tsx`, etc. are all `"use client"` — they receive serialised plain-JSON props from `page.tsx`, never raw Firestore Timestamps.
