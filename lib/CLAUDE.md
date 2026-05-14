# CLAUDE.md — `lib/`

> Library layering for Korrin's Photos. Read root `CLAUDE.md` first.
> Re-read this file before adding a new module or moving code between layers.

---

## Layering

The `lib/` tree is split into three subdirectories plus a flat set of cross-cutting helpers at the top level. Each layer has a single responsibility:

| Layer | Path | Purpose |
|---|---|---|
| Persistence | `lib/db/` | Raw Firestore reads/writes, one file per collection. See `lib/db/CLAUDE.md`. |
| Orchestration | `lib/domain/` | Cross-collection operations that span multiple `db/` modules and/or external storage. See `lib/domain/CLAUDE.md`. |
| External I/O | `lib/storage/` | Object storage adapters: R2 presign, Cloudflare Images REST. See `lib/storage/CLAUDE.md`. |
| Cross-cutting | `lib/*.ts` | Single-file helpers used across the app (see table below). |

Direction of dependency: `domain/` and top-level helpers may import from `db/` and `storage/`. `db/` and `storage/` modules MUST NOT import from `domain/` or from each other across kinds — they are leaves.

---

## Top-level files

| File | Purpose |
|---|---|
| `firebase-admin.ts` | Server-only. Initialises the Admin SDK singleton; exports `adminAuth` and `adminDb`. Handles the `\n`-in-PEM normalisation for Vercel. |
| `firebase.ts` | Client-only. Firebase Web SDK singleton. Exports `firebaseAuth` and `requireFirebaseAuth()`. |
| `firebase-email.ts` | Server-only. Calls Identity Toolkit `sendOobCode` to deliver magic-link emails. Exports `sendFirebaseSignInLink` and `buildContinueUrl`. |
| `session.ts` | Server-only. Session-cookie create/verify/clear plus `requireAdmin()` / `requireSession()` route guards. |
| `stripe.ts` | Server-only. Stripe SDK singleton; `createPaymentLinkForInvoice()`. Warns (but does not crash) if `STRIPE_SECRET_KEY` is unset. |
| `project-transitions.ts` | Server-only. `handleProjectTransition()` runs lifecycle hooks (`onProjectBooked`, `onProposalSent`, `onGalleryDelivered`) for status changes. |
| `contract-renderer.ts` | Server-only. Token-replaces `{{CLIENT_*}}` / `{{PROJECT_*}}` placeholders against a Project + Client; `generateContractForProject()` writes a draft `contracts/` doc. |
| `lead-scoring.ts` | Pure function. `calculateLeadScore()` over `BookingInquiryDoc`. Re-run on any change to `tags`, `estimatedValue`, `sessionType`, `message`, `preferredDate`, or `leadSource`. |
| `booking-kanban.ts` | Pure types/constants. `LeadStatus`, `LeadSource`, `CommunicationChannel`, `KANBAN_STATUSES`, `PRESET_TAGS`. Safe to import from client components. |
| `upload.ts` | Client-only. `uploadMultipartFile()` — drives `/api/upload/multipart/{init,complete}` with parallel part PUTs (`CHUNK_SIZE=10MB`, `CONCURRENCY=3`). |
| `date.ts` | Pure. `toDate`, `formatDisplayDate`, `formatDateInput`, `formatDateTime` — accept `Date | string | { toDate() }`. Safe everywhere. |
| `cloudflare.ts` | Deprecated re-export facade. Forwards from `lib/storage/r2` and `lib/storage/images`. Do not add new exports here — import from `lib/storage/*` directly. |
| `golden-hour.ts` | Pure. `computeSunTimes(date, lat, lon)` returns sunrise/sunset, golden- and blue-hour boundaries, and solar noon as `Date` objects via the NOAA Solar Calculations algorithm (no third-party dep). `formatSunTimes(times, tz?)` renders an `Intl.DateTimeFormat` summary (default `America/New_York`). Polar edge case: returns Invalid Date when the sun never rises/sets — guard with `Number.isNaN(d.getTime())`. |
| `weather.ts` | Server-only Tomorrow.io adapter. `fetchForecastSnapshot({ latitude, longitude, at })` POSTs `/v4/timelines` and returns a normalized `WeatherSnapshot` (Fahrenheit, mph, normalized `conditions` vocabulary, `isOutdoorFriendly` heuristic). Reads `TOMORROW_IO_API_KEY`; warns and returns `null` if unset. 8s `AbortController` timeout; best-effort — never throws, returns `null` on any error. |

---

## Server-only vs client-only

The full enforcement table lives in root `CLAUDE.md` > "Critical Architecture Rules". Summary: a `"use client"` file MUST NOT import any of:

- `lib/firebase-admin.ts`
- Anything under `lib/db/`, `lib/domain/`, or `lib/storage/`
- `lib/stripe.ts`, `lib/session.ts`, `lib/firebase-email.ts`
- `lib/project-transitions.ts`, `lib/contract-renderer.ts`
- `lib/cloudflare.ts` (it re-exports storage)

Client components may import `lib/firebase.ts`, `lib/upload.ts`, `lib/date.ts`, and `lib/booking-kanban.ts`.

---

## Adding new code

- **New top-level file** when adding a single cross-cutting helper (e.g. a new pure utility, a third-party SDK singleton).
- **New subdirectory** when adding a new *kind* of concern — e.g. a new I/O target (`lib/email/` for a non-Firebase mailer), a new analytic surface, or a new orchestration domain.
- **New `lib/db/<x>.ts`** for any new Firestore collection. Do not aggregate.
- **New `lib/domain/<x>.ts`** when an operation spans two-plus collections or a collection plus external storage, and does not belong inside a single `db/` module.

If you find yourself reaching for the deprecated `lib/cloudflare.ts`, import from `lib/storage/*` instead and let the facade die naturally.
