# PROGRESS.md — Korrin's Photos

> Last updated: 2026-05-14
> Source of truth for "what state is the codebase actually in." Update on feature completion, bug discovery/fix, or task abandonment.

---

## Overall Status

Single unified Client/Project pipeline is the canonical surface; the legacy `bookingInquiries` Kanban + `/admin/bookings` directory have been fully retired (May 2026). Phase 0 cleanup, Phase 1 CRM, the questionnaire/welcome-packet/NPS/review-request loop (Phase 2 partials), the sequence engine (Phase 4.2), the tiered referral engine (Phase 4.4), the email open/click tracking layer (Phase 1.6), JSON-LD schema markup (Phase 4.12), Stripe refund + dispute ledger (Phase 3.12), PWA install (Phase 1.10), Firestore Security Rules + firebase.json, and the public `/investment` page (Phase 2.3) are all live. Remaining work tracks the Phase 2.x portal redesign, Phase 3 financial/ops stack, Phase 4.x growth surfaces, Phase 5 AI assists beyond draft reply / thread summary, and the long tail of Phase 6 / Phase 13 "original ideas".

---

## Architecture Snapshot

- **Single canonical pipeline.** `clients`, `projects` + `messages` subcollection, `contracts`, `invoices`, `scheduledTasks`, `sequences` + `sequenceEnrollments`, `questionnaires` + `questionnaireTemplates`, `reviewRequests`, `inboxItems`, `emailEvents`, `paymentIntents` (Stripe mirror), `stripeWebhookEvents` (idempotency), plus legacy `events`, `eventAccess`, `mail`, `activityFeed`, `users`. The legacy `bookingInquiries` collection still exists in Firestore but is no longer written to.
- **No more dual-write.** `app/booking/actions.ts → submitBooking` writes `clients` + `projects` + first inbound `messages` entry + activity log + tracked auto-responder. The legacy `bookingInquiries` insert was removed in the May 2026 retirement commit.
- **`ProjectStatus` is the master state machine** (`SITE_VISIT → INQUIRY → QUALIFYING → PROPOSAL_SENT → NEGOTIATING → CONTRACT_SENT → DEPOSIT_PENDING → BOOKED → SHOOT_READY → IN_EDITING → GALLERY_DELIVERED → REFERRAL_SENT → COMPLETED` with `LOST` / `ARCHIVED`). Every transition runs through `updateProjectStatus → handleProjectTransition` which: resolves the admin's `automationConfig`, fires per-status hooks (`onProjectBooked` / `onProposalSent` / `onContractSent` / `onDepositPending` / `onGalleryDelivered`), enrolls into every active STATUS_CHANGE sequence, and queues recipe-gated `scheduledTasks` (SEND_REFERRAL, AUTO_FOLLOW_UP, SNEAK_PEEK).
- **Stripe + Cron + tracked mail.** `/api/webhooks/stripe` handles `checkout.session.completed`, `payment_intent.succeeded`, `charge.refunded`, and `charge.dispute.created|updated|closed` with event-level idempotency via `stripeWebhookEvents/{id}`. `/api/cron/run-tasks` drains `scheduledTasks` (SEND_REFERRAL, AUTO_FOLLOW_UP by recipeKey, SNEAK_PEEK), dispatches due review requests, and runs sequence enrollments. Every outbound mail flows through `lib/email/tracking.ts > enqueueTrackedMail` which mints a `sendId`, rewrites external links to `/t/c/{sendId}`, injects a `/t/o/{sendId}` pixel, and writes `emailEvents` rows.
- **`__origin` UTM cookie writes first-touch attribution.** `middleware.ts` sets a 30-day JS-readable JSON cookie; `submitBooking` stamps `firstTouch{Source,Medium,Campaign,LandingUrl,At}` on the new `clients` doc and resolves `referralCode` to `referredBy` for the tiered referral engine. See ADR-016.
- **Production security baseline.** `firestore.rules` is in place (default-deny, admin-claim-gated except for owner-scoped reads on `users`/`eventAccess`/`events`); `firebase.json` references it. Client SDK uses Auth only — Firestore reads all go through the server-side Admin SDK.
- **PWA + JSON-LD.** `public/manifest.webmanifest` + `public/sw.js` (production-only registration via `ServiceWorkerRegister`); admin mobile install prompt with 7-day dismiss cookie. Public pages ship `Photographer` (root), `Service` (portfolio + each investment package), and `BreadcrumbList` JSON-LD.
- **`lib/db/*` split complete.** Per-collection helpers in `lib/db/{activity,clients,contracts,email-events,events,inbox,invoices,locations,photos,projects,questionnaires,reviews,saved-views,segments,sequences,sequence-enrollments,users,vendors}.ts`. Cross-collection orchestrations in `lib/domain/` (`events.ts`, `referrals.ts`, `reviews.ts`, `ledger.ts`, `welcome-packet.ts`). `lib/firestore.ts` long gone. See ADR-013.

---

## Completed Features

### Infrastructure & Auth
- [x] Next.js 15 App Router project with TypeScript strict mode.
- [x] Firebase Admin SDK singleton (`lib/firebase-admin.ts`) with `\n` PEM normalisation.
- [x] Firebase Client SDK singleton (`lib/firebase.ts`) — Auth-only on the client.
- [x] 14-day HTTP-only Firebase session cookie (`lib/session.ts`).
- [x] `requireSession()`, `requireAdmin()`, `getSessionUser()` server guards with Firestore role fallback.
- [x] Two-step admin first-login (`needsRefresh` token bounce to attach the `role: "ADMIN"` claim).
- [x] Edge `middleware.ts` — cookie-presence check on `/admin/**` and `/gallery/**`, plus `__origin` UTM attribution cookie write.
- [x] Magic link delivery via Firebase Identity Toolkit (`lib/firebase-email.ts`).
- [x] Google + Microsoft OAuth (popup), email/password sign-up + sign-in.
- [x] `AuthProvider` context with `useAuth()` and magic link completion handler.
- [x] Sign-out flow (`/api/auth/signout` clears the cookie).
- [x] `firestore.rules` + `firebase.json` shipped. Default-deny; admin claim required for non-self collections; owner-scoped reads on users/eventAccess/events.

### Storage & CDN
- [x] R2 single-PUT pipeline: `/api/upload` (presign) → browser PUT → `/api/upload/confirm` (ingest into Cloudflare Images + write photo doc, persists `r2Key` for cleanup).
- [x] R2 multipart pipeline: `/api/upload/multipart/init` → parallel PUTs → `/api/upload/multipart/complete` (writes photo doc with `storageKey`).
- [x] Cloudflare Images upload-from-URL, delete, and named-variant CDN URLs via `buildCdnUrl(imageId, variant)`.
- [x] `lib/upload.ts` client-side multipart orchestrator.
- [x] `lib/storage/{images,r2}.ts` — `listObjectsV2`, `deleteObject`, `generatePresignedGetUrl` added for Files tab + welcome-packet + signed-html storage.
- [x] Download fulfillment: `/api/download/[eventId]` (JSON manifest) + `/api/download/[eventId]/zip` (streaming archiver-v8 zip, 200-photo cap, 413 on overflow). GalleryViewer triggers blob/anchor download with progress toasts.

### Database — Canonical Client/Project model
- [x] `lib/db/clients.ts` — universal record keyed by email, with `referralCode`, `referralCount`, `referralTier`, `referralRewardsLog`, `referralAttributions`, `referralCredit`, `totalSessionsBooked`, `firstTouch*` attribution fields, `lifecycleStage` (derived), `referredBy`.
- [x] `lib/db/projects.ts` — `ProjectDoc`, `ProjectStatus`, `MessageDoc`; `projects/{id}/messages` subcollection helpers; `welcomePacketR2Key`/`welcomePacketGeneratedAt`/`welcomePacketToken`, `clientNps`/`clientNpsAt`, `sneakPeekSentAt`, `discountApplied`.
- [x] `lib/db/contracts.ts` — `DRAFT | SENT | SIGNED | VOIDED` lifecycle, `signingToken` + `tokenExpiresAt`, `signerIp`/`signerUserAgent`/`signerName`/`signerSignatureDataUrl`, `signedPdfR2Key`.
- [x] `lib/db/invoices.ts` — `DEPOSIT | BALANCE | FULL` types, Stripe Payment Link fields, `refundCents`/`refundReason`/`refundedAt`/`disputeStatus`/`disputeReason`/`disputeAmountCents`/`disputeOpenedAt`/`disputeClosedAt`.
- [x] `lib/db/sequences.ts` + `lib/db/sequence-enrollments.ts` — reusable drip definitions + per-client enrollments.
- [x] `lib/db/questionnaires.ts` — `questionnaireTemplates/{id}` + per-project `questionnaires/{id}` (PENDING/COMPLETED), 5 seeded templates (Wedding 18Q, Portrait 12Q, Family 14Q, Editorial 14Q, Engagement 13Q).
- [x] `lib/db/reviews.ts` — `reviewRequests/{id}` (Google/Knot/Facebook rotation).
- [x] `lib/db/email-events.ts` — `emailEvents/{id}` (sent/opened/clicked/bounced/unsub).
- [x] `lib/db/inbox.ts` — `inboxItems/{id}` aggregated triage feed.
- [x] `lib/db/saved-views.ts` — `users/{uid}/views/{id}` per-admin saved pipeline filters.
- [x] `lib/db/segments.ts`, `lib/db/locations.ts`, `lib/db/vendors.ts` — schemas reserved for upcoming phases.
- [x] `scheduledTasks` collection (SEND_REFERRAL, AUTO_FOLLOW_UP, SNEAK_PEEK).
- [x] `lib/project-transitions.ts` — `handleProjectTransition` with per-status hooks (`onProjectBooked`, `onProposalSent`, `onContractSent`, `onDepositPending`, `onGalleryDelivered`) + recipe-gated automations + STATUS_CHANGE sequence fan-out + referral attribution + welcome-packet generation.
- [x] `lib/contract-renderer.ts` — merges project + client into HTML contract templates.
- [x] `lib/domain/referrals.ts` — `applyReferralAttribution` (transactional, idempotent via `referralAttributions[]`). Tier rewards: $50/$100/mini-session/album.
- [x] `lib/domain/reviews.ts` — `maybeScheduleReviewRequests` + cron dispatcher.
- [x] `lib/domain/welcome-packet.ts` — HTML generator + R2 upload + token-gated public route.
- [x] `lib/domain/ledger.ts` — Stripe refund/dispute recorders.
- [x] `lib/email/tracking.ts` — `enqueueTrackedMail` (mints sendId, rewrites links via `/t/c`, injects pixel via `/t/o`, writes `emailEvents` "sent" row).
- [x] `lib/automations/recipes.ts` — 8-recipe catalog (referral, auto-follow-up × 3, balance invoice, questionnaire, welcome packet, sneak peek) + admin config resolver.
- [x] `lib/seo/schema.ts` + `components/JsonLd.tsx` — Photographer / Service / BlogPosting / BreadcrumbList builders.

### Public Pages
- [x] Home (`/`), Portfolio (`/portfolio`) with category filter + lightbox.
- [x] Booking (`/booking`) — multi-page form with localStorage draft + `?package=` prefill from /investment. submitBooking dual-side (clients + projects + messages + activity + tracked auto-responder). NO legacy bookingInquiries write.
- [x] Investment (`/investment`) — editorial header, 4-step process, 3 package cards (The Mini / The Story / The Day), placeholder testimonial, JSON-LD per package.
- [x] Login (`/login`) — Google, Microsoft, email/password, magic link.
- [x] Login complete (`/login/complete`) for magic link finalisation.
- [x] `not-found.tsx`, `error.tsx`, root `loading.tsx`.
- [x] Public sign-contract (`/sign-contract/[id]?t={token}`) — token-validated, draw + type signature, IP/UA capture, HTML completion certificate to R2.
- [x] Public questionnaire (`/questionnaire/[id]`) — URL = credential, 6 input types, idempotent submit.
- [x] Public welcome packet (`/welcome-packet/[projectId]?t={token}`) — token-validated, R2 302 redirect.
- [x] Click-tracking redirector (`/t/c/[sendId]?u=<base64url>`), open-tracking pixel (`/t/o/[sendId]`), review-request redirector (`/r/review/[id]?target=...`).

### Admin — Project Workspace v2 (canonical)
- [x] Pipeline page (`app/admin/projects/page.tsx` + `ProjectsPipelineClientPage.tsx`) — Kanban + table toggle, saved views (Firestore-persisted at `users/{uid}/views`, plus 5 built-in defaults).
- [x] Project detail workspace (`app/admin/projects/[id]/page.tsx` + `ProjectWorkspaceClient.tsx`) — 8 tabs: Overview / Messages / Contract / Invoice / Gallery / Timeline / Files / Notes.
- [x] OverviewTab includes Next-Best-Action chip, NPS badge, review-request progress, welcome-packet block (with Regenerate), questionnaire block.
- [x] MessagesTab with engagement chips (Opened N× / Clicked N×) per outbound message via emailEvents aggregation.
- [x] InvoiceTab with LedgerBadges (refund / dispute state).
- [x] FilesTab — drag-drop file upload to `projects/{id}/files/` in R2 via three new API routes.
- [x] Server Actions: `updateProjectStatus`, `updateProjectDetails`, `regenerateWelcomePacket`; `createDraftContract`, `sendContract`; `sendInvoice`; `sendProjectMessage`; sequence enrollment; questionnaire send; saved views CRUD.
- [x] Bulk archive (`bulkArchiveProjects`).

### Admin — Sequences, Inbox, Settings, Questionnaires
- [x] `/admin/sequences` — list + builder for status-triggered and date-triggered drips. 6 seeded default sequences (cold-lead nurture, shoot-day countdown, sneak peek delivery, review request, anniversary touch, win-back). Status-trigger fan-out from `handleProjectTransition`.
- [x] `/admin/inbox` — unified `inboxItems` triage feed with keyboard nav, snooze, archive.
- [x] `/admin/settings/automations` — 8-recipe configuration UI persisted to `users/{uid}.automationConfig`.
- [x] `/admin/questionnaires/templates` — list + create/edit templates with reorderable questions; manual-send button on project workspace.
- [x] Cmd+K command palette globally in admin (`components/ui/CommandPalette.tsx`).

### Admin — Events
- [x] Events list (`/admin/events`) with photo + client counts and status badges.
- [x] Event detail (`/admin/events/[id]`) — inline title editor, shoot-date editor, calendar export (Google / Outlook / .ics), upload zone, invite panel, photo grid.
- [x] Gallery editor (`/admin/events/[id]/gallery`) — bulk select + toggle `galleryReady`.
- [x] Canonical `EventStatus = "UPCOMING" | "ACTIVE" | "COMPLETED" | "DELIVERED" | "ARCHIVED"` with `scripts/migrate-event-status.ts` 14-key legacy normalizer (dry-run default).

### Admin — Users + Dashboard
- [x] `/admin` dashboard reads from `projects` + `clients` (legacy `bookingInquiries` reader removed).
- [x] Users page (`/admin/users`) with role badges + event access counts.
- [x] `removeUser` cascades through `eventAccess` and disables the Firebase Auth account.

### Payments & Webhooks
- [x] `lib/stripe.ts` — SDK singleton + `createPaymentLinkForInvoice` (falls back to a mock client when `STRIPE_SECRET_KEY` is missing for local dev).
- [x] `/api/webhooks/stripe` — verifies signature; handles `checkout.session.completed`, `payment_intent.succeeded`, `charge.refunded`, `charge.dispute.created|updated|closed`. Event-level idempotency via `stripeWebhookEvents`; doc-level via `refundCents` / dispute timestamps.
- [x] Status auto-advance: `DEPOSIT_PENDING → BOOKED` on DEPOSIT paid; `IN_EDITING → GALLERY_DELIVERED` on BALANCE paid.
- [x] Refund + dispute ledger; auto inbox items (`PAYMENT_REFUNDED`, `PAYMENT_DISPUTE_CREATED`, `PAYMENT_DISPUTE_CLOSED`).
- [x] Referral credit auto-applied to invoices (idempotent via `projects.discountApplied`); Stripe Payment Link regen against discounted total.

### Scheduled Jobs
- [x] `/api/cron/run-tasks` — Bearer-token auth against `CRON_SECRET`.
- [x] `SEND_REFERRAL` handler.
- [x] `AUTO_FOLLOW_UP` handler with `recipeKey`-based routing (proposal/contract/deposit templates, idempotent enqueue from `maybeScheduleFollowUp`).
- [x] `SNEAK_PEEK` handler (5 sneak-peek-tagged photos, `sneakPeekSentAt` idempotency).
- [x] Review-request dispatcher (`dispatchPendingReviewRequests`).
- [x] Sequence-enrollment drain (`runDueSequences`).
- [x] `vercel.json` schedule: `0 2 * * *`.

### Client Portal
- [x] Gallery list (`/gallery`) with cover photo + count cards.
- [x] Private event gallery (`/gallery/[id]`) — dual auth + `galleryReady` filter applied + 5-star NPS widget on DELIVERED.
- [x] Lightbox with keyboard nav, right-click blocked, full-gallery zip download.

### UI Components
- [x] `Navbar` (role-aware, with /investment), `Footer`, `Toaster`.
- [x] `MasonryGrid`, `Lightbox`, `HeroSlideshow`.
- [x] `components/admin/AdminSidebar.tsx` (single canonical sidebar; legacy "Booking Inquiries" entry removed).
- [x] `components/ui/CommandPalette.tsx` (Cmd+K).
- [x] `components/admin/InstallPrompt.tsx` (mobile PWA install banner).
- [x] `components/ServiceWorkerRegister.tsx`.
- [x] `components/JsonLd.tsx`.

### Settings
- [x] `/settings` page — profile, notifications, connected accounts, sign-out. Notification prefs + phone persisted to `users/{uid}` (no more localStorage).

---

## In Progress

(Currently empty — the May 2026 punch list is fully closed. Next cycle's items live under "Missing Features" below.)

---

## Missing Features (designed, not built)

### Phase 1 leftovers
- [ ] **Phase 1.5 — Two-way Gmail sync.** OAuth + Pub/Sub watch → inbound mail matched to clients via `From` header. External Google Cloud project required.
- [ ] **Phase 1.8 — Public scheduler `/book/[packageSlug]`.** Calendar UI + Stripe Checkout deposit-on-book. Depends on Phase 3.3 Google Calendar sync.

### Phase 2 — Client Experience v2
- [ ] **Phase 2.1 — Multi-step booking inquiry** beyond the current draft persistence.
- [ ] **Phase 2.2 — Style quiz + mood board** (`/style`).
- [ ] **Phase 2.4 — Portal redesign `/portal/[projectId]`** with tabs mirroring admin workspace.
- [ ] **Phase 2.5 — Gallery favorites + proofing.**
- [ ] **Phase 2.6 — Gallery polish:** slideshow with music, mobile gestures, download PIN, resolution tiers picker.
- [ ] **Phase 2.8 — Day-of-shoot timeline builder.**

### Phase 3 — Business Operations
- [ ] **Phase 3.1 — Financial dashboard `/admin/reports/finance`.**
- [ ] **Phase 3.2 — Expense tracking + tax dashboard `/admin/reports/tax`.**
- [ ] **Phase 3.3 — Google Calendar two-way sync.**
- [ ] **Phase 3.4 — Shoot brief auto-generator (24h pre-shoot PDF).**
- [ ] **Phase 3.5 — Location scouting `/admin/locations`** (schema reserved; UI not built).
- [ ] **Phase 3.6 — Weather + golden-hour intelligence** (`lib/weather.ts` and `lib/golden-hour.ts` adapters exist; not wired into shoot brief).
- [ ] **Phase 3.7 — Gear checklist per shoot type.**
- [ ] **Phase 3.8 — Vendor / collaborator CRM `/admin/vendors`** (schema reserved; UI not built).
- [ ] **Phase 3.9 — COI request workflow.**
- [ ] **Phase 3.10 — Compliance dashboard.**
- [ ] **Phase 3.11 — Sales tax engine.**
- [ ] **Phase 3.13 — Editing-workflow tracker** (status pills, aging alerts).
- [ ] **Phase 3.14 — Capacity planning `/admin/calendar`** heatmap.

### Phase 4 — Growth Engine
- [ ] **Phase 4.1 — Lead magnets.**
- [ ] **Phase 4.3 — Segments + broadcast composer** (`lib/db/segments.ts` schema reserved).
- [ ] **Phase 4.5 — Referral chain visualization `/admin/reports/referrals`** (Sankey or force-directed).
- [ ] **Phase 4.7 — Press submission tracker.**
- [ ] **Phase 4.8 — Journal post auto-drafter** (`/journal/[slug]`).
- [ ] **Phase 4.9 — Campaign / venue landing pages `/c/[slug]`.**
- [ ] **Phase 4.10 — Pinterest auto-pin** (external API).
- [ ] **Phase 4.11 — UGC monitor** (Instagram Graph API).
- [ ] **Phase 4.13 — Digital products store** (optional; only if Korrin sells presets/courses).

### Phase 5 — AI Assist Layer
- [x] **Phase 5.1 + 5.2 — AI Draft Reply + Thread Summary** (shipped earlier; the rest of Phase 5 below is pending).
- [ ] **Phase 5.3 — Sentiment scoring on inbound.**
- [ ] **Phase 5.4 — Next-best-action chip** (Action Cards pattern already partially present in OverviewTab; needs scoring).
- [ ] **Phase 5.5 — AI parallel lead score.**
- [ ] **Phase 5.6 — AI booking-form interpreter** (entity extraction from free-text).
- [ ] **Phase 5.7 — Journal post first draft.**
- [ ] **Phase 5.8 — AI mood-board generator** (depends on Phase 2.2).
- [ ] **Phase 5.9 — Cohort story generator** (depends on Phase 3.1).
- [ ] **Phase 5.10 — AI tax suggestion engine** (depends on Phase 3.2).

### Original ideas (Phase 13)
- [ ] **13.2 — Studio Hours** (auto-responder during off-hours).
- [ ] **13.4 — Booking-form post-submit calendar embed.**
- [ ] **13.5 — "Korrin's picks" overlay** in gallery.
- [ ] **13.6 — Recurring revenue layer** (annual family update sessions).
- [ ] **13.7 — Local SEO autopilot.**
- [ ] **13.8 — Tax-saving calendar.**
- [ ] **13.9 — Quiet Season planner.**
- [ ] **13.10 — Gallery analytics for the client.**
- [ ] **13.11 — Cross-vendor wedding-day room.**
- [ ] **13.12 — "Off the record" notes** toggle.
- [ ] **13.13 — Brand voice calibration prompt.**
- [ ] **13.15 — First 100 Clients dashboard.**
- [ ] **13.16 — Far-future-date risk flag.**
- [ ] **13.17 — Commercial Brand Brief workflow.**
- [ ] **13.18 — Ad-spend / ROAS tracking.**
- [ ] **13.19 — Vendor reciprocity tracking** (depends on 3.8).

### Other
- [ ] **Custom Firebase Auth email templates.** Magic link emails use the Firebase default. Brand in the Firebase Console.
- [ ] **Pagination** on growing admin lists (projects, events, users) — not urgent at current scale.
- [ ] **Image category assignment on upload.** Portfolio filters by `category`; the upload zone never sets one.
- [ ] **Photo label editing post-upload.** Labels seeded from filename; cannot be edited.
- [ ] **Real PNG icons** for PWA manifest (currently favicon placeholder for 192 + 512).
- [ ] **Drop the unused legacy exports from `lib/booking-kanban.ts`** (`LeadStatus`, `LeadSource`, `KANBAN_STATUSES`, `PRESET_TAGS`, `ALL_STATUSES`). Only `CommunicationChannel` is still consumed by `MessageDoc` — move it to `lib/db/projects.ts` and delete the file.
- [ ] **Follow-up date editor UI** on the project workspace (field exists on `ProjectDoc`, no editor).
- [ ] **Manual multi-channel comms entry** on the project workspace (channel selection for PHONE / IN_PERSON / SMS — currently can be captured in NotesTab).

---

## Bugs

| # | Location | Description | Severity |
|---|---|---|---|
| 1 | `app/api/upload/confirm/route.ts` | R2 public URL is built as `https://${BUCKET}.${ACCOUNT_ID}.r2.cloudflarestorage.com/${key}` — verify against actual bucket public-access configuration. | Low |

(Bugs 1-6 from the previous cycle were resolved in the Wave 1–3 commits: GalleryViewer double-columns, `r2Key` persistence, `galleryReady` filter, activity feed timestamp fallback, lead-scoring typing.)

---

## Infrastructure / Deployment Status

| Item | Status | Notes |
|---|---|---|
| Vercel deployment | Ready | Ensure all env vars listed in `CLAUDE.md` are set in the Vercel project. |
| Vercel Cron | Configured | `vercel.json` → `/api/cron/run-tasks` on `0 2 * * *`. |
| `CRON_SECRET` | Required in prod | Route runs unauthenticated if unset (acceptable locally only). |
| Stripe live-mode keys | Required in prod | `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`. |
| Stripe webhook endpoint | Configured | Point to `/api/webhooks/stripe`. Subscribe to: `checkout.session.completed`, `payment_intent.succeeded`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`. |
| Firebase project | Configure | Auth providers, authorized domains, Trigger Email extension. |
| Firebase Trigger Email extension | Install | Configure SMTP provider (Resend / SendGrid) and watch `mail/` collection. |
| Firestore Security Rules | **Deployed** | `firestore.rules` + `firebase.json` in repo. Deploy via `firebase deploy --only firestore:rules`. |
| Cloudflare R2 bucket | Configure | Create bucket; set CORS for `PUT` from the app domain. |
| Cloudflare Images | Configure | Create variants: `thumbnail` (400px), `gallery` (1200px), `download` (2048px), `public` (800px). |
| Firestore indexes | As needed | `scheduledTasks(type, projectId, recipeKey, status)` for idempotent AUTO_FOLLOW_UP guard. Follow Firestore error links in logs. |
| `REVIEW_LINK_GOOGLE` / `KNOT` / `FACEBOOK` | Required for review request | Cron falls back to platform home pages if missing. |
| `TOMORROW_IO_API_KEY` | Optional (Phase 3.6) | `lib/weather.ts` returns null without it. |
| Custom domain + HTTPS | Configure | Vercel custom domain, Firebase Auth authorized domains. |

---

## Recently Resolved

### May 2026 — Waves 1-4 (single session, all parallel)

**Wave 1** (commit `716a95e`): firestore.rules + firebase.json, settings → Firestore, EventDoc.status canonical 5-value union + migration script, AUTO_FOLLOW_UP cron handler, download fulfillment (single + zip), tiered referral engine, questionnaire engine + 5 seeded templates, JSON-LD schema markup, lead-scoring structural retype, saved views → Firestore.

**Wave 2** (commit `7c01675`): E-sign signing page (`/sign-contract/[id]?t={token}` with crypto.timingSafeEqual + HTML certificate), 8-recipe automations UI at `/admin/settings/automations`, PWA manifest + SW + install prompt, multi-step review request flow (Google/Knot/Facebook rotation gated on NPS ≥ 4 + cron dispatcher + `/r/review/[id]` click tracker).

**Wave 3** (commit `7b5b41b`): Email open/click tracking layer (`enqueueTrackedMail` + `/t/o` + `/t/c`); swept 16 mail-enqueue call sites; engagement chips on MessagesTab. SNEAK_PEEK cron handler. AUTO_FOLLOW_UP idempotency restored + cron handler refactored to route on `recipeKey` (fixed silent template mismatch where every nudge was the contract template).

**Wave 4** (commit pending): `/investment` public page + booking prefill, welcome packet HTML generator + R2 + token-gated route + BOOKED hook, Stripe refund + dispute ledger (`charge.refunded` + `charge.dispute.*`).

**Legacy retirement** (same commit as Wave 4): Deleted `app/admin/bookings/` (15 files) + `lib/db/bookings.ts`. Removed the dual-write from `app/booking/actions.ts`. `/admin` dashboard now reads from `projects`. AdminSidebar + CommandPalette updated. Root + 5 area CLAUDE.md files refreshed.

### Earlier May 2026 cleanup cycle
- `lib/firestore.ts` removed (ADR-013).
- AdminSidebar consolidated; legacy `app/admin/AdminSidebar.tsx` deleted (ADR-012 resolved).
- `NEW UNIFIED CLIENT ARCHITECTURE.txt` relocated to `docs/architecture/unified-client-lifecycle.md`.
- Dead code removed: `components/SecureImage.tsx`, `app/admin/bookings/BookingTable.tsx`, `app/admin/bookings/ViewToggle.tsx`.
- `.agents/` foreign-tool artifact removed.
- Per-area `CLAUDE.md` files added.
- Stripe + Cron infrastructure documented in ADR-015.
- `__origin` first-touch attribution cookie documented in ADR-016.
