# PROGRESS.md — Korrin's Photos

> Last updated: 2026-05-14 (post-Wave-11)
> Source of truth for "what state is the codebase actually in." Update on feature completion, bug discovery/fix, or task abandonment.

---

## Overall Status

Wave 11 closes the differentiation-polish backlog. Wave 9 shipped the multi-step booking wizard (2.1), public style quiz (2.2), gallery analytics (13.10), off-the-record notes (13.12), brand voice calibration (13.13), First 100 Clients dashboard (13.15), Commercial Brand Brief auto-attach (13.17), and vendor reciprocity tracking (13.19). Wave 10 added local SEO autopilot (13.7), quiet season planner (13.9), image category + label editing on uploads, /admin/users pagination, an admin-wide global search (`/admin/search`), and resolved the R2 public-URL bug. Wave 11 added the digital products store (4.13), a dedicated `/admin/clients` listing + detail surface, the `/admin/health` operational dashboard, and an `/admin/exports` CSV center. Single unified Client/Project pipeline remains the canonical surface; the legacy `bookingInquiries` Kanban + `/admin/bookings` directory were retired in May 2026. The remaining backlog is now exclusively the external-dependency items (1.5 Gmail, 1.8 scheduler-on-3.3, 3.3 Google Calendar, 4.10 Pinterest, 4.11 Instagram, 5.3-5.10 AI assists needing `ANTHROPIC_API_KEY`) plus the always-optional 13.4 booking-form calendar embed and 13.11 cross-vendor day-of room.

---

## Architecture Snapshot

- **Single canonical pipeline.** `clients`, `projects` + `messages` + `gearLog` + `pressSubmissions` + `dayOfTimeline` subcollections, `contracts`, `invoices`, `scheduledTasks` (SEND_REFERRAL | AUTO_FOLLOW_UP | SNEAK_PEEK | SHOOT_BRIEF), `sequences` + `sequenceEnrollments`, `questionnaires` + `questionnaireTemplates`, `gearTemplates`, `reviewRequests`, `inboxItems` (with CLIENT_MESSAGE, RE_ENGAGEMENT_DUE, FAR_FUTURE_RISK, COI_REQUESTED, COI_RECEIVED, SALES_TAX_OVERDUE, PRESS_LINK_DOWN types), `emailEvents`, `paymentIntents` (Stripe mirror), `stripeWebhookEvents` (idempotency), `locations`, `vendors`, `segments`, `broadcasts`, `expenses`, `assets`, `analyticsCache`, `leadMagnets`, `leadMagnetDownloads`, `journalPosts`, `campaigns`, `adSpendEntries`, `dataRequests`, `salesTaxFilings`, `styleProfiles` (Wave-9), `products` + `productPurchases` (Wave-11), plus legacy `events`, `eventAccess`, `mail`, `activityFeed`, `users`. The legacy `bookingInquiries` collection still exists in Firestore but is no longer written to. `users/{uid}.brandVoiceSamples` (Wave-9) holds Korrin's voice anchors for future AI assists.
- **No more dual-write.** `app/booking/actions.ts → submitBooking` writes `clients` + `projects` + first inbound `messages` entry + activity log + tracked auto-responder. The legacy `bookingInquiries` insert was removed in the May 2026 retirement commit.
- **`ProjectStatus` is the master state machine** (`SITE_VISIT → INQUIRY → QUALIFYING → PROPOSAL_SENT → NEGOTIATING → CONTRACT_SENT → DEPOSIT_PENDING → BOOKED → SHOOT_READY → IN_EDITING → GALLERY_DELIVERED → REFERRAL_SENT → COMPLETED` with `LOST` / `ARCHIVED`). Every transition runs through `updateProjectStatus → handleProjectTransition` which: resolves the admin's `automationConfig`, fires per-status hooks (`onProjectBooked` / `onProposalSent` / `onContractSent` / `onDepositPending` / `onGalleryDelivered`), enrolls into every active STATUS_CHANGE sequence, and queues recipe-gated `scheduledTasks` (SEND_REFERRAL, AUTO_FOLLOW_UP, SNEAK_PEEK).
- **Stripe + Cron + tracked mail.** `/api/webhooks/stripe` handles `checkout.session.completed`, `payment_intent.succeeded`, `charge.refunded`, and `charge.dispute.created|updated|closed` with event-level idempotency via `stripeWebhookEvents/{id}`. `/api/cron/run-tasks` drains `scheduledTasks` (SEND_REFERRAL, AUTO_FOLLOW_UP by recipeKey, SNEAK_PEEK), dispatches due review requests, and runs sequence enrollments. Every outbound mail flows through `lib/email/tracking.ts > enqueueTrackedMail` which mints a `sendId`, rewrites external links to `/t/c/{sendId}`, injects a `/t/o/{sendId}` pixel, and writes `emailEvents` rows.
- **`__origin` UTM cookie writes first-touch attribution.** `middleware.ts` sets a 30-day JS-readable JSON cookie; `submitBooking` stamps `firstTouch{Source,Medium,Campaign,LandingUrl,At}` on the new `clients` doc and resolves `referralCode` to `referredBy` for the tiered referral engine. See ADR-016.
- **Production security baseline.** `firestore.rules` is in place (default-deny, admin-claim-gated except for owner-scoped reads on `users`/`eventAccess`/`events`); `firebase.json` references it. Client SDK uses Auth only — Firestore reads all go through the server-side Admin SDK.
- **PWA + JSON-LD.** `public/manifest.webmanifest` + `public/sw.js` (production-only registration via `ServiceWorkerRegister`); admin mobile install prompt with 7-day dismiss cookie. Public pages ship `Photographer` (root), `Service` (portfolio + each investment package), and `BreadcrumbList` JSON-LD.
- **`lib/db/*` split complete.** Per-collection helpers in `lib/db/{activity,analytics-cache,assets,broadcasts,campaigns,clients,contracts,email-events,events,expenses,gear-log,gear-templates,inbox,invoices,journal-posts,lead-magnet-downloads,lead-magnets,locations,photos,press-submissions,products,projects,questionnaires,reviews,saved-views,segments,sequences,sequence-enrollments,style-profiles,users,vendors}.ts`. Cross-collection orchestrations in `lib/domain/` (`events.ts`, `referrals.ts`, `reviews.ts`, `ledger.ts`, `welcome-packet.ts`, `analytics.ts`, `shoot-brief.ts`, `weather-snapshots.ts`, `capacity.ts`, `journal-drafter.ts`, `lead-magnets.ts`, `press-backlinks.ts`, `referral-graph.ts`, `quiet-season.ts`). Broadcast send orchestration in `lib/broadcasts/sender.ts`; segment predicate resolver in `lib/segments/resolver.ts`. Pure admin search at `lib/admin/search.ts`; CSV export helper at `lib/csv.ts`; static city seeds at `lib/seo/cities.ts`. Isomorphic editing helpers at `lib/editing-sla.ts` + `lib/editing-status.ts`. `lib/firestore.ts` long gone. See ADR-013.

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

### Admin — Locations + Vendors (Phase 3.5 / Phase 3.8)
- [x] `/admin/locations` list + detail (`LocationsClientPage` + `[id]/LocationDetailClient`) — search/sort/filter, modal create, inline edit, delete-confirm. Schema in `lib/db/locations.ts`; types include `LocationType` (8-value union), `bestLightWindow`, permit fields, accessibility, capacity, `sampleEventIds[]`, `recordVisit` idempotent helper.
- [x] `/admin/vendors` list + detail (`VendorsClientPage` + `[id]/VendorDetailClient`) — categories (Venue/Planner/Florist/HMUA/Videographer/DJ/Officiant/Rentals), rating, cross-referral counter, notes. Schema in `lib/db/vendors.ts`.
- [x] AdminSidebar wires both under the **Content** group.

### Admin — Finance + Tax (Phase 3.1, 3.2, 13.8)
- [x] `/admin/reports/finance` — 6 KPI tiles (YTD revenue, deposit liability, AR aging, net margin, avg project value, conversion rate) + 4 Recharts (revenue trend, revenue-by-type donut, revenue-by-source bar, Stripe payout schedule). Daily cron snapshot via `lib/domain/analytics.ts > recomputeFinanceCache` → `analyticsCache/finance:YYYY-MM-DD`. Page reads the cache row for <300ms loads.
- [x] `/admin/reports/tax` — quarterly estimated payment + reserve, Schedule C category donut, mileage log @ `$0.70/mi`, equipment depreciation schedule (`lib/db/assets.ts` — MACRS_5 / MACRS_7 / SECTION_179 / BONUS / NONE with half-year-convention tables), YTD P&L, **tax-saving calendar** (Phase 13.8) flagging quarterly due dates + Section 179 election windows. Expense entry modal with Schedule C lines 8–27 + OTHER.
- [x] `/api/expenses/export?year=YYYY` — QBSE-compatible CSV export.

### Admin — Segments + Broadcasts (Phase 4.3)
- [x] `/admin/segments` — predicate builder (`SegmentsClientPage` + `[id]/SegmentBuilderClientPage`). `lib/segments/resolver.ts` resolves a SegmentDoc into a `clients[]` set. 5 starter segments seeded via `scripts/seed-segments.ts`: All Clients / Booked Last 90d / Past Clients 12mo+ / Ghosted Leads / Engaged.
- [x] `/admin/broadcasts` — block-based composer (`BroadcastsListClientPage` + `[id]/BroadcastComposerClientPage`); blocks = Hero, ImageGrid, Text, CTA, Footer. `BroadcastDoc.status: DRAFT|SCHEDULED|SENDING|SENT`. Send orchestration in `lib/broadcasts/sender.ts` writes per-recipient `sendIdsByRecipient` and fans out through `enqueueTrackedMail`. Cron drain for `SCHEDULED` broadcasts in `/api/cron/run-tasks`.

### Gallery favorites + Korrin's picks (Phase 2.5 / Phase 13.5)
- [x] Client-side favorites toggle on `/gallery/[id]` (`GalleryViewer`); persists to `events/{id}/photos/{photoId}.favoritedByClient`.
- [x] Korrin's-picks overlay — admin marks photos via `app/admin/events/[id]/gallery/actions.ts`; gallery renders a "Korrin's pick" badge on flagged photos.
- [x] `/api/download/[eventId]/favorites` streams a zip of only the client's favorites (200-cap, 413 overflow), parallel to the full-gallery zip route.

### Admin — Shoot ops loop (Phase 3.4, 3.6, 3.7)
- [x] **Shoot brief auto-generator** (Phase 3.4). `lib/domain/shoot-brief.ts > generateShootBriefHtml | generateAndStoreShootBrief | dispatchShootBriefEmail`. Daily cron sweep `scheduleDueShootBriefs` queues a `SHOOT_BRIEF` `scheduledTasks` row for any `BOOKED`/`SHOOT_READY` project whose `shootDate` is ≤ 24h out and `shootBriefGeneratedAt` is unset (idempotent on `(type, projectId)`). Cron handler renders editorial HTML → R2 (`shoot-briefs/{projectId}/{ts}.html`) → tracked email to Korrin with an 8h presigned GET URL. Brief composes client / project / location / weather / golden+blue hour / questionnaire / vendors / gear with graceful "not yet" fallbacks for every section. OverviewTab "Shoot brief" block (View / Regenerate / Generate-now / scheduled-auto states).
- [x] **Weather + golden-hour persistence** (Phase 3.6). `WeatherSnapshot` widened to carry `feelsLike`, `low`, `high`, `precipChance`, `windMph`, `humidityPct`, `isOutdoorFriendly`, `forecastForHorizonHours` (72|24), and `sunTimes` (9 ISO strings). `lib/domain/weather-snapshots.ts > refreshWeatherSnapshotsDue` runs each cron tick; writes a snapshot when `shootDate - now ∈ (24h, 72h]` (and not already a 72h pass) or `≤ 24h` (and not already a 24h pass). Skips silently on missing lat/lng or missing `TOMORROW_IO_API_KEY`. `weatherSnapshotIndoor: boolean` admin override on `ProjectDoc`; `WeatherCard` in OverviewTab with three states (indoor / pending / snapshot) and an `IndoorToggle` client child.
- [x] **Gear checklist per shoot type** (Phase 3.7). New `gearTemplates/{id}` collection (`GearTemplateDoc` with `items: GearItem[]`, per-`sessionType` defaults) and `projects/{id}/gearLog` subcollection (`GearLogEntryDoc` with denormalized `name`/`category`/`required` so renames don't break history). `/admin/settings/gear-templates` CRUD with reorderable items, category dropdown, required toggle, set-default. Project workspace `GearTab` (between Files and Notes): empty state → "Initialize from {default kit}" CTA → category-grouped check-off list with progress chip + required-outstanding badge + ad-hoc add. Idempotent `scripts/seed-gear-templates.ts` seeds Wedding / Portrait / Family / Editorial / Engagement kits.

### Admin — Editing tracker + Capacity heatmap (Phase 3.13, 3.14)
- [x] **Editing-workflow tracker** (Phase 3.13). `EditingSubStage` union (`INGESTION | CULLED | EDITED | EXPORTED | DELIVERED`) + `editingSubStageHistory[]` on `ProjectDoc`. Per-sessionType SLA in `lib/editing-sla.ts` (Wedding 56d, Editorial 28d, Commercial 21d, Engagement 14d, Portrait 10d, Family 10d, default 14d). Pure `computeEditingStatus` in `lib/editing-status.ts` returns `{ daysIn, slaDays, pct, status: ON_TRACK | AT_RISK | OVERDUE, pillLabel }`. Pipeline table renders an "Editing — Day 18 of 28" pill with coloured dot only when `status == IN_EDITING`. 5-step stepper in OverviewTab; flipping to `DELIVERED` delegates to `updateProjectStatus(projectId, "GALLERY_DELIVERED")` so `handleProjectTransition` fires exactly once.
- [x] **Capacity heatmap** (Phase 3.14). `/admin/calendar` — `lib/domain/capacity.ts > buildCapacityHeatmap` returns 64 sequential Monday-anchored `WeekBucket`s (12 back + 52 forward) joined to project metadata. 13-column grid; per-cell colour scale (empty / <50% / 50-100% / 100-150% / >150% of `WEEKLY_CAP=3`); click-to-open side panel listing the week's projects with travel placeholder.

### Client portal + gallery polish + timeline (Phase 2.4, 2.6, 2.8)
- [x] **Client portal** (Phase 2.4). `/portal/[projectId]` — 7 tabs (Overview / Documents / Invoices / Timeline / Gallery / Inspiration / Contact). Auth via `requireSession()` + email match against `clients/{clientId}.email` (ADMIN bypass for preview). Client → admin messages write INBOUND `messages` rows, queue a `CLIENT_MESSAGE` inbox item, and email Korrin via `enqueueTrackedMail`. `/portal/router` resolves the signed-in user to their most-recent project. Public Navbar gains "My Portal".
- [x] **Gallery polish** (Phase 2.6). Slideshow overlay (Space/Esc/arrow nav, 3/5/8s auto-advance, optional muted music via `/audio/gallery-loop.mp3` placeholder). Touch-swipe (60px horizontal advance, 120px vertical dismiss) on Lightbox + SlideshowOverlay. `EventDoc.downloadPin` (constant-time `crypto.timingSafeEqual` compare) gates zip / favorites / per-photo downloads with 3-retry + 60s lockout. Resolution-tier picker (`web` → CF `gallery`, `print` → CF `download`, `original` → R2 presigned with `MANIFEST.txt` fallback note).
- [x] **Day-of-shoot timeline** (Phase 2.8). `projects/{id}/dayOfTimeline` subcollection (`TimelineBlockType` union, HH:mm `startTime` string, `durationMinutes`, `location`, `blockType`, `visibleToClient`). Workspace "Day-of" tab with native HTML5 drag-reorder and `runTransaction`-backed `reorderTimelineBlocks`. Phase 3.4 shoot brief composes the schedule section when present (defensive direct Firestore read).

### Admin — Compliance triangle (Phase 3.9, 3.10, 3.11)
- [x] **COI request workflow** (Phase 3.9). 9 COI fields on `ProjectDoc` + per-admin `users/{uid}.insurerContact`. Contract-tab `CoiBlock` toggles requirement, edits venue + additional-insured language, sends a templated tracked email to the insurer + a CC copy to Korrin, presigns an R2 PUT for the PDF upload, and writes `coiReceivedAt` on confirm. Pipeline `CoiChip` surfaces overdue COI within 14d of shoot. `/admin/settings/insurer` form.
- [x] **Compliance dashboard** (Phase 3.10). `/admin/reports/compliance` with 4 sections — contracts (booked-without-signed list), COI (defensive read of B1 fields), data requests (new `dataRequests` collection with 30-day GDPR/CCPA dueBy clock + `OPEN | IN_PROGRESS | FULFILLED | REJECTED` states), sales tax (dynamic-import of B3 module). "Log new request" modal. AdminSidebar entry under **Reports**.
- [x] **Sales tax engine** (Phase 3.11). Pure `lib/sales-tax-rules.ts` with 12 state rules (NC/SC/VA/GA/FL/TN/MD/DC/NY/CA/TX + OTHER fallback) keyed by `digitalPhotosTaxable` + `printsTaxable` + `ratePct` + filing cadence. `InvoiceDoc` gains `subtotalCents` + `taxCents` + `taxStateCode` + `taxRatePct`; `project-transitions` computes the breakdown on DEPOSIT / BALANCE writes and keeps `amountCents = subtotal + tax` so Stripe Payment Links keep working unchanged. `salesTaxFilings` collection with idempotent `regenerateUpcomingFilings` cron + DUE_SOON → OVERDUE auto-flip + dedup'd `SALES_TAX_OVERDUE` inbox emit. `/admin/reports/sales-tax` (overdue + upcoming + ledger + CSV export). `/admin/settings/tax` config (master switch, default state, per-state overrides).

### Recurring revenue + risk + studio hours + ad spend (Phase 13.2, 13.6, 13.16, 13.18)
- [x] **Recurring revenue layer** (Phase 13.6). `ClientDoc.recurringCadence` (`ANNUAL | SEMI_ANNUAL | NONE`) + `recurringNextPromptAt` + `recurringPromptsSent` + `lastReengagementInboxItemAt`. `onGalleryDelivered` seeds `ANNUAL` with `deliveredAt + 11 months` for Wedding / Family / Portrait / Engagement (never overrides admin choice). Cron sweep `sweepRecurringClientPrompts` enqueues `RE_ENGAGEMENT_DUE` inbox rows (30-day idempotency guard) and advances `recurringNextPromptAt`. Inline inbox panel: "Send re-engagement email now" + "Snooze 30 days" with subject/body textareas; project workspace `RecurringRevenueBlock` shows current cadence with snooze.
- [x] **Far-future-date risk flag** (Phase 13.16). Pure `lib/far-future-risk.ts > assessFarFutureRisk` returns `{ risk: NONE|WATCH|FLAG|STALE, monthsOut, depositLocked, lastContactedDaysAgo, reason }` with STALE > FLAG > WATCH precedence (STALE = `monthsOut >= 14 && lastContactedDaysAgo > 60`, FLAG = `monthsOut >= 14 && !depositLocked`, WATCH = `9 <= monthsOut < 14`). Risk dots on the pipeline (kanban + table) and ⚠ glyph on capacity heatmap cells; side-panel chip with the reason. Cron emits `FAR_FUTURE_RISK` inbox rows, idempotent per `(projectId, type)`.
- [x] **Studio Hours auto-responder** (Phase 13.2). `users/{uid}.studioHours` (timezone, 7-day schedule with `open` / `close` / closed-toggle, holiday dates, vacation start/end, custom message). Pure `lib/studio-hours.ts > isStudioOpen` walks 14 days forward via `Intl.DateTimeFormat.formatToParts` to find `nextOpenAt`. `submitBooking` sends a separate tracked off-hours follow-up after the existing responder when closed, tags the project `OFF_HOURS_INQUIRY`, never blocks on failure. `/admin/settings/studio-hours` form with live preview chip.
- [x] **Ad-spend / ROAS tracking** (Phase 13.18). `adSpendEntries/{id}` collection (`AdChannel`: GOOGLE_ADS / INSTAGRAM_ADS / META_ADS / PINTEREST_ADS / VENUE_PARTNERSHIP / OTHER). `lib/domain/roas.ts > computeRoasSnapshot` joins spend × campaigns × clients × projects with `channelToMedium` heuristic mapping to `firstTouchMedium`. `/admin/reports/ad-spend` (date-range picker, 4 KPI tiles, per-campaign + per-channel tables with ROAS color tints, entry CRUD). Finance dashboard gains a "View ad-spend" link; campaigns list gains a lifetime ROAS chip per row (defensive dynamic import).

### Growth surfaces (Phase 4.1, 4.5, 4.7, 4.8, 4.9)
- [x] **Lead magnets** (Phase 4.1). `leadMagnets/{id}` + `leadMagnetDownloads/{id}`. Public `/magnet/[slug]` gate captures email + firstName + `__origin` first-touch attribution, upserts the client (creates if new), records a download row, increments `downloadCount`, optionally enrolls the client into a follow-up sequence (`enrollInSequence` already accepted nullable `projectId`), and returns an 8h presigned R2 GET URL the form triggers via hidden anchor. `/admin/lead-magnets` CRUD; create modal issues a presigned R2 PUT URL so the file uploads directly from the browser. 4-magnet idempotent seed script in DRAFT.
- [x] **Referral chain visualization** (Phase 4.5). `/admin/reports/referrals` reads every client + every project (`LOST` and `ARCHIVED` excluded from revenue), builds the graph in `lib/domain/referral-graph.ts > buildReferralGraph`, computes `directReferralCount` + `transitiveReferralCount` + `transitiveRevenueCents` via DFS with cycle guards. Hand-rolled SVG radial layout (no external graph deps) with hover-tooltip + click-to-isolate-subtree. Two leaderboards (top 25 by transitive referrals / by transitive revenue). AdminSidebar entry under **Reports**.
- [x] **Press submission tracker + backlink monitor** (Phase 4.7). `projects/{id}/pressSubmissions` subcollection (`SUBMITTED | ACKNOWLEDGED | PUBLISHED | REJECTED | WITHDRAWN`). Project workspace Press tab (between Gear and Notes). `lib/domain/press-backlinks.ts > checkPressBacklinks` runs each cron tick (HEAD-first with GET fallback on 405/501, 10s `AbortSignal.timeout`, default 30-day cadence per row). On the **transition** into `consecutiveLinkFailures >= 3`, queues a `PRESS_LINK_DOWN` `inboxItems` row (added that value to `InboxItemType` + inbox renderer); never duplicates on subsequent sweeps until the row recovers. Composite-index avoided: `collectionGroup("pressSubmissions") where status == "PUBLISHED"` + in-memory `publishedUrl != null` filter.
- [x] **Journal post auto-drafter** (Phase 4.8). `journalPosts/{id}` collection with unique slug (collision suffixes `-2`, `-3`, …, `Date.now()` fallback at 999). `lib/domain/journal-drafter.ts > draftJournalPostForProject` is wired into `onGalleryDelivered` (try/catch, idempotent per `projectId`); composes title `{firstNames} | {venue} | {city}`, kebab-slug, up to 30 `galleryReady` photos ordered by `uploadedAt asc`, linked vendors via `vendors.linkedProjectIds`, SEO meta, body `""` for Korrin. Public `/journal` index + `/journal/[slug]` with `BlogPosting` + `BreadcrumbList` JSON-LD. `/admin/journal` editor; `redraftJournalPostFromProjectAction` only touches auto-fields (photos / vendors / hero / location / city / SEO), never `bodyHtml` / `title` / `subtitle` / `slug` / `status`. Public Navbar gains a "Journal" link.
- [x] **Campaign / venue landing pages** (Phase 4.9). `campaigns/{id}` collection (`DRAFT | ACTIVE | ARCHIVED`). Public `/c/[slug]` renders hero + body HTML + CTA + optional 6-photo gallery strip when a category is set; injects `Service` JSON-LD. On render, sets a 30-day JS-readable `__campaign` cookie (`{slug, ts}`) and atomically bumps `visitCount`. Booking inquiry reads both `__origin` and `__campaign`; when `__campaign` resolves to an `ACTIVE` campaign, its `defaultUtm.{source,medium,campaign}` **overrides** `firstTouch{Source,Medium,Campaign}` on the new `clients` doc (rationale: campaigns are explicit higher-intent touchpoints). `firstTouchLandingUrl` + `firstTouchAt` stay from `__origin`. `incrementCampaignInquiry` runs fire-and-forget. `/admin/campaigns` CMS (slug locked post-create; status toggle; visit/inquiry/conversion counters per row).

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

### Phase 1 leftovers (external API blocked)
- [ ] **Phase 1.5 — Two-way Gmail sync.** OAuth + Pub/Sub watch → inbound mail matched to clients via `From` header. External Google Cloud project required.
- [ ] **Phase 1.8 — Public scheduler `/book/[packageSlug]`.** Calendar UI + Stripe Checkout deposit-on-book. Depends on Phase 3.3 Google Calendar sync.

### Phase 3 — Business Operations (external API blocked)
- [ ] **Phase 3.3 — Google Calendar two-way sync.** (external Google Cloud project required)

### Phase 4 — Growth Engine (external API blocked)
- [ ] **Phase 4.10 — Pinterest auto-pin** (external API).
- [ ] **Phase 4.11 — UGC monitor** (Instagram Graph API).

### Phase 5 — AI Assist Layer (needs `ANTHROPIC_API_KEY`)
- [x] **Phase 5.1 + 5.2 — AI Draft Reply + Thread Summary** (shipped earlier).
- [ ] **Phase 5.3 — Sentiment scoring on inbound.**
- [ ] **Phase 5.4 — Next-best-action chip scoring.**
- [ ] **Phase 5.5 — AI parallel lead score.**
- [ ] **Phase 5.6 — AI booking-form interpreter.**
- [ ] **Phase 5.7 — Journal post first draft.**
- [ ] **Phase 5.8 — AI mood-board generator** (Wave-9 stubbed the data side via `styleProfiles`).
- [ ] **Phase 5.9 — Cohort story generator.**
- [ ] **Phase 5.10 — AI tax suggestion engine.**

### Original ideas (Phase 13) — remaining
- [ ] **13.4 — Booking-form post-submit calendar embed.** Optional; pairs with 1.8 / 3.3.
- [ ] **13.11 — Cross-vendor wedding-day room.** Multi-vendor read-only timeline; pairs with 2.8 + 3.8.

### Other (low priority)
- [ ] **Custom Firebase Auth email templates.** Magic link emails use the Firebase default. Brand in the Firebase Console.
- [ ] **Pagination on `/admin/projects` + `/admin/events`** — `/admin/users` paginated in Wave 10; the other two still single-page.
- [ ] **Real PNG icons** for PWA manifest (currently favicon placeholder for 192 + 512).
- [ ] **Follow-up date editor UI** on the project workspace (field exists on `ProjectDoc`, no editor).
- [ ] **Manual multi-channel comms entry** on the project workspace (channel selection for PHONE / IN_PERSON / SMS — currently can be captured in NotesTab).

---

## Bugs

_None open._

(Bugs 1-6 from the previous cycle were resolved in the Wave 1–3 commits: GalleryViewer double-columns, `r2Key` persistence, `galleryReady` filter, activity feed timestamp fallback, lead-scoring typing. Wave 10 resolved the upload-confirm public-URL bug by switching `app/api/upload/confirm/route.ts` to a 60s presigned GET URL.)

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
| Firestore indexes | As needed | `scheduledTasks(type, projectId, recipeKey, status)` for idempotent AUTO_FOLLOW_UP guard. `scheduledTasks(type, projectId, status)` for SHOOT_BRIEF idempotent enqueue. Follow Firestore error links in logs. |
| `REVIEW_LINK_GOOGLE` / `KNOT` / `FACEBOOK` | Required for review request | Cron falls back to platform home pages if missing. |
| `TOMORROW_IO_API_KEY` | Optional (Phase 3.6) | `lib/weather.ts` returns null without it. |
| Custom domain + HTTPS | Configure | Vercel custom domain, Firebase Auth authorized domains. |

---

## Recently Resolved

### May 2026 — Waves 9 + 10 + 11 (commit `5dd26a3`)

Fourteen parallel agents in a single integration pass — eight differentiation-polish tasks (Wave 9) plus six gap-fillers (Wave 10) plus four operational expansions (Wave 11).

**Wave 9 — differentiation polish**
- **Phase 2.1 multi-step booking wizard** — `app/booking/BookingFormSteps.tsx` rewritten as a 4-step wizard with progress bar, per-step validation hints, soft-commitment checkbox, and a final review step that exposes per-section "Edit" jumps preserving every other answer. `submitBooking` FormData contract preserved verbatim; localStorage draft + `?package=` / `?sessionType=` / `?campaign=` flow through unchanged.
- **Phase 2.2 style quiz + mood-board stub** — public `/style` with 8 visual A/B questions (light↔moody, candid↔posed, indoor↔outdoor, documentary↔editorial, warm↔cool, vibrant↔muted, tight↔wide, film grain↔crisp). `lib/db/style-profiles.ts` keyed by lowercased email; `app/admin/projects/[id]/page.tsx` gains a server-rendered `StyleProfileCard` above the workspace client. AI mood-board half explicitly stubbed for Phase 5.8.
- **Phase 13.10 client-gallery analytics** — `viewCount` / `downloadCount` / `lastViewedAt` on `PhotoDoc`. Bot-guarded `/api/track/photo-view` (50-id batch) + `/api/track/photo-download` reject when missing UA, missing Referer, or matching `bot|crawler|spider|preview|headless|wget|curl`. `GalleryViewer` uses `IntersectionObserver` with 2s/10-id debounce + `keepalive: true`. `/admin/events/[id]/analytics` renders Pareto + top-favorites + top-views + download-conversion sections.
- **Phase 13.12 off-the-record notes** — `offTheRecordNotes?: string` on `ProjectDoc` with explicit "NEVER export" comment. `NotesTab` redesigned with a 2-segment pill toggle; off-the-record panel uses red `#8B2E2E` left border + lock glyph + tinted `#FAF6F3` background. Export-redaction audit confirmed no consumer (welcome-packet, shoot-brief, journal-drafter, contract-renderer, portal, AI claude) touches the new field.
- **Phase 13.13 brand voice calibration** — `BrandVoiceSample[]` on `users/{uid}` with 50–1000 char body cap @ 10 samples max. `/admin/settings/brand-voice` CRUD form. Inbox `DetailPane` gains a `VoiceAnchorsCard` above the reply textarea with chip → expand → copy interactions (no AI integration yet).
- **Phase 13.15 First 100 Clients dashboard** — `/admin/reports/first-100` cohort table (oldest 100 clients, capped) with BOOKED/SHOT/DELIVERED/REVIEWED pipeline pills (filled olive when achieved across any of their projects), within-cohort referral lineage, hand-rolled SVG LTV histogram (10 buckets from $0–500 → $25k+), sort by Client # / Cohort date / LTV.
- **Phase 13.17 Commercial Brand Brief** — 15-question `questionnaireTemplate` seeded ("brand_name", "deliverables_wanted", "usage_window", "exclusivity", "budget_range", etc). `lib/project-transitions.ts > onProposalSent` auto-attaches when `sessionType === "Commercial"`, idempotent against existing project questionnaires (mirrors `sendQuestionnaireForProjectAction`'s existence check). No-op for non-Commercial; logs warning if template missing. **After deploy: run `npx tsx scripts/seed-questionnaires.ts` to seed.**
- **Phase 13.19 vendor reciprocity tracking** — `lastReciprocatedAt` on `VendorDoc`; `logVendorReferralSent` / `logVendorReferralReceived` helpers. Vendors list gains a "Reciprocity" column ("12 sent / 4 received") with red-on-blush "Imbalanced" pill when `sent - received >= 5`. Detail page gains a `ReciprocityCard` with two big counters + log buttons + last-activity line.

**Wave 10 — gap-fillers**
- **Phase 13.7 local SEO autopilot** — `lib/seo/cities.ts` seeds 7 cities (Cary, Raleigh, Durham, Chapel Hill, Asheville, Wilmington, Charlotte) with hand-written editorial copy (real landmarks, 5 venues, best seasons, 4 golden-hour spots, 5 FAQs each). `/locations` index + `/locations/[citySlug]` SSG pages with `LocalBusiness` + `BreadcrumbList` JSON-LD. `app/sitemap.ts` includes all city URLs. Navbar gains "Locations".
- **Phase 13.9 Quiet Season planner** — pure `lib/domain/quiet-season.ts > buildQuietSeasonAnalysis` (testable, empty-input safe). `/admin/reports/quiet-season` renders SVG month heatmap + 6-month forward forecast + re-engagement candidates table (clients delivered 9–24 months ago with no open project, sorted by LTV) + suggested campaigns.
- **Image category + label edit** — extracted `app/portfolio/categories.ts` shared module. `UploadZone` gets batch category dropdown + label override input above the drop zone (threaded through both single-PUT and multipart pipelines). `PhotoGrid` gets a pencil-edit popover for label + category. New `lib/db/photos.ts > updatePhoto` helper + `updatePhotoMetadata` server action.
- **`/admin/users` pagination** — `listUsersPaginated` with base64 cursor (`createdAt desc + __name__` stable order). In-memory substring search after pageSize×3 over-fetch. Forward-only Next + Back-to-start UI. `SearchBar.tsx` client form posts to `/admin/users?q=`.
- **Admin global search** — extracted `lib/admin/search.ts` pure helper `searchAdminAll(q)` returning `{clients, projects, events, vendors, journal}` (cap 10 each, 50-newest scan + in-memory contains, 5 collections in parallel, `MIN_QUERY_LENGTH = 2`). `/admin/search` page + `/api/admin/search` route + `CommandPalette` rewired with `vendor` + `journal` kinds. Deleted dead `lib/search.ts` + `/api/search/route.ts`.
- **Bug #1 — R2 public-URL bug** — `/api/upload/confirm/route.ts` switched from constructed `https://${BUCKET}.${ACCOUNT_ID}.r2.cloudflarestorage.com/${key}` to `generatePresignedGetUrl(key, 60)`. Works on both public and private buckets, no env coupling. Removed from PROGRESS.md Bugs table.

**Wave 11 — operational expansions**
- **Phase 4.13 digital products store** — `products` + `productPurchases` collections. Public `/shop` (SSG) + `/shop/[slug]` (SSG with `generateStaticParams`, `Product` + `BreadcrumbList` JSON-LD) + `/shop/thank-you`. `/admin/shop` CRUD with publish-time Stripe Payment Link auto-creation (`createProductPaymentLink` in `lib/stripe.ts`). Webhook routes `checkout.session.completed` by `metadata.productId` to `processProductPurchase` — idempotent on session id, generates 7-day presigned R2 GET URL, emails buyer via `enqueueTrackedMail`, marks delivered, increments `purchaseCount`.
- **`/admin/clients` dedicated list** — `lib/db/clients.ts` extended with `notes` field, `ClientSort`, `listClientsPaginated` (cursor for `recent` sort, full slice for `ltv` / `sessions` to support in-memory aggregation), `searchClients`, `updateClientDetails`. `/admin/clients` table with sortable columns + cursor pagination + search; `/admin/clients/[id]` detail with header / stats / project history / invoice ledger / communications summary / inline edit form. LTV math sums only `status === "PAID"` invoices.
- **`/admin/health` system status** — single-pane operational dashboard with 7 cards: cron worker GREEN/YELLOW/RED + queue depths, Stripe webhook 7-day breakdown, mail queue, env-var presence (NEVER values), inbox triage backlog by type, R2 config + collectionGroup photos count, Next/Node/git-SHA system version. Every card try/catch wrapped.
- **`/admin/exports` CSV center** — `lib/csv.ts` RFC 4180 escape helper. `/api/exports/{clients,projects,invoices,photos-summary,sales-tax-filings}` routes. `/admin/exports` landing page with download links + year-picker for existing `/api/expenses/export`.

**Cross-agent integration**
- `components/admin/AdminSidebar.tsx` merged six new entries (Clients, Shop, First 100, Quiet Season, Health, Exports, Brand voice) without conflict; restored the "Tax" Settings entry that was lost in the brand-voice agent's overwrite.
- `lib/db/photos.ts` merged additive: `updatePhoto` helper coexists with `incrementPhotoView` / `incrementPhotoDownload` + `viewCount` / `downloadCount` / `lastViewedAt`.
- `lib/db/clients.ts` gained `notes` + paginated helpers without colliding with style-profile or first-100 agents.
- `lib/db/projects.ts` gained `offTheRecordNotes` cleanly.
- `lib/project-transitions.ts > onProposalSent` gained `maybeAttachCommercialBrief` after the existing follow-up logic.
- `app/admin/projects/[id]/page.tsx` gained both `StyleProfileCard` (2.2) and `offTheRecordNotes` serialization (13.12) cleanly.
- Final: `npm run build` exit 0; `npm run lint` 0 errors / 21 pre-existing warnings.

### May 2026 — Wave 8 (commit `9196160`)

Ten parallel agents — five client-experience surfaces + five compliance/ops surfaces — in a single integration pass.

**Bundle A — client experience**
- **Phase 2.4 portal redesign** — `/portal/[projectId]` with 7 tabs (Overview / Documents / Invoices / Timeline / Gallery / Inspiration / Contact), `/portal/router` redirect, "My Portal" link in public Navbar, `CLIENT_MESSAGE` inbox surfacing for client → admin messages.
- **Phase 2.6 gallery polish** — full-screen slideshow with keyboard + autoplay + music slot, touch-swipe gestures, per-event constant-time `downloadPin` gate, web/print/original resolution tiers with R2 presigned fallback.
- **Phase 2.8 day-of timeline** — `projects/{id}/dayOfTimeline` subcollection, HTML5 drag-reorder with transactional reorder action, "Day-of" workspace tab, shoot-brief integration.
- **Phase 13.6 recurring revenue** — `ClientDoc.recurringCadence`, auto-seed on `GALLERY_DELIVERED` for repeat-customer session types, cron sweep + idempotent `RE_ENGAGEMENT_DUE` inbox emit, inline send/snooze panel.
- **Phase 13.16 far-future-date risk** — pure isomorphic risk-tier assessor (NONE/WATCH/FLAG/STALE), risk dot on pipeline + capacity heatmap, cron-driven `FAR_FUTURE_RISK` inbox emit.

**Bundle B — compliance + ops**
- **Phase 3.9 COI workflow** — 9 COI fields on `ProjectDoc`, `users/{uid}.insurerContact` setting, Contract-tab `CoiBlock` with templated request email + drag-drop PDF upload via presigned R2 PUT, overdue COI chip on pipeline.
- **Phase 3.10 compliance dashboard** — `/admin/reports/compliance` with contracts / COI / data-requests / sales-tax cards; new `dataRequests` collection with 30-day GDPR/CCPA dueBy clock; defensive imports of B1 + B3 modules.
- **Phase 3.11 sales tax engine** — pure 12-state rules table, `subtotalCents`+`taxCents` on `InvoiceDoc` (with back-compat normalizer), idempotent `salesTaxFilings` cron with DUE_SOON → OVERDUE auto-flip, `/admin/reports/sales-tax` + `/admin/settings/tax`, CSV export at `/api/sales-tax/export`.
- **Phase 13.2 Studio Hours** — `users/{uid}.studioHours` (timezone + 7-day schedule + holidays + vacation), pure `isStudioOpen` walking 14 days forward via `Intl.DateTimeFormat`, separate off-hours follow-up after the existing booking responder, `OFF_HOURS_INQUIRY` tag.
- **Phase 13.18 ad-spend / ROAS** — `adSpendEntries` collection, per-campaign and per-channel ROAS computation joining spend × campaigns × clients × projects, `/admin/reports/ad-spend` dashboard with color-tinted ROAS columns, finance dashboard link, lifetime ROAS chip on campaigns list.

Cross-agent: `InboxItemType` extended with `CLIENT_MESSAGE`, `RE_ENGAGEMENT_DUE`, `FAR_FUTURE_RISK`, `COI_REQUESTED`, `COI_RECEIVED`, `SALES_TAX_OVERDUE` (inbox view union + label map kept in sync). AdminSidebar gains Compliance / Sales Tax / Ad Spend under **Reports** plus Insurer / Studio Hours / Tax under **Settings**. `lib/db/admin-settings.ts` now hosts `taxConfig`, `studioHours`, and `insurerContact` on `users/{uid}`.

### May 2026 — Wave 7 (commit `e9a7dfc`)

Phase 4 growth surfaces shipped by five parallel agents.

- **Phase 4.1 lead magnets** — `leadMagnets` + `leadMagnetDownloads` collections, public `/magnet/[slug]` gate, `/admin/lead-magnets` CRUD with direct-to-R2 browser PUT, idempotent 4-magnet seed (Pricing Guide, Wedding Prep, Engagement What-to-Wear, Cary/RDU Venue Guide).
- **Phase 4.5 referral chain visualization** — `/admin/reports/referrals` with DFS-built graph (cycle-safe), hand-rolled SVG radial layout, transitive-revenue computation excluding `LOST` + `ARCHIVED` projects.
- **Phase 4.7 press submission tracker** — `projects/{id}/pressSubmissions` subcollection, workspace Press tab, monthly cron-driven backlink monitor (HEAD-first, in-memory filter to avoid composite index), idempotent `PRESS_LINK_DOWN` inbox item on transition into `>=3` consecutive failures.
- **Phase 4.8 journal auto-drafter** — `journalPosts` collection, `draftJournalPostForProject` wired into `onGalleryDelivered` (idempotent per `projectId`), public `/journal` index + `/journal/[slug]` with `BlogPosting` + `BreadcrumbList` JSON-LD. Redraft action protects Korrin-owned fields.
- **Phase 4.9 campaign landing pages** — `campaigns` collection, public `/c/[slug]` writes `__campaign` cookie which **overrides** `firstTouch{Source,Medium,Campaign}` at booking time (campaign attribution beats generic UTM cookie). `/admin/campaigns` CMS with per-row conversion counters.

Cross-agent: `PRESS_LINK_DOWN` added to `InboxItemType` and the inbox renderer; public Navbar gains a "Journal" link; AdminSidebar gains Lead Magnets, Journal, Campaigns under **Content** and Referrals under **Reports**.

### May 2026 — Wave 6 (commit `52cbd35`)

Phase 3 ops loop tightened by four parallel agents.

- **Phase 3.4 shoot brief auto-generator** — editorial HTML packet to R2, tracked email to Korrin, `SHOOT_BRIEF` scheduled-task type, daily T-24h sweep with idempotent `(type, projectId)` insert. OverviewTab block. Composes client / project / location / weather / golden+blue hour / questionnaire / vendors / gear with per-section graceful degradation.
- **Phase 3.6 weather + golden-hour persistence** — widened `WeatherSnapshot` with full Tomorrow.io payload + 9-field `SunTimesSnapshot`. `refreshWeatherSnapshotsDue` cron sweep writes at T-72h and T-24h horizons (skips silently on missing lat/lng or API key). `weatherSnapshotIndoor` admin override + `WeatherCard` + `IndoorToggle` in OverviewTab.
- **Phase 3.7 gear checklist** — `gearTemplates` collection + `projects/{id}/gearLog` subcollection. `/admin/settings/gear-templates` CRUD; project workspace GearTab. 5-template seed script (Wedding / Portrait / Family / Editorial / Engagement), idempotent on default-per-sessionType.
- **Phase 3.13 editing-workflow tracker** — `EditingSubStage` union + per-sessionType SLA + pure `computeEditingStatus` helper. Pipeline table pill, OverviewTab 5-step stepper. Flipping to DELIVERED routes back through `updateProjectStatus("GALLERY_DELIVERED")` so transition hooks fire once.
- **Phase 3.14 capacity heatmap** — `/admin/calendar` 13-column 64-week grid with per-cell colour scale (against `WEEKLY_CAP = 3`) and click-to-expand side panel.

Cross-agent cleanup: extracted SLA + `EditingSubStage` constants to isomorphic `lib/editing-sla.ts` so client components stay free of `firebase-admin`. Cron route response now reports `weatherSnapshotsRefreshed` and `shootBriefsScheduled` counts. Composite index required: `scheduledTasks(type, projectId, status)`.

### May 2026 — Wave 5 (commit `3b6010c`)

Financial dashboard (`/admin/reports/finance`) — 6 KPIs + 4 Recharts + Stripe payout schedule + daily `analyticsCache` snapshot via cron. Tax / expenses dashboard (`/admin/reports/tax`) — MACRS depreciation, $0.70/mi mileage, Schedule C donut, **tax-saving calendar** (Phase 13.8), QBSE CSV export. Gallery favorites + **Korrin's-picks** overlay (Phase 2.5 + 13.5) — `FavoritesModal` on `/gallery/[id]` + `/api/download/[eventId]/favorites` zip. `/admin/broadcasts` block-based composer (Phase 4.3) — segment-targeted, scheduled-send drain via cron. New collections: `expenses`, `assets`, `broadcasts`, `analyticsCache`. New libs: `lib/db/{expenses,assets,broadcasts,analytics-cache}.ts`, `lib/domain/analytics.ts`, `lib/segments/resolver.ts`, `lib/broadcasts/sender.ts`.

Follow-up commit `da936c6`: deleted `lib/booking-kanban.ts` entirely (`CommunicationChannel` moved to `lib/db/projects.ts`).

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
