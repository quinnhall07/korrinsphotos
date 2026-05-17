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
| `analytics-cache.ts` | `analyticsCache` | Pre-aggregated analytics snapshots keyed by period (e.g. `finance:YYYY-MM-DD`). `AnalyticsSnapshotDoc` carries `revenue`, `funnel`, `sources`, `byType`, `depositLiability`. Daily refresh by `lib/domain/analytics.ts > recomputeFinanceCache`. |
| `assets.ts` | `assets` | Depreciable equipment register (Phase 3.2). `DepreciationMethod = MACRS_5\|MACRS_7\|SECTION_179\|BONUS\|NONE`; pure helper `currentYearDepreciationCents(asset, year)` runs half-year-convention MACRS tables. |
| `broadcasts.ts` | `broadcasts` | Block-based segment-targeted email blasts. `BroadcastDoc` carries `blocks: BroadcastBlock[]`, `segmentId`, `status: DRAFT\|SCHEDULED\|SENDING\|SENT`, `sendIdsByRecipient`. Ships `renderBroadcastHtml(broadcast)` for inline-CSS table-based email output. Send orchestration lives in `lib/broadcasts/sender.ts`. |
| `clients.ts` | `clients` | Universal Client record (email = unique). Referral fields (`referralCode`, `referralCount`, `referralTier`, `referralRewardsLog`, `referralAttributions`, `referralCredit`, `referredBy`) + first-touch attribution. `generateReferralCode()` lives here. Wave-11 added `notes`, `ClientSort`, `listClientsPaginated`, `searchClients`, `updateClientDetails` for `/admin/clients`. |
| `events.ts` | `events` | Event/shoot record. Canonical `EventStatus = UPCOMING\|ACTIVE\|COMPLETED\|DELIVERED\|ARCHIVED`. Photos live in the `events/{id}/photos` subcollection. Wave-12 added `listEventsPaginated` with `where("status","in",[…])` filter. |
| `users.ts` | `users` | Firebase Auth user mirror with `role: "ADMIN" \| "CLIENT"`. `upsertUser` runs inside a transaction. `notificationPrefs`, `phone`, `automationConfig` live here. Wave-10 added `listUsersPaginated` with base64url cursor (`createdAt desc + __name__` stable order). Wave-9/12 settings on `users/{uid}` now include `studioHours`, `insurerContact`, `taxConfig`, `brandVoiceSamples` (Wave-9), and `replyTemplates` (Wave-12) — all wired through `lib/db/admin-settings.ts`. |
| `vendors.ts` | `vendors` | Venue/planner/HMUA records (Phase 3.8). Wave-9 added `lastReciprocatedAt` + `logVendorReferralSent` / `logVendorReferralReceived` for the reciprocity dashboard. |
| `contracts.ts` | `contracts` | Per-project signed agreements; `DRAFT|SENT|SIGNED|VOIDED`; token-validated signing flow stores `signingToken`, `tokenExpiresAt`, `signerIp`/`signerUserAgent`, `signedPdfR2Key`. |
| `email-events.ts` | `emailEvents` | Open / click / sent / bounced / unsub tracking rows written by `lib/email/tracking.ts > enqueueTrackedMail`. |
| `expenses.ts` | `expenses` | Manual-entry expense ledger (Phase 3.2). `ScheduleCLine` enumerates IRS Schedule C lines 8–27 + `OTHER`. `MILEAGE_RATE_2025_CENTS_PER_MILE = 70`. `listExpensesForYear` / `listExpensesForMonth` are the canonical reads (month is 1-indexed). |
| `inbox.ts` | `inboxItems` | Aggregated triage feed (inquiries / payments / signings / disputes / refunds / unmatched mail). |
| `invoices.ts` | `invoices` | `DEPOSIT|BALANCE|FULL` invoices with Stripe payment link metadata + refund/dispute ledger fields (`refundCents`, `disputeStatus`, etc.). |
| `locations.ts` | `locations` | Reusable shoot-location records (schema reserved for Phase 3.5). |
| `photos.ts` | `photos` | Flat `photos` collection used by `listPublicPhotos` (portfolio). Per-event photos live under `events/{id}/photos` and are read directly via `adminDb` in `lib/domain/events.ts`. Wave-9 added `viewCount` / `downloadCount` / `lastViewedAt` + `incrementPhotoView` / `incrementPhotoDownload` for client-gallery analytics. Wave-10 added a generic `updatePhoto(eventId, photoId, partial)` helper for label / category edits. |
| `products.ts` | `products` + `productPurchases` | Phase 4.13 digital products store. `ProductDoc` (slug-locked, `DRAFT|PUBLISHED|ARCHIVED`, Stripe Payment Link auto-created on publish, `fileR2Key` deliverable). `ProductPurchaseDoc` ledger idempotent on `stripeCheckoutSessionId`; webhook generates 7-day presigned R2 GET URL and emails the buyer via `enqueueTrackedMail`. |
| `style-profiles.ts` | `styleProfiles` | Phase 2.2 style quiz answers. Email is the doc id (lowercased + trimmed); re-submission overwrites atomically (`merge: false`). `tagSummary[]` derived from answer map at write time. |
| `projects.ts` | `projects` (+ `projects/{id}/messages` + `projects/{id}/dayOfTimeline` + `projects/{id}/gearLog` + `projects/{id}/pressSubmissions`) | Master state machine: `ProjectStatus`, `ProjectDoc`, `MessageDoc`, `CommunicationChannel`, `projectMessagesCol()`. Wave-9 added `offTheRecordNotes` (NEVER export). Wave-12 added `dayOfRoomToken` / `dayOfRoomTokenIssuedAt` / `dayOfRoomEnabled` / `dayOfRoomVendorIds` + `mintDayOfRoomToken` / `revokeDayOfRoomToken` / `findProjectByDayOfRoomToken` (single-field auto-index lookup) + `listProjectsPaginated` cursor helper. |
| `questionnaires.ts` | `questionnaireTemplates` + `questionnaires` | Templates (one per session type) + per-project instances (`PENDING`/`COMPLETED`). 5 seeded defaults. |
| `reviews.ts` | `reviewRequests` | Multi-step (Google → Knot → Facebook) review request rows fanned out on NPS ≥ 4. |
| `saved-views.ts` | `users/{uid}/views` | Per-admin saved pipeline filters (5 built-in defaults stay static in code). |
| `segments.ts` | `segments` | Saved-predicate audience definitions (schema reserved for Phase 4.3). |
| `sequence-enrollments.ts` | `sequenceEnrollments` | Per-client active drip state consumed by `runDueSequences` in the cron worker. |
| `sequences.ts` | `sequences` | Reusable email/SMS drip definitions (status-triggered + date-triggered). |

---

## Conventions

- Return `null` for not-found, not a throw — callers expect optional reads.
- `update*` returns `void`; do not echo back the document.
- Use `FieldValue.serverTimestamp()` for `updatedAt`; use `Timestamp.now()` for write-time fields on creation when you need to read the value back immediately.
- Pair `where("field", "!=", null)` with `orderBy("field")` before any secondary `orderBy` — see `listPublicPhotos` in `photos.ts`.
- Count queries use `.count().get()` (e.g. `countPhotos`, `countEventAccess`).
