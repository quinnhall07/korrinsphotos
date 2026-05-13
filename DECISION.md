# DECISION.md — Korrin's Photos

> Architectural decisions, their rationale, and important trade-offs.
> Before proposing a change to any of the patterns below, read the entry for it here first.
> Add a new entry whenever a non-obvious architectural choice is made.

---

## ADR-001: Next.js App Router (not Pages Router)

**Decision:** Use the App Router with React Server Components.

**Rationale:**
- Server Components allow Firestore data to be fetched at the server level with zero client-side waterfalls, which is critical for SEO on public portfolio pages.
- Server Actions eliminate the need for dedicated API routes for most mutations (booking form, photo delete, event title edit, etc.), reducing round-trips and boilerplate.
- Streaming + Suspense lets heavy gallery pages render the shell immediately while photos load, improving perceived performance for clients on slow connections.

**Trade-offs:**
- The `"use client"` boundary requires careful thought. Any component that uses hooks, browser APIs, or event handlers must be a Client Component — passing serialisable props down from Server Components is required.
- `cookies()`, `params`, and `searchParams` are all async in Next.js 15 — already handled throughout, but be careful when adding new dynamic routes.

---

## ADR-002: Firebase Firestore (not PostgreSQL / Prisma)

**Decision:** Firestore as the sole database. No SQL database, no Prisma.

**Rationale:**
- The data model is naturally document-oriented: events contain photo subcollections, users have event access grants, bookings have embedded communication logs.
- Firebase Admin SDK works in Next.js server-side with no connection pool management, making it ideal for serverless Vercel deployments where connection limits are a real constraint with PostgreSQL.
- Firebase Trigger Email extension is a zero-infrastructure way to dispatch transactional email without a separate email service integration.
- Firebase Auth + Firestore in the same ecosystem simplifies the user lifecycle (create Auth account → upsert Firestore doc in a single server action).

**Trade-offs:**
- No joins. Related data requires either subcollections, denormalisation (e.g., storing `eventName` on `bookingInquiries`), or multiple reads with `Promise.all`. This is an intentional design choice.
- Firestore composite indexes must be created manually in the Firebase Console for any query combining `!=` filters with `orderBy`. See CLAUDE.md Known Gotchas #2.
- No transactions across collections unless using `adminDb.runTransaction()`.

**What to do if this becomes a problem:** If reporting needs grow beyond what Firestore can cleanly support, add a read-replica BigQuery export via Firebase Extensions — do not introduce a second primary database.

---

## ADR-003: Firebase Session Cookies (not NextAuth / JWT in localStorage)

**Decision:** Exchange Firebase ID tokens for long-lived HTTP-only session cookies via `/api/auth/session`.

**Rationale:**
- HTTP-only cookies are inaccessible to JavaScript, protecting against XSS token theft. This is critical for an app that handles private client photos.
- Firebase session cookies can be verified server-side with `adminAuth.verifySessionCookie()`, giving us server-rendered auth state without a database lookup on every request.
- The 14-day session lifetime matches typical photographer-client relationships (client receives gallery, downloads over a few days).
- NextAuth was considered but adds complexity without material benefit here since Firebase Auth already handles the OAuth providers we need.

**Trade-offs:**
- The two-step admin first-login flow (token → `needsRefresh: true` → force refresh → token again) is complex. This exists because custom claims set by the server are not reflected in the client's cached token until a force refresh. This is a Firebase limitation, not a design flaw.
- Session revocation requires calling `adminAuth.revokeRefreshTokens(uid)` if needed — not currently implemented. The `checkRevoked: true` flag in `verifySessionCookie` will catch this.

---

## ADR-004: Cloudflare R2 + Cloudflare Images (not Vercel Blob / AWS S3)

**Decision:** R2 for origin storage, Cloudflare Images for CDN delivery and transformation.

**Rationale:**
- Vercel has a 4.5MB request body limit on API routes. A photography app that handles 20–50MB RAW exports cannot route uploads through Vercel. Pre-signed R2 PUT URLs are the correct pattern.
- Cloudflare Images provides automatic WebP conversion, named variants (thumbnail, gallery, download), and CDN delivery from Cloudflare's edge — all without requiring a separate image processing service.
- R2 has no egress fees, which matters significantly for a high-traffic photo delivery application.
- Cloudflare Images URLs (`imagedelivery.net`) are intentionally opaque — clients cannot reverse-engineer the original file path or download the original without an explicit signed URL.

**Trade-offs:**
- The two-hop pipeline (browser → R2 → Cloudflare Images) means photos take a moment after upload before the CDN URL is usable. The `confirm` API route handles this synchronously, so `router.refresh()` after upload shows the new photos immediately.
- Cloudflare Images variants must be created in the Cloudflare dashboard before use. See `PROGRESS.md` infrastructure table.

---

## ADR-005: CSS Variables + Inline Styles (not Tailwind-first)

**Decision:** Primary styling uses CSS custom properties and inline React styles. Tailwind is available but used sparingly.

**Rationale:**
- The editorial aesthetic requires precise, deliberate spacing and typography that is easier to express with explicit pixel values than with Tailwind's constraint system.
- The prototype was built in vanilla CSS (`styles/main.css`) using CSS variables. Carrying those variables into the React app (`app/globals.css`) provides a consistent design foundation.
- Inline styles make component visual logic self-contained and searchable — no hunting across CSS files to understand why something looks a certain way.

**Trade-offs:**
- Tailwind's purging/tree-shaking doesn't help much when most styles are inline. The `tailwind.config.ts` and `postcss.config.mjs` exist and are configured, so Tailwind utilities work for utility classes if needed.
- The grain texture `body::before` at `z-index: 9999` must be respected. Any UI that needs to appear above the grain (modals, lightboxes, drawers, toasts) must use `z-index > 9999` or `pointer-events: none` on the overlay itself. The Toaster uses 9000 (fine because it has `pointer-events: none`). The Lightbox uses 1000 which renders beneath the grain — this is intentional for the subtle cinematic feel, but can be raised if it causes usability issues.

---

## ADR-006: Server Actions for Mutations (not REST API routes)

**Decision:** Mutations use Next.js Server Actions (`"use server"` functions in `actions.ts` files), not API routes, for the majority of admin operations.

**Rationale:**
- Server Actions are co-located with the page that uses them, making the code easier to navigate.
- They automatically handle CSRF protection (Next.js validates the `Origin` header).
- They return typed results directly — no `fetch + JSON.parse` boilerplate on the client.
- They work with `useTransition` for pending states without manual loading state management.

**Exceptions (API routes used instead):**
- `/api/auth/session` and `/api/auth/signout` — must be API routes because the session cookie exchange happens from `AuthProvider.tsx` (a client component that runs before any page is known).
- `/api/upload` and `/api/upload/confirm` — multi-step pipeline with different callers; API routes are cleaner here.
- `/api/invite` — complex multi-step flow (Firebase Auth upsert + Firestore write + email send) called from a client component.
- `/api/events-list` — lightweight GET used by a client component dropdown.

---

## ADR-007: No Real-Time Firestore Subscriptions

**Decision:** All data is fetched server-side on load or on `router.refresh()` calls. No `onSnapshot` listeners.

**Rationale:**
- Real-time listeners add significant complexity (connection management, memory leaks, SSR hydration mismatches) without a clear product need. Korrin is the only admin user; clients view their gallery once and download.
- `router.refresh()` after a Server Action provides "eventual consistency" that is indistinguishable from real-time for single-user admin workflows.
- Avoids exposing Firestore security rules gaps (see PROGRESS.md — Firestore Security Rules are not yet written).

**When to reconsider:** If multi-admin collaboration is ever needed (e.g., two people managing bookings simultaneously), real-time Kanban updates would be worth the complexity.

---

## ADR-008: Lead Scoring Algorithm in `lib/lead-scoring.ts`

**Decision:** Lead scores (0-100) are calculated server-side on write operations, not lazily on read.

**Rationale:**
- Scores are used for sorting Kanban columns and smart filters. Pre-computing on write means the read path is simple and fast.
- The scoring function is pure (no side effects), making it easy to test and adjust weights without touching Firestore.

**Current inputs and weights (as of initial build):**
| Factor | Max Points |
|---|---|
| Baseline (any genuine inquiry) | 35 |
| Session type (Wedding=30, Commercial=25…) | up to 30 |
| Message length (>400 chars = 15pts) | up to 15 |
| Date urgency (≤30 days = 15pts) | up to 15 |
| Lead source (Referral=18pts) | up to 18 |
| Tags (VIP=12, Return Client=15…) | variable |
| Estimated value (≥$5000 = 10pts) | up to 10 |

**Recalculation triggers:** tag add/remove, lead source change, estimated value change, explicit backfill via `recalculateLeadScore` action.

---

## ADR-009: `eventAccess` Document ID Format

**Decision:** `eventAccess` documents use the composite ID `{userId}_{eventId}`.

**Rationale:**
- Allows O(1) existence checks in server code: `adminDb.collection("eventAccess").doc(`${uid}_${eventId}`).get()`. No query needed.
- Makes revocation deterministic: the document ID is fully derivable from the two pieces of information you always have.
- Prevents duplicate access grants naturally (Firestore `set` with `{ merge: true }` on the same composite ID is idempotent).

**Note:** The invite API uses `${uid}_${eventId}` and the gallery page uses the same format for the access check. Do not change this format without updating both.

---

## ADR-010: `styles/main.css` and `index.html` Retention

**Decision:** Do not delete `styles/main.css` or `index.html` even though the app uses `app/globals.css`.

**Rationale:**
- These are the original prototype files that define the design system. They serve as the canonical reference for the visual design spec.
- Some CSS classes in `styles/main.css` are still referenced in the prototype flow and may be referenced in documentation or client demos.
- The overhead of keeping them is zero.

---

## ADR-011: Magic Links for Client Invitations (not Passwords)

**Decision:** Clients receive gallery access via Firebase magic link emails, not password-based accounts.

**Rationale:**
- Photography clients are non-technical users who shouldn't need to manage credentials for a one-time gallery download experience.
- Magic links eliminate password reset support burden.
- Firebase Identity Toolkit REST API (`lib/firebase-email.ts`) sends the link directly without a third-party email service for auth emails (Resend/SendGrid is still used for transactional emails via the Trigger Email extension).

**Trade-offs:**
- Email deliverability depends on Firebase's sending infrastructure and the client's email provider. Clients on strict corporate email filters may not receive magic links reliably.
- The magic link is single-use and expires (Firebase default: 1 hour). If a client doesn't click in time, Korrin must resend from the admin panel.
- Clients who sign in via Google or Microsoft OAuth cannot use the magic link flow and vice versa — their accounts are separate unless Firebase account linking is configured.

---

## ADR-012: Dual AdminSidebar Files

> **Status (2026-05-13): Resolved.** Consolidated to `components/admin/AdminSidebar.tsx`; the legacy `app/admin/AdminSidebar.tsx` was removed.

**Decision:** Two `AdminSidebar` files exist and are intentionally retained until a cleanup task resolves the import.

**Files:**
- `app/admin/AdminSidebar.tsx` — imported by `app/admin/layout.tsx` via relative `./AdminSidebar`
- `components/admin/AdminSidebar.tsx` — the canonical version with a "← Public site" footer link

**Why this exists:** The canonical version was created in `components/admin/` during a refactor, but `app/admin/layout.tsx` was not updated to point to it. Both are functionally identical except for the footer link.

**Resolution:** Update the import in `app/admin/layout.tsx` to `@/components/admin/AdminSidebar`, then delete `app/admin/AdminSidebar.tsx`. This is a safe 2-line change but requires a build verification.

---

## ADR-013: Split `lib/firestore.ts` into per-collection `lib/db/*` modules

**Decision:** Replace the monolithic `lib/firestore.ts` facade with one file per collection under `lib/db/` (`activity.ts`, `bookings.ts`, `clients.ts`, `contracts.ts`, `event-access.ts`, `events.ts`, `invoices.ts`, `mail.ts`, `photos.ts`, `projects.ts`, `users.ts`).

**Rationale:**
- The single file was approaching 800 lines and growing fast — every new collection (clients, projects, contracts, invoices) widened the bundle and made the schema harder to reason about.
- Per-collection modules keep each `Doc` interface adjacent to the helpers that read and write it, so a contributor (or Claude) can load the full context for one schema in a single file.
- Tree-shaking is more predictable: a server route that only touches `projects` no longer transitively imports type definitions for every other collection.
- Each module follows the same shape: `<collection>Col()` getter, exported `Doc` interface, async helpers. This regularity is easy to extend.

**Trade-offs:**
- More import lines per consumer file. The trade is intentional — each import is now precise, and grep-based navigation works without ambiguity.

**Status (2026-05-13):** Migration complete; `lib/firestore.ts` has been removed. New code MUST import from `@/lib/db/<collection>`. Cross-collection orchestration belongs in `lib/domain/` (e.g. `deleteEventAndAssets`).

---

## ADR-014: Unified Client/Project Model

**Decision:** Introduce a `clients` collection (universal record keyed by email) and a `projects` collection (the master lifecycle state machine). Phase out `bookingInquiries`. See `docs/architecture/unified-client-lifecycle.md` for the full schema and rollout plan.

**Rationale:**
- The original schema had `bookingInquiries` and `events` as top-level collections with no shared key, which made it impossible to follow a single person across the inquiry → booking → delivery → referral lifecycle without ad-hoc denormalisation.
- A `clients` doc can exist before the user has a Firebase Auth account — an email is enough. When the same person later authenticates, the `users/{uid}` doc joins to the `clients/{clientId}` doc by email.
- `projects/{projectId}` carries the full `ProjectStatus` state machine (`SITE_VISIT → … → COMPLETED`), so every downstream artifact (contracts, invoices, events, photos, referrals) can foreign-key cleanly into one entity.
- Communication history moves from a flat `communicationLog[]` array on the inquiry into a structured `projects/{id}/messages` subcollection, which is queryable and supports per-message metadata (channel, automation flag, admin uid).

**Trade-offs:**
- Dual-write transition window. `app/booking/actions.ts` currently writes BOTH the new `clients` + `projects` docs AND a legacy `bookingInquiries` doc, so the existing `/admin/bookings` Kanban keeps working until the UI fully migrates. The "Temporary Migration Step" comment in `submitBooking()` marks the line to delete last.
- Lead scoring (`lib/lead-scoring.ts`) is still typed against `BookingInquiryDoc`. It works on `ProjectDoc` shapes today only because the relevant fields overlap; a follow-up will retype it against `ProjectDoc`.

**Canonical reference:** `docs/architecture/unified-client-lifecycle.md` (originally `NEW UNIFIED CLIENT ARCHITECTURE.txt` at the repo root; moved here on 2026-05-13).

---

## ADR-015: Stripe + Cron Worker Introduction

**Decision:** Add Stripe as the payments rail (deposit + balance invoices) and a Vercel Cron worker for scheduled jobs.

**Rationale:**
- The Unified Client/Project lifecycle requires payment infrastructure: `PROPOSAL_SENT` auto-creates a DEPOSIT invoice, `IN_EDITING` auto-creates a BALANCE invoice (`lib/project-transitions.ts`). Stripe Payment Links are the simplest path that supports custom amounts, metadata for webhook correlation, and post-payment redirect to a confirmation page.
- Stripe webhook → project status auto-advance closes the loop without admin intervention. `app/api/webhooks/stripe/route.ts` listens for `checkout.session.completed` and `payment_intent.succeeded`, marks the invoice `PAID`, and advances the project (`DEPOSIT_PENDING → BOOKED` or `IN_EDITING → GALLERY_DELIVERED`). It then calls `handleProjectTransition`, which triggers the downstream side effects.
- Scheduled tasks (`scheduledTasks/{taskId}` with `runAt` + `status: PENDING`) are consumed by `app/api/cron/run-tasks/route.ts` on the Vercel Cron schedule defined in `vercel.json` (`0 2 * * *` — daily at 02:00 UTC). Today this handles `SEND_REFERRAL` (7-day post-delivery referral email) with `AUTO_FOLLOW_UP` stubbed for the proposal-stuck-too-long sequence.

**Trade-offs:**
- More env vars to keep in sync (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CRON_SECRET`).
- Webhook signature verification is non-optional in production. `lib/stripe.ts` falls back to a mock client when `STRIPE_SECRET_KEY` is missing for local dev, but the webhook route fails fast if `STRIPE_WEBHOOK_SECRET` is unset.
- Cron auth is a simple bearer-token check against `CRON_SECRET`. If `CRON_SECRET` is unset the route runs unauthenticated, which is fine locally but must be set in production.

---

## ADR-016: `__origin` UTM Attribution Cookie

**Decision:** `middleware.ts` writes a JS-readable `__origin` cookie on the first page request that lacks one. It carries `{ source, medium, campaign, referralCode, landingUrl, ts }`. `app/booking/actions.ts` reads it (server-side via `cookies()`) and stamps the values onto the new `clients` doc as `firstTouch*` fields.

**Rationale:**
- Tying anonymous site visits to inquiry submissions enables first-touch attribution — we know whether a booking came from an Instagram story, a Google search, a paid campaign with UTM tags, or a referral code (`?ref=...`).
- Setting the cookie at the Edge means attribution is captured on the very first page hit, including landing pages the visitor might bounce off before reaching `/booking`.
- The fallback inference (`referer` header → `INSTAGRAM` / `GOOGLE` / `OTHER` / `DIRECT`) covers visitors who arrive without explicit UTM params.

**Trade-offs:**
- The cookie is `httpOnly: false` because client-side analytics may need to mirror it. This means it is technically readable by injected scripts; it carries no PII and no auth material, so the exposure is acceptable.
- 30-day expiry. After 30 days the cookie expires and the next visit re-attributes. This is by design — we treat a 30-day-old session as a new touchpoint.
- Because the cookie is set with `if (!req.cookies.get("__origin"))`, the first-touch source is never overwritten within a single window. Repeated visits from a different referrer during the window will not update attribution. This is the correct behaviour for first-touch attribution; multi-touch attribution would require a separate `__visits` log (see `siteVisits/{visitId}` in `docs/architecture/unified-client-lifecycle.md`).
