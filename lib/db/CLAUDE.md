# CLAUDE.md — `lib/db/`

> Canonical Firestore persistence layer. Read root `CLAUDE.md` and `lib/CLAUDE.md` first.
> Re-read this file before adding a new collection or a new query.

---

## Shape

One file per Firestore collection. Every module follows the same skeleton:

```ts
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export interface FooDoc { id: string; /* ... */ createdAt: Timestamp; updatedAt: Timestamp; }

export const fooCol = () => adminDb.collection("foos");

export async function getFoo(id: string): Promise<FooDoc | null> { /* ... */ }
export async function listFoos(): Promise<FooDoc[]> { /* ... */ }
export async function createFoo(data: Omit<FooDoc, "id" | "createdAt" | "updatedAt">): Promise<FooDoc> { /* ... */ }
export async function updateFoo(id: string, data: Partial<FooDoc>): Promise<void> { /* ... */ }
```

Every module exports:

- A typed `<Collection>Doc` interface — the canonical schema for that collection.
- A `<collection>Col()` getter that returns the underlying `CollectionReference` (lets callers compose ad-hoc queries without leaking the collection path).
- Pure async helpers — `get`, `list`, `create`, `update`, plus collection-specific reads (e.g. `getClientByEmail`, `getProjectsByClientId`, `listPublicPhotos`).

The Firestore handle is always the `adminDb` singleton from `lib/firebase-admin.ts`. Helpers use `Timestamp.now()` for write-time stamps and `FieldValue.serverTimestamp()` for `updatedAt`.

---

## Server-only

These modules are server-only. They import `lib/firebase-admin.ts`, which initialises the Admin SDK with service-account credentials. NEVER import any `lib/db/*` file from a `"use client"` component, a hook, or anything in `app/**` marked with `"use client"`. Use server components, server actions, or API routes as the entry point.

---

## HARD RULE: no aggregator

NEVER reintroduce a `lib/firestore.ts` (or `lib/db/index.ts`) that re-exports everything. The split is deliberate — see `DECISION.md` ADR-013. An aggregator pulls every collection's types into every consumer's bundle and re-opens the server/client boundary holes that the split closed. Import directly from `@/lib/db/<collection>` at the call site.

---

## Adding a new collection

1. Create `lib/db/<collection>.ts` following the module shape above.
2. Type the `Doc` interface against the actual Firestore document fields. Mark optional fields with `?` and nullable Firestore fields as `T | null`.
3. Expose only the queries you actually use. Add new ones at call time, not pre-emptively.
4. If the collection participates in the Client/Project lifecycle, document the schema in `docs/architecture/unified-client-lifecycle.md` and add a row to the Firestore data model table in root `CLAUDE.md`.
5. If the new collection requires a composite index, follow the Firestore link in the error log to create it; record any non-obvious index in root `CLAUDE.md` > "Known Gotchas".

---

## Existing modules

| File | Collection | One-liner |
|---|---|---|
| `activity.ts` | `activityFeed` | Append-only feed for admin dashboard; `logActivity` + `listRecentActivity`. |
| `bookings.ts` | `bookingInquiries` | Legacy CRM lead doc. Read by `/admin/bookings` Kanban. Re-exports `LeadStatus`/`LeadSource`/`CommunicationChannel` from `lib/booking-kanban`. |
| `clients.ts` | `clients` | Universal Client record (email = unique). Includes referral + first-touch attribution fields. `generateReferralCode()` lives here. |
| `contracts.ts` | `contracts` | Per-project signed agreements; `DRAFT|SENT|SIGNED|VOIDED`. |
| `event-access.ts` | `eventAccess` | Per-client gallery access grants. Composite ID `${eventId}_${userId}`. |
| `events.ts` | `events` | Event/shoot record. Photos live in the `events/{id}/photos` subcollection (NOT the flat `photos` collection). |
| `invoices.ts` | `invoices` | `DEPOSIT|BALANCE|FULL` invoices with Stripe payment link metadata. |
| `mail.ts` | `mail` | Firebase Trigger Email queue. `sendEmail(to, subject, html)` just enqueues; the extension delivers. |
| `photos.ts` | `photos` | Flat `photos` collection used by `listPublicPhotos` (portfolio). Per-event photos live under `events/{id}/photos` and are read directly via `adminDb` in `lib/domain/events.ts`. |
| `projects.ts` | `projects` (+ `projects/{id}/messages`) | Master state machine: `ProjectStatus`, `ProjectDoc`, `MessageDoc`, `projectMessagesCol()`. |
| `users.ts` | `users` | Firebase Auth user mirror with `role: "ADMIN" | "CLIENT"`. `upsertUser` runs inside a transaction. |

---

## Conventions

- Return `null` for not-found, not a throw — callers expect optional reads.
- `update*` returns `void`; do not echo back the document.
- Use `FieldValue.serverTimestamp()` for `updatedAt`; use `Timestamp.now()` for write-time fields on creation when you need to read the value back immediately.
- Pair `where("field", "!=", null)` with `orderBy("field")` before any secondary `orderBy` — see `listPublicPhotos` in `photos.ts`.
- Count queries use `.count().get()` (e.g. `countPhotos`, `countEventAccess`, `countBookingInquiries`).
