# CLAUDE.md — Korrin's Photos

> This file is the primary reference for Claude Code. Read it fully before touching any file.
> Re-read the relevant sections before starting any task.

---

## Project Identity

**Korrin's Photos** is a full-stack Next.js 15 (App Router) application that serves three audiences simultaneously:

| Audience | Routes | Auth |
|---|---|---|
| Public visitors | `/`, `/portfolio`, `/booking`, `/login` | None |
| Admin (Korrin) | `/admin`, `/admin/inbox`, `/admin/projects`, `/admin/events`, `/admin/users` | Firebase session cookie + `role: "ADMIN"` claim |
| Clients | `/gallery/**` | Firebase session cookie + `eventAccess` Firestore doc |

`/admin/projects` is the canonical pipeline workspace built around the unified Client/Project model (see `docs/architecture/unified-client-lifecycle.md`). The legacy `/admin/bookings` Kanban and the `bookingInquiries` write have been retired (May 2026).

The codebase is **proprietary** (see `LICENSE.md`). Do not copy, publish, or reference external repositories.

---

## Repo Layout

```
korrin-photos/
├── app/                              # Next.js App Router pages & API routes
│   ├── admin/                        # Admin dashboard (server-guarded)
│   │   ├── events/                   # Event management + [id] detail (gallery editor lives here)
│   │   ├── projects/                 # Unified pipeline (reads projects + clients)
│   │   │   ├── [id]/page.tsx
│   │   │   ├── actions.ts            # updateProjectStatus, updateProjectDetails
│   │   │   ├── contract-actions.ts   # createDraftContract, sendContract
│   │   │   ├── invoice-actions.ts    # sendInvoice (creates Stripe payment link)
│   │   │   ├── page.tsx
│   │   │   └── ProjectsPipelineClientPage.tsx
│   │   ├── users/                    # User management
│   │   ├── layout.tsx                # requireAdmin() guard + AdminSidebar
│   │   └── page.tsx                  # Dashboard
│   ├── api/
│   │   ├── auth/session/             # POST: exchange idToken → session cookie
│   │   ├── auth/signout/             # POST: clear session cookie
│   │   ├── cron/run-tasks/           # GET: cron worker (Vercel daily schedule)
│   │   ├── events-list/              # GET: dropdown data for event linking
│   │   ├── invite/                   # POST: grant access + send magic link
│   │   ├── upload/                   # POST: generate single-PUT R2 pre-signed URL
│   │   ├── upload/confirm/           # POST: ingest into Cloudflare Images + Firestore
│   │   ├── upload/multipart/init/    # POST: start multipart upload, return part URLs
│   │   ├── upload/multipart/complete/# POST: finalize multipart upload + write Photo doc
│   │   └── webhooks/stripe/          # POST: Stripe webhook (verifies signature)
│   ├── booking/                      # Public booking inquiry form + actions.ts
│   ├── gallery/                      # Client portal: [id] private event gallery
│   ├── login/                        # Magic link + OAuth login
│   ├── portfolio/                    # Public portfolio with category filter
│   ├── settings/                     # Client account settings
│   ├── error.tsx                     # Global error boundary
│   ├── globals.css                   # Design tokens + global styles
│   ├── layout.tsx                    # Root layout (Navbar, AuthProvider, Toaster)
│   ├── loading.tsx                   # Root loading state
│   ├── not-found.tsx
│   └── page.tsx                      # Home page
├── components/
│   ├── admin/AdminSidebar.tsx        # Canonical admin nav sidebar
│   ├── ui/Toaster.tsx                # Global toast system
│   ├── AuthProvider.tsx              # Firebase Auth context + magic link completion
│   ├── Footer.tsx
│   ├── HeroSlideshow.tsx
│   ├── Lightbox.tsx
│   ├── MasonryGrid.tsx
│   └── Navbar.tsx
├── docs/
│   └── architecture/
│       └── unified-client-lifecycle.md   # Canonical reference for the Client/Project schema
├── lib/
│   ├── db/                           # Per-collection Firestore helpers (canonical DB layer)
│   │   ├── activity.ts
│   │   ├── analytics-cache.ts        # Pre-aggregated analytics snapshots (Finance dashboard et al)
│   │   ├── clients.ts                # Universal Client record (email = key)
│   │   ├── contracts.ts
│   │   ├── event-access.ts
│   │   ├── events.ts
│   │   ├── invoices.ts
│   │   ├── mail.ts                   # Firebase Trigger Email queue
│   │   ├── photos.ts
│   │   ├── projects.ts               # Master state machine (ProjectDoc, ProjectStatus, MessageDoc)
│   │   └── users.ts
│   ├── domain/
│   │   ├── analytics.ts              # computeFinanceSnapshot + recomputeFinanceCache (cron drain)
│   │   └── events.ts                 # deleteEventAndAssets, clearEventGallery (cross-collection ops)
│   ├── storage/
│   │   ├── images.ts                 # Cloudflare Images upload/delete + buildCdnUrl
│   │   └── r2.ts                     # R2 presign (single + multipart), delete, get-URL
│   ├── booking-kanban.ts             # CommunicationChannel + legacy LeadStatus types (still imported by lib/db/projects)
│   ├── cloudflare.ts                 # Deprecated re-export facade for lib/storage/*
│   ├── contract-renderer.ts          # Merges project + client data into HTML contract template
│   ├── date.ts                       # toDate / formatDisplayDate / formatDateTime helpers
│   ├── firebase-admin.ts             # Admin SDK singleton (server-only)
│   ├── firebase-email.ts             # Identity Toolkit magic link sender (server-only)
│   ├── firebase.ts                   # Client SDK singleton (client-only)
│   ├── lead-scoring.ts               # 0-100 lead score algorithm (structural LeadScoreInput shape)
│   ├── project-transitions.ts        # handleProjectTransition + lifecycle hooks
│   ├── session.ts                    # Session cookie create/verify/clear + requireAdmin/requireSession
│   ├── stripe.ts                     # Stripe SDK + createPaymentLinkForInvoice
│   └── upload.ts                     # Client-side multipart upload orchestrator
├── middleware.ts                     # Edge cookie check (admin/gallery) + __origin UTM cookie
├── scripts/                          # One-off Node scripts (migrations, backfills)
├── styles/main.css                   # Legacy CSS (prototype artifact — do not delete)
├── index.html                        # Legacy prototype HTML (do not delete)
├── vercel.json                       # Vercel Cron schedule for /api/cron/run-tasks
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Environment Variables

All env vars must exist in `.env.local` for local dev and in the Vercel project for production.
**Never commit `.env.local`.**

### Firebase Client SDK (browser-readable)
```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
```

### Firebase Admin SDK (server-only)
```
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY          # Full PEM; Vercel stores \n literally — lib/firebase-admin.ts normalises it
```

### Auth & App
```
ADMIN_EMAILS                  # Comma-separated list of admin email addresses (ADMIN_EMAIL also accepted)
NEXT_PUBLIC_APP_URL           # https://yourdomain.com (no trailing slash)
```

### Cloudflare R2
```
CLOUDFLARE_R2_ENDPOINT        # https://<ACCOUNT_ID>.r2.cloudflarestorage.com
CLOUDFLARE_R2_ACCESS_KEY_ID
CLOUDFLARE_R2_SECRET_ACCESS_KEY
CLOUDFLARE_R2_BUCKET_NAME
CLOUDFLARE_ACCOUNT_ID
```

### Cloudflare Images
```
CLOUDFLARE_IMAGES_API_TOKEN
NEXT_PUBLIC_CLOUDFLARE_IMAGES_URL   # https://imagedelivery.net/<HASH>
```

### Stripe
```
STRIPE_SECRET_KEY             # sk_live_... or sk_test_...; lib/stripe.ts warns if missing
STRIPE_WEBHOOK_SECRET         # whsec_...; required by /api/webhooks/stripe to verify signatures
```

### Cron Worker
```
CRON_SECRET                   # Bearer token enforced by /api/cron/run-tasks (skipped if unset, but required in prod)
```

---

## Critical Architecture Rules

### 1. Server / Client Boundary — Non-Negotiable

| File | Allowed in |
|---|---|
| `lib/firebase-admin.ts` | Server Components, API Routes, Server Actions, `lib/session.ts` |
| `lib/firebase.ts` | Client Components only (files with `"use client"`) |
| `lib/storage/*` (and `lib/cloudflare.ts` re-export) | Server-only (contains AWS SDK and CF API calls) |
| `lib/stripe.ts` | Server-only |
| `lib/session.ts` | Server-only |
| `lib/db/*` | Server-only (uses `adminDb`) |
| `lib/domain/*` | Server-only |
| `lib/project-transitions.ts`, `lib/contract-renderer.ts` | Server-only |

Violating this boundary causes build failures. If a client component needs auth state, use `useAuth()` from `AuthProvider.tsx`.

### 2. Session Cookie Protocol

The session cookie (`__session`) is an HTTP-only 14-day Firebase session cookie.

**Creation flow:**
1. User signs in client-side with Firebase Auth.
2. Client calls `afterSignIn()` from `useAuth()`.
3. `afterSignIn()` POSTs the `idToken` to `/api/auth/session`.
4. Server verifies, upserts Firestore user doc, sets cookie.
5. **Admin first login only:** Server returns `{ needsRefresh: true }` → client force-refreshes the Firebase token → POSTs again → session cookie is now created with `role: "ADMIN"`.

**Verification:** Every protected server route calls `await requireAdmin()` or `await requireSession()` from `lib/session.ts`. These redirect to `/login` if invalid. `requireAdmin()` first reads the JWT claim, then falls back to a Firestore `users/{uid}.role` lookup to handle legacy sessions minted before the claim was applied.

**Middleware** (`middleware.ts`) only checks cookie *presence* at the Edge (no Admin SDK on Edge). Actual token verification happens inside Server Components.

### 3. Image Upload Pipeline

There are two pipelines. Use the single-PUT pipeline for ordinary photos (JPEG/PNG/WebP/HEIC); use the multipart pipeline for files large enough that a single PUT is unreliable (RAW exports, multi-GB deliverables). The client-side orchestrator `lib/upload.ts` drives the multipart path.

**Single-PUT pipeline (`/api/upload` + `/api/upload/confirm`):**
```
Browser → POST /api/upload  { eventId, fileName, contentType }
        ← { presignedUrl, key }
Browser → PUT  {presignedUrl}  (file body, bypasses Vercel 4.5MB limit)
       (R2 stores the object)
Browser → POST /api/upload/confirm  { key, eventId, label, category }
        Server: uploadToCloudflareImages() → writes Photo doc in events/{id}/photos
        ← { photo }
```

**Multipart pipeline (`/api/upload/multipart/init` + `/api/upload/multipart/complete`):**
```
Browser → POST /api/upload/multipart/init  { eventId, fileName, contentType, parts }
        ← { uploadId, key, partUrls[] }
Browser → PUT each part to its presigned URL (parallel, capture ETag from response)
Browser → POST /api/upload/multipart/complete  { eventId, key, uploadId, parts: [{PartNumber, ETag}] }
        Server: completeMultipartUpload() → writes Photo doc with storageKey (no CF Images ingestion)
        ← { success, id }
```

**Never** expose raw R2 URLs in the DOM. Always use `buildCdnUrl(imageId, variant)` from `lib/storage/images.ts` (re-exported from `lib/cloudflare.ts`).

### 4. Database Access Layer

The canonical DB layer lives in `lib/db/<collection>.ts`. Each module exports:
- A `<collection>Col()` getter for the underlying `CollectionReference`.
- A typed `Doc` interface for that collection.
- Pure async helpers (`get`, `list`, `create`, `update`, etc).

**Rule:** All new code MUST import from `@/lib/db/<collection>`. Do not write a new `firestore.ts` monolith — that file existed historically and was split deliberately (see DECISION.md ADR-013). When adding a new collection, create a new file in `lib/db/` and follow the same module shape; document the schema in `docs/architecture/unified-client-lifecycle.md` if it participates in the lifecycle.

Cross-collection orchestrations (delete-all-photos-and-access for an event, etc.) live in `lib/domain/`. Lifecycle hooks live in `lib/project-transitions.ts`.

### 5. Component Conventions

- **`"use client"`** at the top of any file that uses hooks, browser APIs, or event handlers.
- **Server Components** fetch data directly (no `useEffect`). Pass serialisable props down to client children.
- **Server Actions** live in `actions.ts` files co-located with their page. Always call `await requireAdmin()` as the first line.
- **Toaster:** Import `toast` from `@/components/ui/Toaster` (event-driven, no context needed).
- **Routing after mutations:** Call `router.refresh()` (not `router.push`) to revalidate server data while staying on the page.

---

## Firestore Data Model

The repo is mid-transition. Both the legacy Event-centric collections and the new Client/Project collections exist live. New code should target the Client/Project model.

### New collections (Client/Project lifecycle)

```
clients/{clientId}
  email (unique), firstName, lastName, phone, avatarUrl, role,
  referralCode, referredBy, referralCredit, totalSessionsBooked,
  firstTouchSource, firstTouchMedium, firstTouchCampaign, firstTouchLandingUrl, firstTouchAt,
  createdAt, updatedAt

projects/{projectId}
  clientId, status (ProjectStatus), sessionType, title,
  shootDate, shootEndDate, shootLocation, packageName, packagePriceUsd, discountApplied,
  depositPaidAt, balancePaidAt, contractSignedAt, deliveredAt, referralLinkSentAt,
  leadScore, leadSource, tags, estimatedValue, followUpDate, lastContactedAt, lastRespondedAt,
  notes, createdAt, updatedAt
  └── messages/{messageId}
        direction (INBOUND|OUTBOUND), channel, subject, body, adminUid, sentAt, isAutomatic

contracts/{contractId}
  projectId, clientId, status (DRAFT|SENT|SIGNED|VOIDED), templateId,
  renderedHtml, signerIp, signerUserAgent, sentAt, signedAt, createdAt

invoices/{invoiceId}
  projectId, clientId, type (DEPOSIT|BALANCE|FULL), status (DRAFT|SENT|PAID|OVERDUE|VOID),
  amountCents, dueDate, paidAt, sentAt,
  stripePaymentIntentId, stripePaymentLinkId, stripePaymentLinkUrl, createdAt

scheduledTasks/{taskId}
  type (e.g. SEND_REFERRAL, AUTO_FOLLOW_UP), status (PENDING|COMPLETED),
  runAt, completedAt, projectId, clientId, createdAt
  (Consumed by /api/cron/run-tasks on the daily schedule.)

expenses/{expenseId}
  date, vendor?, description, amountCents, scheduleCLine (ScheduleCLine union — Schedule C lines 8–27 + OTHER),
  projectId?, mileageMiles?, isReimbursable?, receiptR2Key?, taxDeductible,
  createdAt, updatedAt
  (Read by /admin/reports/tax. CSV export at /api/expenses/export?year=YYYY.)

assets/{assetId}
  name, description?, purchaseDate, purchasePriceCents,
  depreciationMethod (MACRS_5|MACRS_7|SECTION_179|BONUS|NONE),
  placedInServiceDate, section179Cents?, salvageValueCents?, retiredAt?, photoR2Key?,
  createdAt, updatedAt
  (Depreciable equipment ledger. `currentYearDepreciationCents(asset, year)` is a pure helper.)

styleProfiles/{email}                     # Wave-9 (Phase 2.2)
  email (doc id, lowercased+trimmed), firstName?, answers (Record<questionId, optionId>),
  tagSummary (string[] derived dominant tags), submittedAt, updatedAt
  (Re-submission overwrites atomically. Surfaced on /admin/projects/[id] above the workspace.)

products/{productId}                      # Wave-11 (Phase 4.13)
  slug (locked post-create), title, type (PRESET_DESKTOP|PRESET_MOBILE|COURSE|EBOOK|OTHER),
  status (DRAFT|PUBLISHED|ARCHIVED), shortDescription, longDescriptionHtml, priceCents,
  heroImageUrl?, galleryImageUrls?, fileR2Key, fileSizeBytes?,
  stripePaymentLinkUrl?, stripePriceId?, purchaseCount?, createdAt, updatedAt
  (Public /shop renders PUBLISHED only. Stripe Payment Link auto-created on publish.)

productPurchases/{purchaseId}             # Wave-11 (Phase 4.13)
  productId, productSlug, buyerEmail, buyerName?, amountCents,
  stripeCheckoutSessionId (idempotency key), deliveryR2Key, deliveredAt?, createdAt
  (Webhook generates 7-day presigned R2 GET URL + emails buyer via enqueueTrackedMail.)
```

### Project subcollections introduced in Wave 9-12

- `projects/{id}/dayOfTimeline` — Wave 8, ordered timeline blocks; `visibleToClient` flag controls /portal + /day-of-room exposure.
- `projects/{id}.offTheRecordNotes` (field on ProjectDoc, Wave 9) — admin-only; NEVER export. Confirmed clean against welcome-packet, shoot-brief, journal-drafter, contract-renderer, portal, AI consumers.
- `projects/{id}.{dayOfRoomToken,dayOfRoomTokenIssuedAt,dayOfRoomEnabled,dayOfRoomVendorIds}` (Wave 12) — token-gated cross-vendor read-only view at `/day-of-room/[projectId]?t=<token>`. See ADR-017.

### Settings on `users/{uid}` (admin-only) introduced in Wave 9-12

- `users/{uid}.brandVoiceSamples: BrandVoiceSample[]` (Wave 9) — up to 10 samples, 50–1000 char body cap. Surfaced as voice-anchor card in `/admin/inbox` detail panel.
- `users/{uid}.replyTemplates: ReplyTemplate[]` (Wave 12) — saved reply blocks, 50–2000 char body, soft cap 30. Quick-insert popover above the message textarea on the project workspace.

`ProjectStatus` is defined in `lib/db/projects.ts` and runs the full lifecycle: `SITE_VISIT → INQUIRY → QUALIFYING → PROPOSAL_SENT → NEGOTIATING → CONTRACT_SENT → DEPOSIT_PENDING → BOOKED → SHOOT_READY → IN_EDITING → GALLERY_DELIVERED → REFERRAL_SENT → COMPLETED` (with `LOST` and `ARCHIVED` as terminal off-ramps).

### Legacy collections (still live, written for compatibility)

```
users/{uid}
  email, role ("ADMIN"|"CLIENT"), displayName, photoURL, createdAt, updatedAt

events/{eventId}
  title, status, shootDate?, shootEndDate?, projectId?, clientId?, createdAt, updatedAt
  └── photos/{photoId}
        cloudflareUrl, cloudflareImageId, label?, category?,
        galleryReady?, uploadedAt, r2Key?, storageKey? (multipart), status?, isRaw?

eventAccess/{eventId_userId}
  userId, eventId, email, createdAt

mail/{id}                     # Firebase Trigger Email extension watches this
  to, message: { subject, html }, createdAt

activityFeed/{id}
  action, message, timestamp, metadata?
```

> Historical `bookingInquiries/{id}` documents still exist in Firestore from the pre-unified era but are no longer written to or read by the app. The collection will be migrated off-line when convenient.

### Booking submission flow

`app/booking/actions.ts` (`submitBooking`) on every public form submission:
1. Finds or creates a `clients/{clientId}` doc (keyed by email).
2. Creates a `projects/{projectId}` doc in status `INQUIRY` with `clientId`.
3. Adds the first inbound message to `projects/{projectId}/messages`.
4. Surfaces the inquiry in the admin inbox via `createInboxItem(...)` (best-effort).
5. Logs `LEAD_RECEIVED` to the activity feed (best-effort).
6. Enqueues the auto-responder email through `enqueueTrackedMail`.

**Subcollection queries** that cross multiple events require `collectionGroup()`. Always pair `where("field", "!=", null)` with `orderBy("field")` before any secondary `orderBy` or Firestore will reject the query.

---

## Middleware Responsibilities

`middleware.ts` runs on every page request matched by `config.matcher` (everything except `/api`, static assets, and metadata files). It does two things:

1. **Auth cookie presence check.** On `/admin/**` or `/gallery/**`, if no `__session` cookie is present, redirect to `/login`. The Edge runtime cannot run the Admin SDK, so this only enforces cookie *presence*; actual verification (`verifySessionCookie`) happens in Server Components via `requireAdmin()` / `requireSession()`.

2. **`__origin` UTM-attribution cookie.** If the request has no `__origin` cookie yet, the middleware writes one (30-day `maxAge`, `httpOnly: false`, `sameSite: "lax"`) containing JSON `{ source, medium, campaign, referralCode, landingUrl, ts }`. Values come from `utm_source` / `utm_medium` / `utm_campaign` / `ref` query parameters; if absent, the source is inferred from the `referer` header (`instagram.com` → `INSTAGRAM`, `google.com` → `GOOGLE`, any other referer → `OTHER`, no referer → `DIRECT`). The cookie is intentionally JS-readable so client-side analytics can mirror it. It is read on the server by `app/booking/actions.ts`, which copies the values into the new `clients` doc as `firstTouchSource` / `firstTouchMedium` / `firstTouchCampaign` / `firstTouchLandingUrl` / `firstTouchAt`.

Because the cookie is set with `if (!req.cookies.get("__origin"))`, first-touch attribution is preserved across the entire 30-day window — subsequent visits never overwrite it.

---

## Design System

### Tokens (CSS variables — defined in `app/globals.css`)

```css
--white: #FAF9F6          /* warm off-white background */
--charcoal: #2A2A28       /* primary text */
--charcoal-light: #4A4A47
--charcoal-muted: #8A8A85
--olive: #6B7845          /* primary accent */
--olive-light: #8A9A5A
--olive-dim: #E8EBD8      /* light olive tint for backgrounds */
--border: rgba(42,42,40,0.12)
--border-strong: rgba(42,42,40,0.22)
--transition: 0.4s cubic-bezier(0.25,0.46,0.45,0.94)
```

### Typography

- **Headings / Display:** `Cormorant Garamond`, serif, weight 300. Use `<em>` for italic variety.
- **Body / UI:** `Jost`, sans-serif, weights 300/400/500.
- **Eyebrows / Labels:** 0.65rem, letter-spacing 0.2em, uppercase, `var(--olive)`.

### Aesthetic Principles

- **Minimalist editorial** — generous white space, thin borders (0.5px), no border-radius on interactive elements.
- Avoid Bootstrap-style utility chaining. Write inline styles or single-purpose classes.
- Animations: `fadeIn` (page transitions), `heroReveal` (hero), `scrollBob` (scroll indicator), `shimmer` (skeleton).
- Grain texture overlay on `body::before` at z-index 9999 — never place content above this except the Toaster (z-index: 9000 is fine; lightbox is 1000).

---

## Common Patterns

### Fetching Firestore in a Server Component
```tsx
// app/some-page/page.tsx
export const dynamic = "force-dynamic"; // or revalidate = N for ISR

export default async function SomePage() {
  await requireAdmin(); // or requireSession()
  const events = await listEvents();           // from lib/db/events
  return <ClientComponent events={events} />;
}
```

### Server Action Pattern
```ts
// app/admin/something/actions.ts
"use server";
import { requireAdmin } from "@/lib/session";
import { updateProject } from "@/lib/db/projects";
import { revalidatePath } from "next/cache";

export async function doSomething(id: string): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  try {
    await updateProject(id, { /* ... */ });
    revalidatePath("/admin/projects");
    revalidatePath(`/admin/projects/${id}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: "Failed." };
  }
}
```

### Toasting from a Client Component
```tsx
import { toast } from "@/components/ui/Toaster";
toast("Photo deleted successfully");
```

### Building a CDN URL
```ts
import { buildCdnUrl } from "@/lib/storage/images";   // (or from "@/lib/cloudflare")
const src = buildCdnUrl(photo.cloudflareImageId, "gallery");
```

### Advancing a Project Through Its Lifecycle
```ts
import { updateProjectStatus } from "@/app/admin/projects/actions";
// Server Action: writes status, calls handleProjectTransition() for side effects.
await updateProjectStatus(projectId, "BOOKED");
```

---

## Known Gotchas

1. **Firestore composite index requirement:** Any query combining `where("field", "!=", null)` with `orderBy("uploadedAt")` requires a composite index. If you see a Firestore index error in logs, follow the link in the error to create it in the Firebase Console. `listPublicPhotos()` in `lib/db/photos.ts` triggers this.

2. **FIREBASE_PRIVATE_KEY newlines:** The raw PEM has `\n` characters. Vercel stores them as literal `\n` strings. `lib/firebase-admin.ts` handles this with `.replace(/\\n/g, "\n")` — don't change this.

3. **`collectionGroup` requires Firestore rules:** If adding new collectionGroup queries, ensure Firestore Security Rules permit them. Check the Firebase Console.

4. **Vercel 4.5MB body limit:** Never POST image data to a Next.js API route. Always use the pre-signed R2 URL pipeline — single-PUT for normal photos, multipart for very large files.

5. **`cookies()` is async in Next.js 15:** `await cookies()` is required before calling `.get()` or `.set()`. Already handled in `lib/session.ts` and `app/booking/actions.ts`.

6. **`searchParams` is async in Next.js 15:** Page props `searchParams` must be `await`ed. Already handled in `app/login/page.tsx`.

7. **`params` is async in Next.js 15:** `const { id } = await params` is required in dynamic routes. Already handled throughout.

8. **`revalidatePath` scope:** After a Server Action mutation, call `revalidatePath` for every route that displays that data — both the detail page and any list pages. `updateProjectStatus` in `app/admin/projects/actions.ts` revalidates both `/admin/projects` and `/admin/projects/[id]` — follow the same pattern.

9. **Lead score recalculation:** `calculateLeadScore()` must be called any time `tags`, `estimatedValue`, `sessionType`, `message`, `preferredDate`, or `leadSource` changes. See `lib/lead-scoring.ts`. Note that the function is typed against `BookingInquiryDoc` — when scoring a `ProjectDoc`, pass a structurally-compatible subset.

10. **Booking → Project dual write.** `app/booking/actions.ts` writes to **both** `clients` + `projects` (new) and `bookingInquiries` (legacy). The legacy `/admin/bookings` Kanban reads only from `bookingInquiries`; `/admin/projects` reads only from `projects`. If you change one side, mirror the change on the other until the migration is complete and the legacy collection is retired. The "Temporary Migration Step" comment in `submitBooking()` marks the line that should be deleted last.

11. **Stripe webhook side effects.** `app/api/webhooks/stripe/route.ts` updates project status when a deposit or balance invoice is paid (`DEPOSIT_PENDING → BOOKED`, `IN_EDITING → GALLERY_DELIVERED`). The Stripe → status transition also calls `handleProjectTransition`, which in turn auto-creates events, grants gallery access, increments client session counts, and queues referral emails (`lib/project-transitions.ts`). Do not duplicate these side effects elsewhere.

---

## Commands

```bash
npm run dev       # Start development server (localhost:3000)
npm run build     # Production build (catches type errors)
npm run lint      # ESLint
npm start         # Serve production build locally
```

TypeScript strict mode is enabled. Fix all type errors before committing.

---

## Testing Checklist (Before Any PR / Deploy)

- [ ] `npm run build` passes with zero errors and zero type errors
- [ ] `npm run lint` passes
- [ ] Public routes load without auth
- [ ] `/login` → magic link flow → `/gallery` redirect works
- [ ] Admin login (first-time and returning) → `/admin` redirect works
- [ ] Photo upload pipeline completes (all 3 steps for single-PUT; multipart for large files)
- [ ] Client invite flow sends email and grants `eventAccess`
- [ ] Booking form submission appears in `/admin/bookings` AND creates a `clients` + `projects` doc visible in `/admin/projects`
- [ ] Kanban drag-and-drop updates status (both `/admin/bookings` and `/admin/projects`)
- [ ] Stripe webhook test event (`checkout.session.completed`) advances a paid project's status
- [ ] Lightbox keyboard nav (←, →, Escape) works
- [ ] Right-click on images is blocked
