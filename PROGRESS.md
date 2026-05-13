# PROGRESS.md — Korrin's Photos

> Last updated: 2026-05-13
> Source of truth for "what state is the codebase actually in." Update on feature completion, bug discovery/fix, or task abandonment.

---

## Overall Status

Feature-complete prototype with the unified Client/Project pipeline live in parallel with the legacy bookings Kanban. Stripe (deposit + balance payment links, signed webhook → status auto-advance) and Vercel Cron (`scheduledTasks` worker) are operational. The `lib/firestore.ts` → `lib/db/*` migration is complete and the file is gone. Remaining work is finishing the legacy → unified UI migration (so `/admin/bookings` and `bookingInquiries` can be retired), hardening for production (Firestore Security Rules, pagination, download fulfillment), and a small list of known bugs.

---

## Architecture Snapshot

- **Two collection families live concurrently.** Legacy (`bookingInquiries`, `events`) and new (`clients`, `projects` + `messages` subcollection, `contracts`, `invoices`, `scheduledTasks`). Both are written on every public booking submission. See ADR-014.
- **Booking submissions dual-write both sides.** `app/booking/actions.ts → submitBooking` runs four sequential writes (`clients`, `projects`, `projects/{id}/messages`, `bookingInquiries`) plus an activity-feed log and a `mail/` auto-responder. The "Temporary Migration Step" comment in step 4 marks the last line to delete.
- **`ProjectStatus` is the master state machine** (`SITE_VISIT → INQUIRY → QUALIFYING → PROPOSAL_SENT → NEGOTIATING → CONTRACT_SENT → DEPOSIT_PENDING → BOOKED → SHOOT_READY → IN_EDITING → GALLERY_DELIVERED → REFERRAL_SENT → COMPLETED` with `LOST` / `ARCHIVED`). Transitions go through `updateProjectStatus` in `app/admin/projects/actions.ts`, which calls `handleProjectTransition` in `lib/project-transitions.ts` for downstream side effects (event auto-create, gallery access grant, session-count increment, referral task scheduling).
- **Stripe + Cron are live.** `/api/webhooks/stripe` verifies the signature, marks invoices `PAID`, and auto-advances `DEPOSIT_PENDING → BOOKED` and `IN_EDITING → GALLERY_DELIVERED`. `/api/cron/run-tasks` runs daily at 02:00 UTC per `vercel.json` and drains `scheduledTasks` (`SEND_REFERRAL` is implemented; `AUTO_FOLLOW_UP` is stubbed). See ADR-015.
- **`__origin` UTM cookie writes first-touch attribution.** `middleware.ts` sets a 30-day JS-readable JSON cookie on the first request that lacks one; `submitBooking` stamps the values onto the new `clients` doc as `firstTouch{Source,Medium,Campaign,LandingUrl,At}`. See ADR-016.
- **`AdminSidebar` consolidated** to `components/admin/AdminSidebar.tsx`; the legacy `app/admin/AdminSidebar.tsx` was removed (ADR-012 resolved).
- **`lib/db/*` split complete.** Per-collection helpers in `lib/db/{activity,bookings,clients,contracts,event-access,events,invoices,mail,photos,projects,users}.ts`. Cross-collection orchestrations live in `lib/domain/` (`events.ts`: `deleteEventAndAssets`, `clearEventGallery`). `lib/firestore.ts` has been removed. See ADR-013.

---

## Completed Features

### Infrastructure & Auth
- [x] Next.js 15 App Router project with TypeScript strict mode.
- [x] Firebase Admin SDK singleton (`lib/firebase-admin.ts`) with `\n` PEM normalisation.
- [x] Firebase Client SDK singleton (`lib/firebase.ts`) with graceful no-config fallback.
- [x] 14-day HTTP-only Firebase session cookie (`lib/session.ts`).
- [x] `requireSession()`, `requireAdmin()`, `getSessionUser()` server guards with Firestore role fallback.
- [x] Two-step admin first-login (`needsRefresh` token bounce to attach the `role: "ADMIN"` claim).
- [x] Edge `middleware.ts` — cookie-presence check on `/admin/**` and `/gallery/**`, plus `__origin` UTM attribution cookie write (`source`, `medium`, `campaign`, `referralCode`, `landingUrl`, `ts`).
- [x] Magic link delivery via Firebase Identity Toolkit (`lib/firebase-email.ts`).
- [x] Google + Microsoft OAuth (popup), email/password sign-up + sign-in.
- [x] `AuthProvider` context with `useAuth()` and magic link completion handler.
- [x] Sign-out flow (`/api/auth/signout` clears the cookie).

### Storage & CDN
- [x] R2 single-PUT pipeline: `/api/upload` (presign) → browser PUT → `/api/upload/confirm` (ingest into Cloudflare Images + write photo doc).
- [x] R2 multipart pipeline: `/api/upload/multipart/init` (presign N part URLs) → parallel PUTs → `/api/upload/multipart/complete` (writes photo doc with `storageKey`, no CF Images ingestion — used for RAW deliverables).
- [x] Cloudflare Images upload-from-URL, delete, and named-variant CDN URLs via `buildCdnUrl(imageId, variant)` (`thumbnail`, `gallery`, `download`, `public`).
- [x] `lib/upload.ts` client-side multipart orchestrator.
- [x] `lib/storage/{images,r2}.ts` server-only storage helpers; `lib/cloudflare.ts` is the deprecated re-export facade.

### Database — Legacy collections
- [x] `lib/db/users.ts`, `lib/db/events.ts`, `lib/db/photos.ts`, `lib/db/event-access.ts`, `lib/db/bookings.ts` (`bookingInquiries`), `lib/db/mail.ts`, `lib/db/activity.ts`.
- [x] `upsertUser` transactional first-write protection.
- [x] `logActivity` + `listRecentActivity` with empty fallback.

### Database — Unified Client/Project model
- [x] `lib/db/clients.ts` — universal record keyed by email, with `referralCode`, `referralCredit`, `totalSessionsBooked`, `firstTouch*` attribution fields.
- [x] `lib/db/projects.ts` — `ProjectDoc`, `ProjectStatus`, `MessageDoc`; `projects/{id}/messages` subcollection helpers.
- [x] `lib/db/contracts.ts` — `DRAFT | SENT | SIGNED | VOIDED` lifecycle, `renderedHtml`, signer IP/UA capture.
- [x] `lib/db/invoices.ts` — `DEPOSIT | BALANCE | FULL` types, Stripe Payment Link fields.
- [x] `scheduledTasks` collection (consumed by `/api/cron/run-tasks`).
- [x] `lib/project-transitions.ts` — `handleProjectTransition` with per-status hooks (`onBooked`, `onGalleryDelivered`, etc.) plus event auto-create, gallery access grant, session-count increment, referral task scheduling.
- [x] `lib/contract-renderer.ts` — merges project + client into HTML contract templates.

### Public Pages
- [x] Home (`/`), Portfolio (`/portfolio`) with category filter + lightbox.
- [x] Booking (`/booking`) — Zod-validated form → `submitBooking` Server Action → dual-write (clients + projects + messages + bookingInquiries) + activity log + auto-responder email.
- [x] Login (`/login`) — Google, Microsoft, email/password, magic link link entry.
- [x] Login complete (`/login/complete`) for magic link finalisation.
- [x] `not-found.tsx`, `error.tsx`, root `loading.tsx`.

### Admin — Legacy `/admin/bookings` Kanban
- [x] Kanban board with HTML5 drag-and-drop across 5 columns (`PENDING`, `QUALIFIED`, `SENT_PROPOSAL`, `CONTRACT_SENT`, `BOOKED`).
- [x] `LeadDetailDrawer` with Overview / Notes & CRM / Comms / Send Email tabs.
- [x] Lead scoring (`lib/lead-scoring.ts`) — 0-100, currently typed against `BookingInquiryDoc`.
- [x] Tag manager (preset + custom), communication logger (Phone/Email/SMS/In Person), email template selector.
- [x] Smart filters (Hot Leads, Needs Follow-Up, High Value, This Week, Weddings), bulk actions, archive.
- [x] New inquiry modal, event linking via `/api/events-list`, follow-up date, lead source override.
- [x] `sendBookingResponse` → `mail` collection → Trigger Email extension.

### Admin — Unified `/admin/projects` pipeline
- [x] Pipeline page (`app/admin/projects/page.tsx`) + `ProjectsPipelineClientPage.tsx` reads from `projects`.
- [x] Project detail page (`app/admin/projects/[id]/page.tsx`).
- [x] `updateProjectStatus`, `updateProjectDetails` in `app/admin/projects/actions.ts`, each calling `handleProjectTransition`.
- [x] `createDraftContract`, `sendContract` in `app/admin/projects/contract-actions.ts`.
- [x] `sendInvoice` in `app/admin/projects/invoice-actions.ts` (creates Stripe payment link via `lib/stripe.ts`).

### Admin — Events
- [x] Events list (`/admin/events`) with photo + client counts and status badges.
- [x] Event detail (`/admin/events/[id]`) — inline title editor, shoot-date editor, calendar export (Google / Outlook / .ics), upload zone, invite panel, photo grid.
- [x] Gallery editor (`/admin/events/[id]/gallery`) — bulk select + toggle `galleryReady`.
- [x] Loading skeleton, invite-by-email + revoke access, `deleteEventAndAssets` cross-collection cleanup in `lib/domain/events.ts`.

### Admin — Users
- [x] Users page (`/admin/users`) with role badges + event access counts.
- [x] `removeUser` cascades through `eventAccess` and disables the Firebase Auth account.

### Payments & Webhooks
- [x] `lib/stripe.ts` — SDK singleton + `createPaymentLinkForInvoice` (falls back to a mock client when `STRIPE_SECRET_KEY` is missing for local dev).
- [x] `/api/webhooks/stripe` — verifies `stripe-signature` against `STRIPE_WEBHOOK_SECRET`; handles `checkout.session.completed` and `payment_intent.succeeded`.
- [x] Status auto-advance: `DEPOSIT_PENDING → BOOKED` on DEPOSIT paid; `IN_EDITING → GALLERY_DELIVERED` on BALANCE paid. Idempotent on already-`PAID` invoices.
- [x] Invoice correlation via `session.metadata.invoiceId` → `client_reference_id` → `paymentIntent.metadata.invoiceId`.

### Scheduled Jobs
- [x] `/api/cron/run-tasks` — Bearer-token auth against `CRON_SECRET`; drains `scheduledTasks` where `status == "PENDING"` and `runAt <= now`.
- [x] `SEND_REFERRAL` handler — composes the $150 referral email using `client.referralCode` + `NEXT_PUBLIC_APP_URL`, queues into `mail/`.
- [x] `vercel.json` schedule: `0 2 * * *` (daily 02:00 UTC).

### Client Portal
- [x] Gallery list (`/gallery`) with cover photo + count cards.
- [x] Private event gallery (`/gallery/[id]`) — dual auth (session + `eventAccess/{uid}_{eventId}` lookup) with admin override.
- [x] Lightbox with keyboard nav (←, →, Escape), download-request button (currently toast-only — see Missing Features), right-click blocked.

### UI Components
- [x] `Navbar` (role-aware), `Footer`, `Toaster` (event-driven, no context).
- [x] `MasonryGrid` (SSR-friendly CSS columns), `Lightbox`, `HeroSlideshow`.
- [x] `components/admin/AdminSidebar.tsx` (single canonical sidebar with "← Public site" footer link).
- [x] Inline editors: `TitleEditor`, `ShootDateEditor`, `LeadScoreBadge`, `KanbanCard`, `AddToCalendarButton`.

### Settings
- [x] `/settings` page — profile, notifications, connected accounts, sign-out.

---

## In Progress (punch list before the legacy collection can be retired)

- [ ] **Finish migrating admin to `/admin/projects`** so `/admin/bookings` and the entire `bookingInquiries` collection can be deleted. The two admin workspaces currently coexist; the legacy Kanban remains the daily-driver while the projects pipeline gains feature parity.
- [ ] **Remove the legacy `bookingInquiries` write from `app/booking/actions.ts`** — the line flagged `// 4. (Temporary Migration Step)`. This is the last line to delete when retiring the legacy collection. Same goes for `logActivity("LEAD_RECEIVED", …)` once activity is sourced from `projects` instead.
- [ ] **Retype `lib/lead-scoring.ts` against `ProjectDoc`** instead of `BookingInquiryDoc`. Works today only because the relevant fields overlap (ADR-014).
- [ ] **One-time backfill of `referralCode`** on `clients` docs created before the field was added. New docs already get one in `submitBooking`.
- [ ] **Persist `r2Key` on photo docs** from `/api/upload/confirm/route.ts`. The route does not currently save `r2Key`, so the R2 object cannot be deleted when the photo doc is deleted — confirmed in `PhotoGrid.tsx` which carries an `r2Key: string | null` field that is always `null` from the single-PUT pipeline. (The multipart pipeline already writes `storageKey`.)
- [ ] **`galleryReady` filter on `/gallery/[id]`** — `app/gallery/[id]/page.tsx` still calls `.orderBy("uploadedAt", "asc").get()` over the photos subcollection with no `where("galleryReady", "==", true)`. The admin gallery editor sets the flag, but clients see every uploaded photo.
- [ ] **`GalleryViewer` double-columns bug** — `app/gallery/[id]/GalleryViewer.tsx` still wraps `<MasonryGrid columns={4}>` in `<div style={{ columns: 4 }}>`. Drop the outer wrapper.
- [ ] **Settings page persistence** — `app/settings/page.tsx` reads/writes `localStorage` for notification prefs and phone number. Move to Firestore.

---

## Missing Features (designed, not built)

- [ ] **Download fulfillment.** `GalleryViewer.requestDownload` only fires a toast. Needs an API route that signs an R2 GET (or assembles a CF Images zip) and emails the client.
- [ ] **Firestore Security Rules.** No `firestore.rules` file exists. The Admin SDK bypasses rules server-side, but the client SDK is unprotected. **Production blocker.**
- [ ] **Custom Firebase Auth email templates.** Magic link emails use the Firebase default template. Brand it in the Firebase Console.
- [ ] **Pagination** on the growing admin lists (bookings, projects, events, users).
- [ ] **Image category assignment on upload.** Portfolio filters by `category` but the upload zone never sets one.
- [ ] **Photo label editing post-upload.** Labels are seeded from the filename and cannot be edited.
- [ ] **`ARCHIVED` column / view on `/admin/bookings` Kanban.** Archived leads vanish from the board.
- [ ] **Questionnaire system** (Phase 3 in `docs/architecture/unified-client-lifecycle.md`). Schema reserved at `projects/{id}/questionnaires/{id}`; no UI or auto-send.
- [ ] **Shoot Brief auto-generator** (Phase 3). Compose from questionnaire + project data on `SHOOT_READY`.
- [ ] **`AUTO_FOLLOW_UP` cron task body.** Currently a stub (`if (task.type === "AUTO_FOLLOW_UP") { /* … */ }`) in `app/api/cron/run-tasks/route.ts`. Implement the proposal-stuck-too-long and contract-stuck nudges.

---

## Bugs

| # | Location | Description | Severity |
|---|---|---|---|
| 1 | `app/gallery/[id]/GalleryViewer.tsx` | Outer `<div style={{ columns: 4 }}>` wraps `<MasonryGrid columns={4}>`, applying column CSS twice. | Medium |
| 2 | `app/api/upload/confirm/route.ts` | `r2Key` is never written to the photo doc, so R2 cleanup silently no-ops on delete (single-PUT path only — multipart writes `storageKey`). | Medium |
| 3 | `app/gallery/[id]/page.tsx` | `galleryReady` flag is ignored; all uploaded photos are shown to clients regardless of admin curation. | Medium |
| 4 | `app/admin/page.tsx` | Activity feed timestamp renders `"—"` if `toDate()` is unavailable on a stored value; no resilient fallback. | Low |
| 5 | `lib/lead-scoring.ts` | Function is typed against `BookingInquiryDoc` while `/admin/projects` passes `ProjectDoc`-shaped data. Works today via structural compat, but is the wrong contract. | Low |
| 6 | `app/api/upload/confirm/route.ts` | R2 public URL is built as `https://${BUCKET}.${ACCOUNT_ID}.r2.cloudflarestorage.com/${key}` — verify against actual bucket public-access configuration. | Low |

---

## Infrastructure / Deployment Status

| Item | Status | Notes |
|---|---|---|
| Vercel deployment | Ready | Ensure all env vars listed in `CLAUDE.md` are set in the Vercel project. |
| Vercel Cron | Configured | `vercel.json` → `/api/cron/run-tasks` on `0 2 * * *`. |
| `CRON_SECRET` | Required in prod | Route runs unauthenticated if unset (acceptable locally only). |
| Stripe live-mode keys | Required in prod | `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`. The webhook route fails fast if the secret is missing. |
| Stripe webhook endpoint | Configured | Point to `/api/webhooks/stripe`. Listen for `checkout.session.completed` and `payment_intent.succeeded`. |
| Firebase project | Configure | Auth providers, authorized domains, Trigger Email extension. |
| Firebase Trigger Email extension | Install | Configure SMTP provider (Resend / SendGrid) and watch `mail/` collection. |
| Cloudflare R2 bucket | Configure | Create bucket; set CORS for `PUT` from the app domain. |
| Cloudflare Images | Configure | Create variants: `thumbnail` (400px), `gallery` (1200px), `download` (2048px), `public` (800px). |
| Firestore indexes | As needed | `photos` collectionGroup (`category ASC`, `uploadedAt DESC`); follow Firestore error links in logs. |
| Firestore Security Rules | **Missing** | No `firestore.rules` file. **Production blocker.** |
| Custom domain + HTTPS | Configure | Vercel custom domain, Firebase Auth authorized domains. |

---

## Recently Resolved (May 2026 cleanup cycle)

- `lib/firestore.ts` removed; every DB call now imports from `@/lib/db/<collection>`. See ADR-013.
- `AdminSidebar` consolidated to `components/admin/AdminSidebar.tsx`; legacy `app/admin/AdminSidebar.tsx` deleted. ADR-012 marked resolved.
- `NEW UNIFIED CLIENT ARCHITECTURE.txt` relocated from repo root to `docs/architecture/unified-client-lifecycle.md` and adopted as the canonical schema reference.
- Dead code removed: `components/SecureImage.tsx`, `app/admin/bookings/BookingTable.tsx`, `app/admin/bookings/ViewToggle.tsx`.
- `.agents/` foreign-tool artifact removed.
- Per-area `CLAUDE.md` files added under `app/admin/`, `app/admin/bookings/`, `app/api/`, `app/booking/`.
- Stripe + Cron infrastructure documented in ADR-015.
- `__origin` first-touch attribution cookie documented in ADR-016.
