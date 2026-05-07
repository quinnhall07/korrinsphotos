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

**Decision:** Two `AdminSidebar` files exist and are intentionally retained until a cleanup task resolves the import.

**Files:**
- `app/admin/AdminSidebar.tsx` — imported by `app/admin/layout.tsx` via relative `./AdminSidebar`
- `components/admin/AdminSidebar.tsx` — the canonical version with a "← Public site" footer link

**Why this exists:** The canonical version was created in `components/admin/` during a refactor, but `app/admin/layout.tsx` was not updated to point to it. Both are functionally identical except for the footer link.

**Resolution:** Update the import in `app/admin/layout.tsx` to `@/components/admin/AdminSidebar`, then delete `app/admin/AdminSidebar.tsx`. This is a safe 2-line change but requires a build verification.
