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
| `clients.ts` | `clients` | Universal Client record (email = unique). Referral fields (`referralCode`, `referralCount`, `referralTier`, `referralRewardsLog`, `referralAttributions`, `referralCredit`, `referredBy`) + first-touch attribution. `generateReferralCode()` lives here. |
| `contracts.ts` | `contracts` | Per-project signed agreements; `DRAFT|SENT|SIGNED|VOIDED`; token-validated signing flow stores `signingToken`, `tokenExpiresAt`, `signerIp`/`signerUserAgent`, `signedPdfR2Key`. |
| `email-events.ts` | `emailEvents` | Open / click / sent / bounced / unsub tracking rows written by `lib/email/tracking.ts > enqueueTrackedMail`. |
| `events.ts` | `events` | Event/shoot record. Canonical `EventStatus = UPCOMING|ACTIVE|COMPLETED|DELIVERED|ARCHIVED`. Photos live in the `events/{id}/photos` subcollection. |
| `inbox.ts` | `inboxItems` | Aggregated triage feed (inquiries / payments / signings / disputes / refunds / unmatched mail). |
| `invoices.ts` | `invoices` | `DEPOSIT|BALANCE|FULL` invoices with Stripe payment link metadata + refund/dispute ledger fields (`refundCents`, `disputeStatus`, etc.). |
| `locations.ts` | `locations` | Reusable shoot-location records (schema reserved for Phase 3.5). |
| `photos.ts` | `photos` | Flat `photos` collection used by `listPublicPhotos` (portfolio). Per-event photos live under `events/{id}/photos` and are read directly via `adminDb` in `lib/domain/events.ts`. |
| `projects.ts` | `projects` (+ `projects/{id}/messages`) | Master state machine: `ProjectStatus`, `ProjectDoc`, `MessageDoc`, `CommunicationChannel`, `projectMessagesCol()`. |
| `questionnaires.ts` | `questionnaireTemplates` + `questionnaires` | Templates (one per session type) + per-project instances (`PENDING`/`COMPLETED`). 5 seeded defaults. |
| `reviews.ts` | `reviewRequests` | Multi-step (Google → Knot → Facebook) review request rows fanned out on NPS ≥ 4. |
| `saved-views.ts` | `users/{uid}/views` | Per-admin saved pipeline filters (5 built-in defaults stay static in code). |
| `segments.ts` | `segments` | Saved-predicate audience definitions (schema reserved for Phase 4.3). |
| `sequence-enrollments.ts` | `sequenceEnrollments` | Per-client active drip state consumed by `runDueSequences` in the cron worker. |
| `sequences.ts` | `sequences` | Reusable email/SMS drip definitions (status-triggered + date-triggered). |
| `users.ts` | `users` | Firebase Auth user mirror with `role: "ADMIN" \| "CLIENT"`. `upsertUser` runs inside a transaction. `notificationPrefs`, `phone`, `automationConfig` live here. |
| `vendors.ts` | `vendors` | Venue/planner/HMUA records (schema reserved for Phase 3.8). |

---

## Conventions

- Return `null` for not-found, not a throw — callers expect optional reads.
- `update*` returns `void`; do not echo back the document.
- Use `FieldValue.serverTimestamp()` for `updatedAt`; use `Timestamp.now()` for write-time fields on creation when you need to read the value back immediately.
- Pair `where("field", "!=", null)` with `orderBy("field")` before any secondary `orderBy` — see `listPublicPhotos` in `photos.ts`.
- Count queries use `.count().get()` (e.g. `countPhotos`, `countEventAccess`).
