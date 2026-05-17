# Korrin's Photos — Complete Business Dashboard Roadmap

> Status: Living document, last updated 2026-05-13.
> Owner: Korrin (product) + the Claude Code workspace (engineering).
> This is the canonical plan for evolving Korrin's Photos from "feature-complete prototype" into a category-leading business operating system for a single-photographer studio.
>
> It is informed by:
> - A repo audit and bug-fix pass (5 internal agents, May 2026).
> - Market research across 10 photography platforms (Pixieset, ShootProof, Pic-Time, HoneyBook, Dubsado, 17hats, Iris Works, Studio Ninja, Táve/VSCO Workspace, Sprout Studio).
> - Client-experience trend research (booking flows, gallery expectations, mobile + accessibility, AI features) drawing on 2025-2026 sources.
> - Operations research covering accounting, scheduling, marketing, vendors, compliance, retention.
> - CRM pattern research (Pipedrive, HubSpot, Attio, Linear, Folk, Front, Missive, Cal.com).
> - Financial + analytics research (Stripe, ChartMogul, Mercury, QuickBooks SE) with photographer benchmarks.
> - Marketing automation research (Flodesk, Klaviyo, ActiveCampaign, Customer.io, Junebug).
>
> The plan is opinionated. It deliberately *omits* features that don't fit a solo operator (multi-tenant, white-label, agency mode, complex permission matrices).

---

## Table of Contents

1. [Where we are today](#1-where-we-are-today)
2. [Strategic vision](#2-strategic-vision)
3. [Schema evolution plan](#3-schema-evolution-plan)
4. [Cross-cutting building blocks](#4-cross-cutting-building-blocks)
5. [Phase 0 — Stabilization & cleanup](#phase-0--stabilization--cleanup)
6. [Phase 1 — CRM completeness](#phase-1--crm-completeness-4-6-weeks)
7. [Phase 2 — Client experience v2](#phase-2--client-experience-v2-4-6-weeks)
8. [Phase 3 — Business operations](#phase-3--business-operations-4-6-weeks)
9. [Phase 4 — Growth engine](#phase-4--growth-engine-4-6-weeks)
10. [Phase 5 — AI assist layer](#phase-5--ai-assist-layer-parallel-ongoing)
11. [Phase 6 — Future bets](#phase-6--future-bets-open-horizon)
12. [Original ideas (additions on top of research)](#13-original-ideas)
13. [Implementation rules of engagement](#14-implementation-rules)
14. [Appendix A — Full feature catalog](#appendix-a--full-feature-catalog)
15. [Appendix B — Risk register](#appendix-b--risk-register)
16. [Appendix C — Out of scope](#appendix-c--out-of-scope)
17. [Appendix D — References](#appendix-d--references)

---

## 1. Where we are today

### Architecture in one paragraph

Next.js 15/16 App Router on Vercel. Firebase Admin SDK + Firestore as the sole database, accessed exclusively through `lib/db/<collection>.ts` modules (ADR-013). Public marketing site, public booking form with first-touch UTM attribution, magic-link client portal, admin dashboard guarded by Firebase session cookie + admin claim. Photo storage via Cloudflare R2 + Cloudflare Images (single-PUT + multipart pipelines). Stripe payment links power deposit + balance invoicing; webhook advances `ProjectStatus` automatically. A Vercel Cron worker drains `scheduledTasks` daily (`SEND_REFERRAL` live, `AUTO_FOLLOW_UP` stubbed). The Client/Project unified model is the canonical state machine; the legacy `bookingInquiries` Kanban runs alongside via dual-write in `app/booking/actions.ts`.

### What's solid

- Session/auth: two-step admin login, requireAdmin/requireSession guards, magic-link client auth.
- Storage: both single-PUT and multipart upload pipelines work end-to-end. `r2Key` now persists so deletes can clean R2 (May 2026 fix).
- Project state machine + transitions: `handleProjectTransition` is a clean side-effect orchestrator that auto-creates events, grants access, queues referrals.
- Stripe integration: webhook signature verification, idempotent invoice marking, status auto-advance.
- Per-area CLAUDE.md files (May 2026) give an AI assistant enough local context to navigate any directory.

### What's fragile

| Issue | Where | Severity |
|---|---|---|
| `/admin/projects/[id]` page is a stub — header buttons unwired, tabs unrendered | `app/admin/projects/[id]/page.tsx` | Medium |
| Manual `linkEventToInquiry` and `updateBookingStatus(BOOKED)` event creation duplicate `onProjectBooked` logic; idempotent guards must hold during dual-write | `app/admin/bookings/inquiry-actions.ts`, `lib/project-transitions.ts` | Medium |
| `lib/project-transitions.ts > onProjectBooked` writes `eventAccess` using `clientId` as the user id, but `clientId` is a Firestore-generated doc id, not the Firebase Auth UID | `lib/project-transitions.ts:42-44` | High latent bug |
| `app/api/webhooks/stripe` accesses `project.id` on a `data()` result (always undefined); use `projectDoc.id` instead | `app/api/webhooks/stripe/route.ts:100,106` | Medium |
| Half-shipped routes: `/sign-contract/[id]`, `/booking/payment-success`, `/questionnaire/[id]` are linked from emails but the page files don't exist | various | Medium |
| `app/admin/bookings/LeadDetailDrawer.tsx:75` uses `{ current: false }` as a pseudo-ref; closure capture means notes/tag edits don't reliably refresh the parent list | drawer | Medium |
| ~10 `lib/db/*` files contain dead helpers (only types are imported); production code talks to `adminDb` directly. Either adopt the helpers or delete | see [Phase 0 dead-code list](#02-dead-code-pass) | Low |
| `EventDoc.status` union mismatch (`"ACTIVE"` vs `"UPCOMING"|"COMPLETED"`); two parallel date schemas (`shootDate` vs `startDate`) inside same collection | `lib/db/events.ts` | Medium |
| 6 React Hooks 7 `set-state-in-effect` warnings + 1 `Date.now()` in render — surfaced as warnings, not errors | various | Low |
| Lead scoring is typed against `BookingInquiryDoc` even though it's used against `ProjectDoc`; works only because field shapes overlap | `lib/lead-scoring.ts` | Low |

### What we don't have at all

Galleries with favorites/proofing. E-signature UI (renderer exists; no signing page). Print store / album builder / lab fulfillment. Public scheduler with Stripe deposit-on-book. Welcome packet system. Shoot-day timeline builder. Vendor/venue CRM. Questionnaire engine. SMS channel. Email open/click tracking. Two-way Gmail sync. Cmd+K palette. Saved views. Unified inbox. Reporting dashboards (financial, funnel, retention, forecast). Quarterly tax estimate. Expense tracking. Mileage tracker. Equipment depreciation. Sales tax. Refund/chargeback ledger. Email sequence engine. Segment builder. Broadcast composer. Lead magnets. Campaign/venue landing pages. SEO schema. UGC monitor. Press tracker. Digital products store. AI-drafted replies. Thread summary. Sentiment scoring. Mood-board / style quiz. Mobile admin app. PWA gallery install. Watermarking variant. Download PIN. Multi-resolution download tiers. Slideshow with music. Video delivery. Album proofing. The list is long because the gap between "working prototype" and "complete business dashboard" is large.

---

## 2. Strategic vision

### The three layers

```
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 3 — GROWTH ENGINE                       │
│   Marketing automation · Sequences · Segments · Campaigns        │
│   Referrals · Reviews · UGC · Press · Education products         │
└─────────────────────────────────────────────────────────────────┘
                                  ▲
                                  │
┌─────────────────────────────────────────────────────────────────┐
│                  LAYER 2 — BUSINESS OPERATIONS                   │
│   Financial dashboards · Tax · Expenses · Mileage · Depreciation │
│   Scheduling · Vendors · Compliance · Editing workflow           │
└─────────────────────────────────────────────────────────────────┘
                                  ▲
                                  │
┌─────────────────────────────────────────────────────────────────┐
│                  LAYER 1 — CLIENT/PROJECT CORE                   │
│   Pipeline · Contracts · Invoices · Gallery · Messages           │
│   Bookings · Auth · Storage · Transitions                        │
└─────────────────────────────────────────────────────────────────┘
```

Build bottom-up. Skipping Layer 1 to ship Layer 3 features (e.g. fancy newsletter without solid project records to segment by) is the single biggest failure mode for this kind of system.

### The competitive bar

| Capability | HoneyBook | Pic-Time | Dubsado | Korrin today | Korrin target |
|---|---|---|---|---|---|
| Public scheduler with deposit | ✅ | partial | ✅ | ❌ | ✅ Phase 1 |
| E-sign contracts (in-app) | ✅ | ❌ | ✅ | ❌ (renderer only) | ✅ Phase 1 |
| Status-triggered automations | ✅ | partial | ✅ (best) | partial | ✅ Phase 1 |
| Gallery favorites + proofing | partial | ✅ (best) | ❌ | ❌ | ✅ Phase 2 |
| Print/album store | ❌ | ✅ | ❌ | ❌ | ✅ Phase 4 |
| Email sequences + segments | partial | ❌ | ✅ | ❌ | ✅ Phase 4 |
| Two-way email sync | partial | ❌ | ❌ | ❌ | ✅ Phase 1 |
| Cmd+K palette / saved views | ❌ | ❌ | ❌ | ❌ | ✅ Phase 1 (differentiator) |
| AI drafted replies / summaries | ✅ (best) | ❌ | ❌ | ❌ | ✅ Phase 5 |
| Financial dashboard + tax | partial | ❌ | partial | ❌ | ✅ Phase 3 (differentiator) |
| Public investment/booking funnel | partial | ❌ | ✅ | partial | ✅ Phase 2 |
| Brand-owned, owns the data | ❌ | ❌ | ❌ | ✅ | ✅ (forever) |

### Korrin's differentiator

A SaaS-replacement that owns the data, ships the brand voice end-to-end (no "Powered by HoneyBook" footer, ever), and treats AI as a first-class drafting partner rather than a marketing checkbox. The plan below makes that real.

### Non-goals

- Multi-photographer studio support. Single-operator is a feature, not a limitation — it lets every UI assume "you" and removes 60% of HoneyBook's permission complexity.
- Reselling to other photographers. This is Korrin's business OS. If components want a future life as open-source / SaaS, that is a separate decision, downstream of usefulness here.
- Real-time collaborative editing. `router.refresh()` is sufficient for one operator (ADR-007 remains).

---

## 3. Schema evolution plan

The current Firestore schema covers ~60% of the target system. The plan below adds ~14 new collections + extends ~6 existing ones. Numbers in parentheses are Firestore-impact estimates assuming 200 projects/year steady-state and 5-year retention.

### New collections

| Collection | Purpose | Drives features |
|---|---|---|
| `expenses/{id}` | Per-expense rows with Schedule C line, vendor, receipt, mileage flag, optional `projectId` | Tax dashboard, P&L, margin reports |
| `assets/{id}` | Equipment inventory + depreciation schedule | Form 4562, insurance schedule |
| `vendors/{id}` | Venues, planners, MUAs, florists, videographers, officiants — with category, location, rating, notes, sample photos | Vendor CRM, welcome packet auto-pick, cross-referral tracking |
| `sequences/{id}` | Reusable email/SMS drip definitions (ordered steps with delays + conditions) | Cold-lead nurture, shoot-day countdown, review request flow |
| `sequenceEnrollments/{id}` | Per-client active sequence state | Sequence engine runtime |
| `segments/{id}` | Saved predicate JSON for dynamic lists | Broadcast targeting, smart views |
| `broadcasts/{id}` | One-shot newsletter sends with stats | Newsletter, holiday campaigns |
| `emailEvents/{id}` | Sent / delivered / opened / clicked / bounced / unsub events | Engagement signals, lead-score decay |
| `templates/{id}` | Versioned text/HTML templates for contracts, emails, questionnaires | Template library, sequence steps |
| `questionnaires/{id}` (project subcoll already in schema diagram — promote to top-level keyed by `projectId`) | Pre-shoot, post-delivery surveys | Shoot brief, NPS, retention insights |
| `tasks/{id}` | Self-assigned to-dos with snooze + due date | Linear-style task list, day-of-shoot checklist |
| `inboxItems/{id}` | Unified feed of new inquiries, payments, signings, mentions | `/admin/inbox` triage surface |
| `reviews/{id}` | Captured testimonials + platform-of-record + status (requested → submitted → published) | Review request flow, schema markup, social proof |
| `pressSubmissions/{id}` | Submission log per publication + backlink monitor | Press tracker, SEO link health |
| `journalPosts/{slug}` | Blog/journal posts (status, projectId, body, photoIds, SEO meta) | Per-shoot recap, per-venue articles |
| `campaigns/{slug}` | Venue / campaign landing-page configs | UTM-tracked landing pages |
| `leadMagnets/{slug}` | Gated downloadable resources (PDF, video) | Lead-capture surface |
| `partialInquiries/{id}` | Abandoned-form recovery records | Email recovery sequence |
| `ugcMentions/{id}` | IG/TikTok mentions matched to clients | UGC review wall + social proof |
| `referrals/{id}` (already designed in lifecycle doc — implement) | Referrer → referee → project → credit | Tiered referral engine, chain visualization |
| `analyticsCache/{periodKey}` | Pre-aggregated nightly snapshots | Fast reporting at the admin home page |

### Field additions to existing collections

| Doc | New field(s) | Why |
|---|---|---|
| `ProjectDoc` | `statusHistory: [{status, at, byUid?}]` | Funnel "avg days at stage"; transition audit |
| `ProjectDoc` | `lostReason?: 'BUDGET'\|'GHOSTED'\|'DATE_UNAVAILABLE'\|'LOST_TO_COMPETITOR'\|'OTHER'` | Drop-off attribution chart |
| `ProjectDoc` | `engagementScore`, `lastEngagementAt` | Lead-score decay + Hot Today ribbon |
| `ProjectDoc` | `clientNps?: 1\|2\|3\|4\|5`, `clientNpsAt?` | Delivery feedback, gate review request |
| `ProjectDoc` | `weatherSnapshot?: { temp, conditions, fetchedAt }` | Pre-shoot brief |
| `ProjectDoc` | `shootBriefR2Key?: string` | Generated PDF location |
| `ProjectDoc` | `instagramHandle?: string` (on client) | UGC match |
| `ClientDoc` | `referralCount`, `referralTier`, `referralRewardsLog[]` | Tiered referral engine |
| `ClientDoc` | `smsConsent`, `phone` (already exists) | SMS channel |
| `ClientDoc` | `lifecycleStage: 'INQUIRED' \| 'BOOKED' \| 'DELIVERED' \| 'REPEAT' \| 'CHURNED'` (derivable; cached) | Segment performance |
| `ClientDoc` | `lifeEventTags: string[]` (`engaged`, `expecting`, `newborn`, ...) | Life-event triggers |
| `InvoiceDoc` | `salesTaxCents`, `salesTaxRate`, `salesTaxJurisdiction` | Sales tax compliance |
| `InvoiceDoc` | `disputeStatus?`, `refundCents?`, `refundReason?` | Chargeback ledger |
| `PhotoDoc` | `favoritedBy: string[]` (clientIds), `tags: string[]` (already exists, add reserved `sneakPeek`, `download`, `featured`) | Proofing, sneak-peek auto-drop |
| `EventDoc` | Reconcile the `"ACTIVE"|"UPCOMING"|"COMPLETED"|"DELIVERED"|"ARCHIVED"` union; pick one set and migrate writers | Status drift fix |
| `EventDoc` | `coverPhotoId?` (delete the unused `coverPhotoUrl`) | Gallery card hero |
| `users` | `gmailRefreshToken?`, `gmailWatchExpiration?` | Two-way email sync |
| `users` | `googleCalendarId?` | Calendar sync |
| `users` | `twilioSubaccountSid?`, `twilioPhone?` | SMS channel |
| `users` | `stripeAccountStatus`, `stripeFeeMtd` | Financial dashboard |

### Migration strategy

Three options per change: (1) write-on-touch (lazy backfill as records are updated), (2) one-shot script (`scripts/migrate-*.ts`), (3) Firestore Trigger (Cloud Function). For pure additive fields, prefer (1). For status reconciliation (EventDoc), prefer (2) with a dry-run flag. For Firebase Auth UID ↔ `clientId` reconciliation (the latent `eventAccess` bug), a (2) one-shot is required.

---

## 4. Cross-cutting building blocks

These five primitives unlock many features. Build them first inside each phase that needs them; don't try to design them all upfront.

### 4.1 Sequence engine

A reusable executor for ordered, delayed, conditional messaging. Used by: cold-lead nurture, shoot-day countdown, review requests, anniversary touches, win-back, contract reminders.

```
sequences/{id}: { name, steps: [{ delay, channel, templateId, conditionPredicate? }] }
sequenceEnrollments/{id}: { clientId, projectId?, sequenceId, currentStep, nextRunAt, status }
```

`/api/cron/run-tasks` (already exists) picks up enrollments where `nextRunAt <= now`, evaluates the condition, dispatches via the existing `mail/` queue (and a new `sms/` queue for SMS), advances `currentStep` + `nextRunAt`.

### 4.2 Segments engine

Saved predicates resolved live against Firestore at broadcast or query time.

```
segments/{id}: {
  name,
  predicate: { status?, tagsInclude?, tagsExclude?, leadScoreMin?, lastDeliveredBefore?, ... },
  lastResolvedCount, lastResolvedAt
}
```

Resolution is a typed query builder that maps predicate fields → Firestore `where` clauses, with a fallback in-memory filter for things Firestore can't index (regex match on notes, etc.). Predicate JSON is the persistence; the UI is a builder that compiles to / parses from it.

### 4.3 Email tracking layer

Wrap outbound links with `/r/[token]` redirects; embed a 1×1 pixel at `/o/[token]`. Persist to `emailEvents/{id}`.

```
emailEvents/{id}: { sendId, recipientClientId, type: 'sent'|'opened'|'clicked'|'bounced'|'unsub', url?, userAgent?, at }
```

Aggregations: per-project (engagement spike → Hot Today), per-broadcast (open/click rates), per-client (engagement score input).

### 4.4 Inbox aggregator

A normalized `inboxItems/{id}` feed populated by Firestore triggers / route handlers / cron, with `type`, `projectId?`, `clientId?`, `title`, `body`, `snoozedUntil?`, `read`. Surfaced at `/admin/inbox` with keyboard triage and snooze.

### 4.5 Analytics cache

Nightly cron pre-aggregates the heavy queries (funnel, cohorts, revenue-by-source, deposit liability) into `analyticsCache/{periodKey}` so `/admin` loads in <300ms regardless of project count.

```
analyticsCache/{periodKey}: { computedAt, revenue: {mtd, ytd, last30}, funnel: {...}, cohorts: {...}, sources: {...} }
```

Live values (Stripe balance, today's bookings) fetch on each request and merge.

---

## Phase 0 — Stabilization & cleanup

> Timeframe: 1–2 weeks total. Roughly half is already complete as of 2026-05-13.

### 0.1 Bug fixes (delivered May 2026)

- [x] `eventAccess` doc ID drift (`${userId}_${eventId}` per ADR-009) — `lib/db/event-access.ts`.
- [x] `galleryReady` filter applied on client gallery — `app/gallery/[id]/page.tsx`.
- [x] `GalleryViewer` double-columns CSS removed.
- [x] `AdminSidebar` Pipeline link added.
- [x] `/admin/projects/[id]/page.tsx` async params (Next.js 15+ compliance).
- [x] `EventDoc` type drift (projectId/clientId/shootDate/shootEndDate optional fields + widened `status` union).
- [x] `activityLogs` → `activityFeed` collection naming normalized; webhook uses `logActivity()` helper.
- [x] `r2Key` persisted on photo doc; `PhotoDoc` interface updated.

### 0.2 Bug fixes (still to do)

- [ ] `lib/project-transitions.ts:42-44` — `onProjectBooked` writes `eventAccess` using `clientId` as the user id. Refactor to resolve the actual Firebase Auth UID (create-or-fetch via `adminAuth.getUserByEmail(client.email)`), grant access keyed by that UID. **High-severity latent bug** — clients booked through the unified pipeline can't see their gallery after logging in.
- [ ] `app/api/webhooks/stripe/route.ts:100,106` — `project.id` is `undefined` (doc data doesn't include the id). Use `projectDoc.id` or `invoice.projectId`. Currently a silent NaN that breaks status auto-advance attribution.
- [ ] `app/admin/bookings/LeadDetailDrawer.tsx:75` — `{ current: false }` pseudo-ref. Replace with `useRef(false)`.
- [ ] Half-shipped routes: implement OR remove the email links to `/sign-contract/[id]`, `/booking/payment-success`, `/questionnaire/[id]`. Recommendation: stub each as a real page that explains "this feature is coming soon" rather than 404, then build the real pages in Phase 1.
- [ ] Multipart pipeline stores R2 key as `storageKey`, but `lib/domain/events.ts` cleanup loops only read `r2Key`. Either rename or have the cleanup read both.
- [ ] `EventDoc.status` union mismatch — pick one vocabulary (`ACTIVE`/`UPCOMING`/`COMPLETED`/`DELIVERED`/`ARCHIVED`), migrate writers, then narrow the type. Update local `app/admin/events/CLAUDE.md` once resolved.
- [ ] `eventAccess` consistency: two writer paths (legacy `updateBookingStatus(BOOKED)` and new `onProjectBooked`) — once the legacy is retired (see Phase 0.4), drop the legacy event-creation branch.

### 0.3 Dead-code pass

Delete the following (all verified zero external consumers):

| Target | Action |
|---|---|
| `lib/db/photos.ts` runtime functions (`photosCol`, `listPhotos`, `listPublicPhotos`, `createPhoto`, `countPhotos`, `deletePhoto`) | Delete. Keep only the `PhotoDoc` type (now extended with `r2Key`/`storageKey`). |
| `lib/db/bookings.ts` runtime functions (`bookingCol`, `createBookingInquiry`, `listBookingInquiries`, `updateBookingStatus`, `countBookingInquiries`, `CommunicationLogEntry`) | Delete. Keep `BookingInquiryDoc` + re-exported types until the legacy collection retires. |
| `lib/db/clients.ts` runtime functions (`clientsCol`, `getClient`, `getClientByEmail`, `createClient`, `updateClient`) | Delete. Keep `ClientDoc` type + `generateReferralCode` (still imported by `scripts/migrate.ts`). |
| `lib/db/contracts.ts` entire runtime + types | Delete. Production writes directly via `adminDb`. |
| `lib/db/event-access.ts` entire runtime + types | Delete. Production writes directly via `adminDb`. |
| `lib/db/events.ts` `eventsCol`, `getEvent`, `listEvents`, `updateEvent`, unused `coverPhotoUrl` field | Delete the helpers (only `createEvent` is used and even that may be inlined in `app/admin/events/actions.ts`). Verify before delete. |
| `lib/db/invoices.ts` runtime functions | Delete. Keep `InvoiceDoc`. |
| `lib/db/mail.ts` entire file | Delete (every consumer writes inline). |
| `lib/db/users.ts` `getUser`, `listUsers` | Delete. Keep `upsertUser` (still used). |
| `lib/session.ts:60-62 isAdmin()` | Delete (zero callers). |
| `lib/storage/r2.ts > generatePresignedGetUrl` | Delete unless wired into multipart RAW preview path (decide first). |
| `app/admin/bookings/BulkActions.tsx` + `selectedIds` plumbing + `bulkUpdateStatus` action | Delete or **finish wiring**. Today it's unreachable — `selectedIds` is never written. Recommend wiring before deleting; bulk archive on the Kanban is a common admin need. |
| `app/admin/bookings/tag-actions.ts > recalculateLeadScore` | Delete. |
| `app/admin/bookings/comms-actions.ts > deleteCommunicationLog` | Delete. |
| `app/settings/page.tsx` dead `useTransition`/`isPending` | Delete. |
| Stale comments (`// ← this line was missing`, `// AFTER`, stale commented-out RAW preview block) | Delete. |
| Empty `catch {}` in `app/settings/page.tsx:50` | Replace with `catch (err) { console.debug("settings: malformed localStorage", err); }`. |
| `app/admin/users/actions.ts:25-27` swallowed `auth.updateUser` errors | Narrow to expected error codes; log others. |

After the delete pass, decide on the `lib/cloudflare.ts` deprecation: either migrate all 13 consumers to import from `lib/storage/*` directly (preferred — small mechanical change) and delete the facade, or leave it with the existing CLAUDE.md note.

**Two duplicated types to consolidate:**
- `Role` defined in both `lib/db/clients.ts` and `lib/db/users.ts` → keep one (recommend `lib/db/users.ts` since `clients.ts` runtime is being deleted).
- `CommunicationChannel` defined in both `lib/db/projects.ts` and `lib/booking-kanban.ts` → keep `lib/booking-kanban.ts`, import from there in `lib/db/projects.ts`.

### 0.4 Legacy retirement preparation

The legacy `/admin/bookings` Kanban + `bookingInquiries` collection will be retired once `/admin/projects` reaches parity. Phase 0 doesn't retire it — Phase 1 does. The prep here:

- Document the parity gap in `app/admin/bookings/CLAUDE.md` (already done; revise if anything in Phase 1 fills it).
- Mark the "Temporary Migration Step" line in `app/booking/actions.ts` with a TODO referencing the retirement date target.
- When `/admin/projects/[id]` reaches feature parity (Phase 1 deliverable), update the AdminSidebar to remove "Booking Inquiries" and delete `app/admin/bookings/` in one commit.

### 0.5 Success criteria for Phase 0

- `npm run build` exits 0; `npm run lint` exits 0 (ignoring the React Hooks 7 warnings already triaged in `eslint.config.mjs`).
- All Phase 0.1 + 0.2 bugs fixed; all Phase 0.3 dead code removed.
- `lib/db/*` files contain only what's actually consumed.
- A short follow-up PR exists for each half-shipped route deciding "build now" or "remove link".

---

## Phase 1 — CRM completeness (4–6 weeks)

> Theme: Make the admin a tool Korrin actually wants to open every morning. Close the gap with HoneyBook/Dubsado/Studio Ninja on must-have surfaces.

### 1.1 Project workspace v2

Wire `app/admin/projects/[id]/page.tsx` into a complete workspace. Replaces the current stub.

**Tabs:** Overview · Messages · Contract · Invoice · Gallery · Timeline · Files · Notes.

Each tab is a server-rendered component, fetched in parallel via `Promise.all`. Server Actions in sibling files (`contract-actions.ts`, `invoice-actions.ts` already exist; add `message-actions.ts`, `note-actions.ts`, `timeline-actions.ts`).

**Header bar:** client avatar + name + project title + status pill + lead score gauge. Right side: **Advance Status** button (opens a modal with the allowed transitions + reason field; calls `updateProjectStatus`), **Send Email** button (opens composer prefilled with last thread context), **Archive** button.

**Left rail:** client mini-card (email/phone/source/sessions/credit), project mini-card (type/package/value/timeline/notes). Persisted across tab switches.

**Tab specifics:**
- **Overview** — key dates, location with map preview (Google Static Maps API), package + price, questionnaire status, tags, next-best-action chip.
- **Messages** — threaded view of `projects/{id}/messages` (inbound + outbound, EMAIL/SMS/PHONE/IN_PERSON). Reply composer at the bottom with template picker. AI **Draft reply** button (Phase 5). Read receipts.
- **Contract** — preview (rendered HTML in iframe), Send, Re-send, Void. After send: signature status + audit log (IP, UA, signedAt). After sign: download PDF button.
- **Invoice** — deposit + balance line items, current status, "Send/Resend" + "Mark paid manually" (rare) + Stripe payment link. Refund initiate button.
- **Gallery** — embed `UploadZone` + `PhotoGrid` from `app/admin/events/[id]/` (since each booked project gets an auto-created Event). Show favorites count if Phase 2 favoriting is live.
- **Timeline** — vertical chronology from `statusHistory` (Phase 0 schema addition) + messages + payments + contract events. Each row has a timestamp + actor (Korrin / client / Stripe / cron).
- **Files** — drag-drop other files attached to the project (referrals, vendor PDFs, MUA timeline). Stored in R2 under `projects/{id}/files/`.
- **Notes** — markdown notes with `@self` mentions; auto-saves.

**Effort:** L. **Dependencies:** Phase 0 fixes.

### 1.2 Cmd+K command palette (global)

Fuzzy search across `clients`, `projects`, `events`, `vendors` (Phase 3), plus commands: "Create project", "Send invoice", "Mark paid", "Go to pipeline", "Open inbox". Recent records pinned at top.

Mount in root layout. Trigger on `Cmd+K` / `Ctrl+K` everywhere. Implementation: client component, fetches an indexed search via `/api/search?q=`, debounced 150ms. Backend: combine Firestore prefix queries + a small in-process trigram index (built nightly via cron into `searchIndex/{periodKey}`).

**Effort:** M. **Differentiator: nothing in the comp set has this.**

### 1.3 Unified admin inbox

`/admin/inbox`. Backend: `inboxItems/{id}` populated by:
- Booking form submission → creates inbox item type `INQUIRY_RECEIVED`.
- Stripe webhook → `PAYMENT_RECEIVED` or `PAYMENT_FAILED`.
- Contract signed (Phase 1.7) → `CONTRACT_SIGNED`.
- Inbound email match (Phase 1.5) → `MESSAGE_RECEIVED`.
- Gallery access requested → `GALLERY_REQUESTED`.
- Cron firings, automation outputs.

UI: keyboard-first triage (j/k navigate, e archive, s snooze 24h, m mark read). Bulk actions. Snoozed items reappear at the configured time.

**Effort:** M. **Dependencies:** 1.1 (for context links), 1.5 (for email events).

### 1.4 Pipeline table view + saved views

Toggle on `/admin/projects` between Kanban and Table. Table = sortable/filterable columns, multi-select with bulk actions. Add a "Saved Views" dropdown — bundles of `{filter, sort, columnSet}` persisted to `users/{uid}/views/{viewId}`.

Ship 5 default saved views: **Hot leads**, **Stuck >7d**, **Galleries overdue**, **This week's shoots**, **Awaiting deposit**.

Column "rotting" — when a project sits in a stage longer than the stage SLA, color-shift the row/card.

Column footers: total count + weighted pipeline value (`sum(estimatedValue × stageProbability)`).

**Effort:** M.

### 1.5 Two-way email sync (Gmail)

OAuth-connect Korrin's Gmail. Pull inbound mail every 5 minutes via Gmail watch + push notifications (Pub/Sub). Match each message to a `clients/{id}` by `From` email; if matched, append to the open project's `messages` subcollection with `direction: INBOUND`. Push outbound emails sent from the workspace UI through the Gmail API so threads stay coherent.

If no matching client, drop the email into the inbox under a `UNMATCHED_INBOUND` item with a "Create client" CTA.

**Effort:** L. **External dependency:** Google Cloud project with Gmail API + Pub/Sub.

### 1.6 Email open + click tracking

Build the email tracking layer (§4.3). Wrap every outbound mail through `mail/` queue. For Phase 1, surface engagement at three places:
- Project detail Messages tab — chips on each outbound email: "opened 3×, clicked invoice link".
- `/admin` dashboard — **Hot Today** ribbon listing projects whose engagement spiked in the last 24h.
- Lead score input — engagement events bump `engagementScore` (replace decay-only formula).

**Effort:** M.

### 1.7 E-sign contract flow

Public route `/contracts/[token]` (token = `contracts/{id}.signingToken`, single-use, 14-day expiry). Page renders the contract HTML, captures signature via:
- Drawn signature (canvas), OR
- Typed signature (auto-styled in Cormorant Garamond italic), with explicit "I agree this is my electronic signature" checkbox.

On submit: capture `signerIp` (from `x-forwarded-for`), `signerUserAgent`, `signedAt` (server timestamp), render a completion-certificate PDF (the contract + a signature page + a metadata appendix), upload to R2 at `contracts/{id}/signed.pdf`, email a copy to both parties.

Status flow: `DRAFT → SENT → SIGNED → ` (or `→ VOIDED` from Korrin).

Reminders: T+24h, T+72h, T+7d if status still `SENT` (uses sequence engine §4.1).

**Effort:** L.

### 1.8 Public scheduler v1

Route `/book/[packageSlug]` (also embeddable). Calendar UI showing Korrin's availability (Google Calendar busy slots + weekday/weekend rules + minimum lead time). User picks a slot, fills a short form (~3 fields beyond what `/booking` collects), reviews the deposit amount, and pays via Stripe Checkout. On `checkout.session.completed`, project auto-advances to `BOOKED`, runs `handleProjectTransition` side effects, and sends the welcome packet (Phase 2).

This is the "Smart File" replacement — one URL gathers info, takes payment, and books the slot.

**Effort:** L. **Dependency:** Phase 3.3 (Google Calendar sync).

### 1.9 Automation recipes config UI

Replace hardcoded magic numbers in `lib/project-transitions.ts` with a settings page at `/admin/settings/automations`. List the 5–8 recipes, each toggleable on/off, with a small parameter set (delay days, template choice). Persist to `users/{uid}/automationConfig`.

Don't build a visual canvas. 8 named recipes with knobs covers 90% of cases without the complexity of n8n/Zapier.

**Effort:** S–M.

### 1.10 Smart inbox quick actions on mobile

Phone-optimized layout of `/admin/inbox` plus a "Quick Reply" surface — tap an inquiry, see prior context summary, pick a template, send + advance status, all in 3 taps. PWA-installable so it lives on Korrin's home screen.

**Effort:** M. **Dependency:** 1.3 and 1.5.

### 1.11 Phase 1 success criteria

- `/admin/projects/[id]` is the daily-driver workspace (no Kanban detail drawer needed).
- Cmd+K finds any record in <500ms.
- Inbox shows everything that needs attention, snooze works.
- Email replies sent from the workspace appear in the client's Gmail thread; client replies appear in the workspace within 60 seconds.
- E-sign + scheduler + deposit flow works end-to-end in a single client URL.
- Korrin can configure their automations without editing code.
- Legacy `/admin/bookings` is removable.

---

## Phase 2 — Client experience v2 (4–6 weeks)

> Theme: Make every client touchpoint feel premium. Replace the inquiry form with a guided journey, replace the gallery with a proofing experience, replace the silence-between-emails with a brand-owned portal.

### 2.1 Multi-step booking inquiry

Refactor `/booking` from a single form to a 3-step flow:
1. **What** — session type tile picker, tentative date range (month picker, not specific date).
2. **Where** — location dropdown (Cary / RDU / NC / "I'll travel") + vibe quiz (5 tile choices that map to mood tags).
3. **Who** — name, email, optional phone, free-text "anything else?".

Each step has a progress bar; data persists to localStorage + a `partialInquiries/{id}` doc keyed by session token. Multi-step forms convert 2–3× single-page forms in this category (industry data).

After step 3: success page with "what happens next" timeline, calendar embed to book a 15-min discovery call, branded thank-you. The `submitBooking` Server Action runs as today (creates `clients` + `projects` + first message, dual-writes legacy until retirement).

**Effort:** M.

### 2.2 Style quiz + AI mood board

Public `/style` quiz: 5 questions (vibe / setting / energy / formality / detail focus). Output: a curated 9-photo grid pulled from `events/*/photos` filtered by Korrin-assigned style tags. Each result includes a CTA "I love this — book it" that prefills the booking form with the matched session type.

Optional Phase 5 upgrade: AI generates the mood board narration ("Your vibe is editorial-meets-romantic; here's your perfect golden-hour grid").

**Effort:** M. **Dependency:** Per-photo style tagging by Korrin (admin task, can be done lazily over 2 weeks).

### 2.3 Pricing / Investment page

New `/investment` page. Editorial copy + 2–3 package cards with what's included + starting-at numbers. CTA: "Get the full guide" → lead magnet form (Phase 4.1). Footer testimonial + "ready when you are" CTA.

Industry research shows hidden pricing kills conversion at the top of funnel; this is the lowest-effort highest-impact change.

**Effort:** S.

### 2.4 Client portal redesign — "Project Workspace"

`/gallery/[id]` becomes `/portal/[projectId]`. Same auth (session + access doc). Tabs: **Gallery · Contract · Invoice · Timeline · Questionnaire · Files · Messages**.

Header: a hero photo + client name + days-until-shoot countdown (or days-since-delivery).

Mobile-first. Each tab is a self-contained section. PWA manifest so the portal installs to home screen with the Korrin branding.

This is the client-side mirror of the admin workspace and is the single biggest "premium feel" lift.

**Effort:** L. **Dependency:** 1.1, 2.7.

### 2.5 Gallery favorites + proofing

In `/portal/[projectId]` Gallery tab: tap-to-favorite hearts, "My picks (12)" sidebar, "Build your album" CTA. Multi-list favorites ("Mom's picks", "for the album", "share with vendors"). Stored on `photos.favoritedBy: string[]` (clientIds).

On Korrin's side: `/admin/projects/[id]/gallery` shows favorites overlay + counts + "send me what they picked" export (zip of favorited high-res JPEGs to R2 signed URL).

**Effort:** M.

### 2.6 Gallery polish

- **Slideshow mode** — full-screen with optional music (royalty-free Suno tracks Korrin selects per gallery).
- **Mobile gestures** — pinch zoom, double-tap zoom, swipe to dismiss. Per Baymard, 40% of comp sites fail this — fixing it is credibility-defining.
- **Download PIN** — per-gallery 4-digit PIN, settable in admin. PIN tracks downloads (`downloads/{id}` log).
- **Resolution tiers** — Cloudflare Images variants `web`, `social`, `print`, `archive`. Picker on download.
- **Right-click and drag blocked** at the image level (already exists, audit for consistency).

**Effort:** M.

### 2.7 Welcome packet generator

On `BOOKED`, server-renders a personalized welcome PDF (couple/family name, shoot date, location with map, package summary, prep tips, vendor recs, communication windows). Stored at `clientGuides/{projectId}` in R2; linked in the portal Timeline tab and welcome email.

Template lives in `templates/` collection so Korrin can edit copy without code.

**Effort:** M.

### 2.8 Day-of-shoot timeline builder

In `/admin/projects/[id]/Timeline`, drag-and-drop hour blocks ("3:00pm getting ready", "4:00pm first look"). Each block has a duration + location + notes. Save as a shareable read-only URL for client + vendors. Embed in the client portal.

**Effort:** M.

### 2.9 Questionnaire engine

Auto-send a session-type-specific questionnaire when `status` becomes `BOOKED`. Client fills in the portal at `/portal/[projectId]/questionnaire/[qId]`. Responses are structured (`responses: { question: answer }`) and:
- Feed the shoot brief auto-generator (Phase 3.4).
- Pre-fill the day-of timeline.
- Populate "what to bring" reminders in the countdown sequence.

Types: Wedding · Portrait · Family · Editorial · Engagement (5 templates, each ~12–18 questions).

**Effort:** M.

### 2.10 Sneak-peek auto-drop

Admin marks 3–5 photos with the reserved tag `sneakPeek` in the event editor. 48h after the `shootDate`, a cron job auto-emails the sneak-peek to the client with low-res previews + "your full gallery in ~3 weeks" message.

**Effort:** S.

### 2.11 Delivery + reaction capture

On `GALLERY_DELIVERED`, send the gallery link with a 5-star "how does this feel?" widget inline. Captures `clientNps` on the project. Gates the review request (Phase 4.X) — only ask for a Google review if NPS ≥ 4.

**Effort:** S.

### 2.12 Phase 2 success criteria

- New booking form converts ≥2× the old single-page form (measure for 6 weeks).
- Client portal has measurable retention (≥3 visits per gallery on avg).
- Sneak peek + delivery + favorites flows are end-to-end automatic.
- Korrin sends ≤1 manual email per delivered shoot (vs. the current ~5).

---

## Phase 3 — Business operations (4–6 weeks)

> Theme: Make Korrin's Photos run like a finance-and-ops team built it.

### 3.1 Financial dashboard

`/admin/reports/finance`. The "revenue hero strip" + deposit liability + revenue-by-type + revenue-by-source + Stripe payout schedule from the analytics research.

Six KPI tiles + 4 charts. Tremor.so or Recharts.

Daily cron pre-aggregates into `analyticsCache/finance:YYYY-MM-DD` so the page loads in <300ms.

**Effort:** L.

### 3.2 Expense tracking + tax dashboard

New `expenses/{id}` collection (see §3 schema). Manual entry UI + Plaid integration (later). Auto-categorize to Schedule C lines via merchant→category rules.

`/admin/reports/tax` shows:
- Quarterly estimated payment due + reserve recommendation.
- Schedule C category donut.
- Mileage log + auto-multiplier ($0.70/mi 2025 IRS rate).
- Equipment depreciation schedule (new `assets/{id}` collection, MACRS classes, Section 179 elections).
- YTD income/expense P&L.

Export as CSV → drop into the accountant's QuickBooks Self-Employed.

**Effort:** L.

### 3.3 Google Calendar sync

Two-way:
- Outbound: every `BOOKED` shoot creates a Calendar event in Korrin's primary calendar with project URL in description.
- Inbound: Calendar busy slots block the public scheduler.

Add buffer rules per session type (45min before/after weddings, 20min for portraits, 10min for headshots).

**Effort:** M.

### 3.4 Shoot brief auto-generator

24h before each shoot, generate a PDF brief: client names + shot list (from questionnaire) + location (with parking + permits + best-light window from Phase 3.5) + weather snapshot (from Phase 3.6) + vendor contacts + gear checklist (Phase 3.7). Pushed to Korrin's phone via push notification.

**Effort:** M.

### 3.5 Location scouting database

`/admin/locations`. Each location: name, lat/lng, photos, best-light window (auto-computed via SunCalc), parking notes, permit needed (Y/N + cost), accessibility, sample shots, last visited. Reusable across projects.

Public read-only `/portal/[projectId]` Timeline links to "where we're shooting" cards drawn from this.

**Effort:** M.

### 3.6 Weather + golden hour intelligence

72h + 24h before every outdoor shoot, fetch forecast (WeatherKit or Tomorrow.io) and golden-hour times (SunCalc) for the location. Push to the project as `weatherSnapshot` + surface in the shoot brief.

Admin override: "this shoot is indoor, skip weather."

**Effort:** S.

### 3.7 Gear checklist per shoot type

Reusable templates ("Wedding kit", "Portrait kit", "Editorial kit"). Check off the morning of the shoot. Records to `projects/{id}/gearLog`. Insurance-relevant.

**Effort:** S.

### 3.8 Vendor / collaborator CRM

`/admin/vendors`. Categories: Venue, Planner, Florist, HMUA, Videographer, DJ, Officiant, Rentals. Each vendor: contact + portfolio + rating + notes + cross-referral count. Tagged to projects as a many-to-many.

Welcome packet auto-pulls top-rated vendors in the shoot location radius.

**Effort:** M.

### 3.9 COI request workflow

For venue-required shoots, a checklist item at booking: "Request COI from insurer". Click → opens a templated email to Korrin's insurer with venue name + dates + additional-insured language. When the COI PDF comes back, drag-drop into the project.

**Effort:** S.

### 3.10 Compliance dashboard

`/admin/reports/compliance`:
- Signed model releases by shoot.
- COI status per booked event.
- Outstanding GDPR/CCPA delete requests.
- Sales-tax filings due (Phase 3.11).

**Effort:** S.

### 3.11 Sales tax engine

Per-state rules (e.g. NC: digital photos taxable; FL: not). Configurable in `users/{uid}/taxRules`. Auto-add line items to invoices when applicable. Generate monthly/quarterly tax-due reports.

**Effort:** M.

### 3.12 Refund + chargeback ledger

Stripe `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed` webhooks update `InvoiceDoc.disputeStatus` + `refundCents`. Surface in finance dashboard. Auto-flag if dispute rate >0.5%.

**Effort:** S.

### 3.13 Editing-workflow tracker

For each project after `shootDate`: track ingestion → culled → edited → delivered with target SLAs. Aging alerts when a project crosses its category SLA (4-8wk wedding, 1-2wk portrait).

Status pills on `/admin/projects` table view show "Editing — Day 18 of 28".

**Effort:** S.

### 3.14 Capacity planning view

`/admin/calendar` calendar heatmap, 12 weeks back + 52 forward, colored by sessions booked relative to weekly cap. Click a week → list projects + travel intensity (drive time between consecutive shoots).

**Effort:** M.

### 3.15 Phase 3 success criteria

- Korrin can answer "what's my revenue YTD, after expenses, with quarterly tax owed" in <30 seconds.
- Every booked outdoor shoot has weather + golden-hour data 24h before.
- 100% of weddings have a vendor checklist + COI before the shoot.
- Editing SLAs are visible on every active project.

---

## Phase 4 — Growth engine (4–6 weeks)

> Theme: Acquire new clients without buying ads. Reactivate past clients without hand-crafting emails.

### 4.1 Lead magnets

`/admin/lead-magnets`: title, slug, R2 file, follow-up sequence. Public CTA `/get-the-guide` (or per-magnet `/magnet/[slug]`) gates the download behind an email + first-touch UTM capture. Auto-enrolls into the named follow-up sequence.

Ship 4 magnets: Pricing Guide · Wedding Prep Guide · Engagement What-to-Wear · Cary/RDU Venue Guide.

**Effort:** M.

### 4.2 Sequence engine + first sequences

Build §4.1 building block. Ship 6 sequences in Phase 4:
- **Cold-lead nurture** (6 weeks, 5 emails) — for projects in `INQUIRY` with no response in 48h.
- **Shoot-day countdown** (date-relative to `shootDate`) — prep emails at 4w/1w/2d/day-of.
- **Sneak peek + delivery** (covered Phase 2.10/2.11 — runs via this engine).
- **Review request** (gated on `clientNps ≥ 4`).
- **Anniversary touch** (1 year after `deliveredAt`).
- **Win-back** (18 months idle).

**Effort:** L for engine + S each for the first 6 sequences.

### 4.3 Segments + broadcast composer

Build §4.2 building block. UI: predicate builder in `/admin/segments`. Broadcast composer at `/admin/broadcasts` — block-based (hero / image grid / text / CTA / footer), per-segment send, with open/click tracking.

Ship 5 starter segments: **All clients**, **Booked in last 90d**, **Past clients (12+mo)**, **Ghosted leads**, **Engaged (life-event tag)**.

**Effort:** L.

### 4.4 Tiered referral engine

Replace flat referral credit with tiers:
1. 1st referral → $50 credit
2. 2nd → $100 credit
3. 3rd → free mini-session voucher
4. 5th → printed album gift

`clients.referralCount`, `referralTier`, `referralRewardsLog`. Auto-apply credits to next invoice. Email notification on each tier-up.

**Effort:** M.

### 4.5 Referral chain visualization

`/admin/reports/referrals`. Sankey or force-directed graph showing referral chains. Top referrers leaderboard. Total attributable revenue per referrer (transitive — count downstream referrals too).

**Effort:** M.

### 4.6 Review request multi-step

When project `clientNps ≥ 4` and `deliveredAt >= 3 days ago`, send a 3-email rotation across platforms (Google → 7d later → The Knot → 14d later → Facebook). Each platform link is prefilled with the client's name. `reviewRequests/{id}` tracks per-platform status.

**Effort:** S (with sequence engine).

### 4.7 Press submission tracker

`/admin/projects/[id]/press`: log submissions per publication. Backlink monitor (monthly cron pings each published URL to confirm the link is still live).

**Effort:** M.

### 4.8 Journal post auto-drafter

On `GALLERY_DELIVERED`, draft a `journalPosts/{slug}` with: title `{firstNames} | {venue} | {city}`, 30 selected photos, SEO meta auto-filled from project + venue, vendor mentions auto-linked. Body is empty for Korrin to write — but with an AI "write the first draft" button (Phase 5).

Published posts render at `/journal/[slug]` with `BlogPosting` schema, breadcrumbs, related-shoot suggestions.

**Effort:** L.

### 4.9 Campaign / venue landing pages

`/admin/campaigns` CMS. Each campaign: slug, hero, copy, gallery filter, default UTM, inquiry-form prefills. Renders at `/c/[slug]`. Used for Google Ads, IG-bio link, or vendor partnerships.

**Effort:** M.

### 4.10 Pinterest auto-pin

When a journal post is published, generate 3 vertical (2:3) pin images using a hero photo + Cormorant Garamond title overlay (server-rendered via @vercel/og), upload via Pinterest API to a connected board, track clicks via the redirect layer.

**Effort:** M.

### 4.11 UGC monitor

Daily cron polls IG mentions/tags of `@korrinsphotos` via Instagram Graph API. Saves matched media to `ugcMentions/{id}`. UI at `/admin/ugc` to approve or skip; approved mentions render on the public `/testimonials` page.

**Effort:** L (Instagram Graph API + approval queue).

### 4.12 Schema markup everywhere

JSON-LD injected on:
- Site-wide footer: `Photographer`/`LocalBusiness`.
- Portfolio category pages: `Service`.
- Journal posts: `BlogPosting` + `ImageObject` per photo.
- Testimonials: `Review` + `AggregateRating`.
- Breadcrumbs everywhere.

Pure additive; rendered from the existing data.

**Effort:** S.

### 4.13 Education / digital products store

`/admin/products` for Korrin's presets, education PDFs, mini-courses. Public `/shop`. Stripe Checkout → R2 signed URL emailed to buyer. Time-limited download links.

Optional: cohort-based mentorship via Calendly + payment-on-book.

**Effort:** L. Worth doing only if there's intent to sell presets/courses.

### 4.14 Phase 4 success criteria

- Lead-magnet downloads ≥50/mo within 2 months of launch.
- ≥30% of delivered projects yield a public review.
- ≥10% of new inquiries are referral-attributed.
- Journal generates ≥100 organic visits/mo within 6 months.

---

## Phase 5 — AI assist layer (parallel, ongoing)

> Theme: Use Claude in the seams where Korrin already pauses. Not "AI feature", but AI removing 90% of typing.

These can be built in parallel with any phase that has its prerequisites.

### 5.1 AI draft reply on every project thread

Project Workspace → Messages tab → "Draft reply" button. Sends the full thread + project context (status, package, dates, tags) + Korrin's voice samples (last 20 outbound emails) to Claude. Inline editor opens with the draft. Korrin edits + sends.

Logs the AI generation for cost tracking + Korrin-edit-rate (if the edited version diverges <10% from the draft, the model is calibrated; >40%, retrain prompt).

**Effort:** M. **Dependency:** 1.5.

### 5.2 Thread summary widget

Project Workspace sidebar. When a thread crosses 10 messages, show "Summary (auto-updated)" with a one-paragraph summary: key dates, open questions, next action. Regenerated on each new message.

**Effort:** S.

### 5.3 Sentiment scoring on inbound

Each inbound message gets a 1-5 sentiment score from Claude (with sub-category: enthusiasm / hesitation / confusion / urgency / dissatisfaction). Color-coded chip in the message list. Aggregated into a per-project sentiment trend chart.

**Effort:** S.

### 5.4 Next-best-action chip per project

On each project card in pipeline view, a one-line AI recommendation: "Follow up — opened 3× no reply", "Send invoice — contract signed 2d ago", "Confirm shoot — 3d out, no questionnaire submitted". Generated nightly from project state + engagement events.

**Effort:** M. **Dependency:** 1.6.

### 5.5 AI lead-score parallel signal

Alongside the rule-based `calculateLeadScore`, run a Claude lead-score (0-100) that considers the same inputs + message tone + thread length. Surface BOTH on the project card; let Korrin compare over time. After 3 months of data, choose which weighting to keep.

**Effort:** M.

### 5.6 AI booking-form interpreter

On submission, Claude reads the free-text "anything else?" field and:
- Extracts entities (venue mentioned, family size, urgency hints, "destination", etc.) → auto-applies tags.
- Estimates session complexity → adjusts the auto-quote.
- Flags red flags ("looking for cheapest", "doing this last minute") → highlights for Korrin.

**Effort:** S.

### 5.7 Journal post first draft

Per-journal-post "Write the first draft" button. Claude takes: venue, season, time of day, package, client first names, 5 highlight photos with captions → writes a 600-word recap in Korrin's voice (calibrated from last 10 published posts).

**Effort:** S.

### 5.8 AI mood-board generator

Phase 2.2 quiz upgrade: instead of a static photo grid, Claude generates the mood-board narration AND clusters Korrin's photo library by style automatically (vector-embedding-backed via Cloudflare Vectorize or pgvector — sidecar to Firestore).

**Effort:** L.

### 5.9 Cohort story generator

Every Monday, Claude reads `analyticsCache/finance:*` + funnel + retention data and writes a 1-paragraph narrative: "Last week was unusually strong for Engagement bookings (5, vs 2 trailing average); Instagram remains the top source; one project is stuck >9d in `PROPOSAL_SENT` — recommend nudge". Pinned on the dashboard.

**Effort:** M. **Dependency:** Phase 3.1.

### 5.10 AI tax suggestion engine

Monthly: Claude reads YTD `expenses` + `assets` + revenue, suggests:
- Estimated quarterly tax owed (with assumptions surfaced).
- Section 179 / Bonus depreciation opportunities ("you have $X spend in cameras YTD; electing Section 179 saves $Y").
- Category gaps ("you have 0 home-office expenses; the simplified method would deduct ~$1,500").

Suggestions only — never auto-files anything. Always export with disclaimer + CPA-review prompt.

**Effort:** M. **Dependency:** Phase 3.2.

---

## Phase 6 — Future bets (open horizon)

Features that don't fit the 6-month plan but are worth tracking.

| Feature | Why later |
|---|---|
| Native iOS / Android admin app | PWA covers 80% of use; native pays off only at scale |
| WhatsApp Business via Twilio | Only ~5% of US wedding clients prefer this channel |
| Multi-brand support | Single-tenant is a feature for now |
| Album designer with drag-drop spreads | Heavy UI; consider partnering w/ existing tools (Smartalbums, Fundy) via export |
| Virtual IPS (in-person sales) replacement | Replaceable by gallery favorites + print store |
| Watermark variant on Cloudflare Images | Add when piracy becomes a real problem |
| 4K video gallery support | Add when Korrin starts offering video |
| Vendor-portal (planners log in to see shoot info) | Phase 3.8 covers 90% via shareable links |
| Lab fulfillment integration (Miller's/WHCC) | Add once print store demand justifies |
| Sun-position visualizer for venues (AR-style) | Cool but PhotoPills already exists; integration not core |
| Anonymous booking-form analytics (where users drop off) | Build when conversion rate is the bottleneck |
| Stripe Tap-to-Pay on iPhone for in-person sessions | Niche; defer |
| Open-source extraction of components | Decision deferred until system is mature |

---

## 13. Original ideas

Items not in any single research report — synthesized from the totality of inputs + Claude's read of the codebase.

### 13.1 The "Action Cards" pattern

Every project card in the pipeline view carries a single **Action Card**: the one most-important thing to do next, generated by `getNextBestAction(project)`. This is more useful than a generic "rotting" indicator because it tells Korrin *what to do*, not just *that something is wrong*.

Implementation: a pure function `getNextBestAction(project, recentEvents)` ranks candidate actions (Follow up, Send invoice, Schedule call, Send questionnaire, Mark in editing, Send sneak peek, Request review, Send referral kit) and returns the top one with a deep link. The pipeline card renders just the title — clicking jumps directly to the right tab with the relevant action pre-loaded.

Differentiator: solves the "open the project, scroll around, figure out what to do" mental tax.

### 13.2 "Studio Hours"

A configurable schedule (e.g., M-F 10am-6pm) that auto-responds to client emails outside hours with "Korrin reads messages in the morning Mon-Fri — back soon" and suppresses outbound notifications during off-hours. Prevents the "always-on" trap for a solo operator.

### 13.3 Client portal "what's happening" timeline

Instead of just a Messages tab, surface a unified timeline on the portal home: contract sent (date), questionnaire submitted (date), deposit paid (date), sneak peek received (date), gallery delivered (date), days until anniversary (countdown). Anchors the experience around progress, not communication.

### 13.4 Booking form post-submit calendar embed

After step 3 of the booking form, instead of "we'll get back to you", embed a Cal.com-style 15-minute discovery call picker. Industry data: replying within 5 minutes wins 32% close rates vs. 24% at 1 hour. A scheduled call is even better — it's a commitment, not a reply.

### 13.5 "Korrin's picks" overlay in the gallery

When Korrin enters the admin gallery editor, tagging 30-60 photos as "Korrin's picks" creates a curated subset clients can opt into ("Just show me Korrin's favorites"). Reduces gallery overwhelm (a 600-photo wedding gallery is paralyzing); raises perceived editorial quality.

### 13.6 Recurring revenue layer for past clients

A `/portal/upgrade` page where past clients can opt into:
- Annual "family update" sessions (12-mo trigger, soft commitment, $X/yr).
- A "wedding gift" subscription where a friend pays Korrin a discounted retainer to gift a future shoot.
- Print credit balances (top up the wallet at a discount).

Converts one-time clients into recurring revenue without inventing new product surface.

### 13.7 Local SEO autopilot

Daily cron checks Korrin's NAP consistency across 8-10 directories (Google Business Profile, Yelp, Apple Business Connect, Bing Places, The Knot, WeddingWire, Zola, BBB). Surfaces drift in `/admin/reports/seo` with one-click "copy current NAP for [directory]". Single most undervalued SEO lever for local photographers.

### 13.8 The "Tax-saving Calendar"

A view in `/admin/reports/tax` that suggests, by month, the optimal tax actions:
- April → Q1 estimated tax due.
- August → Section 179 opportunities (mid-year gear purchases get full deduction same year).
- November → equipment buy-window before Dec 31 to claim depreciation.
- December → charitable giving / SEP IRA contribution opportunity.

Each suggestion clickable into the underlying numbers.

### 13.9 "Quiet Season" planner

Analyzes the booking history for seasonal lows (typically Feb/Aug). Auto-generates a marketing push plan for those months:
- 30 days before low season: kick off a holiday mini-session campaign or a "Valentine's gift" gift-card push.
- During low season: target past clients with anniversary refresh offers.
- Schedule social posts more aggressively (auto-queue from Pinterest pin generator).

### 13.10 Gallery analytics for the client

Past delivery, the client portal can show the client *their* analytics: which photos got the most favorites from their group, which got the most downloads, "your top 5 most-shared". Engagement device that doubles as a portfolio-tagging signal for Korrin.

### 13.11 Cross-vendor "wedding day" room

For booked weddings within 30 days, create a per-wedding shareable link (token-secured, no login) for vendors (planner, florist, MUA, videographer) to view: timeline, location, "tagged in this wedding" vendor list, contact card. Replaces 15-email vendor coordination threads. Differentiator: vendor reciprocity → cross-referrals.

### 13.12 "Off the record" notes

A toggle on every note in the Notes tab: "private to me" vs. "shareable with client". Private notes never render anywhere a client could see. Encourages honest internal note-taking (e.g., "bride was anxious about FIL drama; smooth this out at the rehearsal").

### 13.13 The "Brand Voice" calibration prompt

Once a quarter, Korrin reviews the last 20 AI-drafted emails and labels which ones felt "on voice". Those labels train a meta-prompt that adjusts the system message for §5.1. Without this, AI drafts drift into generic vendor-speak.

### 13.14 Public "Investment + Process" hybrid page

Instead of `/pricing` and `/about` as separate pages, a single `/investment` page that walks: Process → Packages → Starting prices → Testimonials → CTA. Reduces decision anxiety (process answers "how does this work?" *before* the price hits).

### 13.15 The "First 100 Clients" dashboard

A historical view showing every client + project + revenue from day 1, with the ability to mark "this client changed my career" and tag them as ambassadors. Mostly emotional, partly strategic (these are the people who will keep referring forever).

### 13.16 Auto-detect "wedding date too far away" risk

If a project hits `INQUIRY` with a `tentativeMonth` > 18 months out, flag as low-urgency in the pipeline view. These leads convert at lower rates and should be treated differently — they want a future-conversation thread, not a quote in 24h.

### 13.17 The "Brand Brief" generator for commercial work

For `SessionType: 'Editorial'` or `'Commercial'`, an extra workflow surface: a shared brief with the brand (mood references, deliverables, license tier, usage window, retouching depth, exclusivity). Replaces the 8-email back-and-forth that always precedes commercial shoots.

### 13.18 Cost-per-inquiry / cost-per-booking tracking

Manual ad-spend ledger at `/admin/ad-spend` (paste in monthly numbers from IG / Google Ads). Joined with `firstTouchSource` → per-channel ROAS. Surfaces in finance dashboard: "Instagram: $0 spent, 12 inquiries, 4 bookings, $14k revenue. Google Ads: $400 spent, 3 inquiries, 1 booking, $3.2k revenue."

### 13.19 Vendor reciprocity tracking

For each vendor in the CRM, track:
- Referrals received from this vendor (how many leads → bookings → revenue).
- Referrals sent to this vendor.
- Net balance (am I owed, or do I owe?).

Surfaced as a leaderboard. Reciprocity is a relationship asset — making it visible compounds it.

### 13.20 The "Phase 7 — Tools for tools" exit ramp

When the system is mature enough, extract a handful of components (the sequence engine, the segments engine, the analytics cache pattern) into an open-source package. Not for revenue — for the same reason photographers publish presets: it strengthens the brand of the person who shipped it.

---

## 14. Implementation rules

These are non-negotiable constraints that apply to every phase.

### 14.1 Build server-first

All new mutation paths use Server Actions, not API routes, unless one of the ADR-006 exceptions applies (webhooks, multi-step uploads, cron, OAuth callbacks, lightweight GETs from client dropdowns).

### 14.2 Add a CLAUDE.md when adding a new top-level directory

Every new directory under `app/`, `lib/`, `components/` gets a CLAUDE.md if it has its own conventions. Keep them under 90 lines.

### 14.3 New collections go in `lib/db/<x>.ts`

Module exports: `<x>Col()` getter, `Doc` interface, pure async helpers. Document the schema in `docs/architecture/unified-client-lifecycle.md` if it participates in the lifecycle. ADR-013 is non-negotiable — never reintroduce a `lib/firestore.ts` aggregator.

### 14.4 Cross-collection orchestration goes in `lib/domain/`

Anything that spans two+ collections or a collection plus external storage lives in `lib/domain/` (e.g. the existing `deleteEventAndAssets`).

### 14.5 Lifecycle hooks go in `lib/project-transitions.ts`

The state machine is the single source of truth for side effects. Don't duplicate transition logic in webhooks or Server Actions — call `handleProjectTransition` and let it dispatch.

### 14.6 Schema evolution: additive first, narrowing last

Every schema change starts as an optional field. Migrate writers. Then narrow the type. Then enforce. This prevents the kind of `EventDoc.status` drift that produced the May 2026 cleanup.

### 14.7 Verify with build + lint before declaring done

`npm run build && npm run lint` must both exit 0 before any phase deliverable is "done". The 12 existing react-hooks warnings are triaged; new warnings of those types are allowed only with rationale.

### 14.8 Cost-aware AI calls

Every Claude API call goes through a single `lib/ai/claude.ts` helper that:
- Uses Anthropic's prompt caching for repeated context (project/client snapshots).
- Logs token usage to `aiCallLog/{id}` for cost monitoring.
- Falls back gracefully (returns "AI temporarily unavailable" instead of crashing).

### 14.9 Privacy-aware logging

`activityFeed` and `inboxItems` may contain client names + project titles. Don't include message bodies. Don't log `client.phone` or full email addresses. PII goes in the canonical record; activity events reference by ID.

### 14.10 Don't break the current users

Korrin's site is live (or will be soon). Every change has a fallback path. New schema fields are optional. New routes are additive. The old `/booking` page stays functional until `/book/[packageSlug]` is proven. Same for the client portal — `/gallery/[id]` stays alive during `/portal/[projectId]` rollout.

---

## Appendix A — Full feature catalog

A flat reference of every feature mentioned, with phase + effort + source.

| # | Feature | Phase | Effort | Source |
|---|---|---|---|---|
| 1 | Project workspace v2 (tabbed admin view) | 1.1 | L | CRM research + audit |
| 2 | Cmd+K command palette | 1.2 | M | CRM research |
| 3 | Unified admin inbox | 1.3 | M | CRM research (Linear/Front) |
| 4 | Pipeline table view toggle | 1.4 | M | CRM research |
| 5 | Saved views | 1.4 | M | CRM research (Attio) |
| 6 | Rotting / stale-deal indicator | 1.4 | S | CRM research (Pipedrive) |
| 7 | Weighted pipeline value per column | 1.4 | S | Finance research |
| 8 | Two-way Gmail sync | 1.5 | L | CRM research (Missive) |
| 9 | Email open/click tracking | 1.6 | M | CRM + Marketing research |
| 10 | E-sign contract flow | 1.7 | L | Platform research (HoneyBook) |
| 11 | Contract reminder cadence | 1.7 | S | Marketing research |
| 12 | Public scheduler with deposit-on-book | 1.8 | L | Platform + CRM research |
| 13 | Automation recipes config UI | 1.9 | S–M | CRM research |
| 14 | Mobile quick-reply view (PWA) | 1.10 | M | CRM research |
| 15 | Multi-step booking inquiry | 2.1 | M | Client UX research |
| 16 | Style quiz + mood board | 2.2 | M | Client UX + AI research |
| 17 | Investment / pricing page | 2.3 | S | Client UX research |
| 18 | Client portal redesign (Project Workspace) | 2.4 | L | Client UX + Platform research |
| 19 | Gallery favorites + proofing | 2.5 | M | Platform research (Pixieset/Pic-Time) |
| 20 | Gallery polish (slideshow, gestures, PIN, resolution tiers) | 2.6 | M | Client UX + Platform research |
| 21 | Welcome packet generator | 2.7 | M | Client UX research |
| 22 | Day-of-shoot timeline builder | 2.8 | M | Client UX + Ops research |
| 23 | Questionnaire engine | 2.9 | M | Platform research |
| 24 | Sneak-peek auto-drop | 2.10 | S | Client UX research |
| 25 | Delivery + reaction capture (NPS) | 2.11 | S | Client UX research |
| 26 | Financial dashboard | 3.1 | L | Finance research |
| 27 | Expense tracking + tax dashboard | 3.2 | L | Ops + Finance research |
| 28 | Google Calendar sync | 3.3 | M | Ops research |
| 29 | Shoot brief auto-generator | 3.4 | M | Ops research |
| 30 | Location scouting database | 3.5 | M | Ops research |
| 31 | Weather + golden-hour intelligence | 3.6 | S | Ops research |
| 32 | Gear checklist per shoot type | 3.7 | S | Ops research |
| 33 | Vendor / collaborator CRM | 3.8 | M | Ops research |
| 34 | COI request workflow | 3.9 | S | Ops research |
| 35 | Compliance dashboard | 3.10 | S | Ops research |
| 36 | Sales tax engine | 3.11 | M | Finance research |
| 37 | Refund + chargeback ledger | 3.12 | S | Finance research |
| 38 | Editing-workflow tracker | 3.13 | S | Ops research |
| 39 | Capacity planning calendar | 3.14 | M | Ops research |
| 40 | Lead magnets | 4.1 | M | Marketing research |
| 41 | Sequence engine + 6 starter sequences | 4.2 | L+S | Marketing research |
| 42 | Segments + broadcast composer | 4.3 | L | Marketing research |
| 43 | Tiered referral engine | 4.4 | M | Marketing research |
| 44 | Referral chain visualization | 4.5 | M | Marketing + Finance research |
| 45 | Multi-step review request | 4.6 | S | Marketing research |
| 46 | Press submission tracker | 4.7 | M | Marketing research |
| 47 | Journal post auto-drafter | 4.8 | L | Marketing research |
| 48 | Campaign / venue landing pages | 4.9 | M | Marketing research |
| 49 | Pinterest auto-pin | 4.10 | M | Marketing research |
| 50 | UGC monitor | 4.11 | L | Marketing research |
| 51 | Schema markup everywhere | 4.12 | S | Marketing research |
| 52 | Digital products store | 4.13 | L | Marketing research |
| 53 | AI draft reply | 5.1 | M | CRM + AI research |
| 54 | Thread summary | 5.2 | S | CRM + AI research |
| 55 | Sentiment scoring | 5.3 | S | CRM + AI research |
| 56 | Next-best-action chip | 5.4 | M | CRM + AI research |
| 57 | AI parallel lead score | 5.5 | M | CRM research |
| 58 | AI booking-form interpreter | 5.6 | S | Original |
| 59 | Journal AI first draft | 5.7 | S | Marketing + AI research |
| 60 | AI mood-board generator | 5.8 | L | Client UX + AI research |
| 61 | Cohort story generator | 5.9 | M | Finance + AI research |
| 62 | AI tax suggestion engine | 5.10 | M | Finance + AI research |
| 63 | Action Cards pattern | 13.1 | M | Original |
| 64 | Studio Hours | 13.2 | S | Original |
| 65 | Client portal timeline | 13.3 | S | Original |
| 66 | Booking-form calendar embed | 13.4 | S | Original + Client UX |
| 67 | Korrin's picks overlay | 13.5 | S | Original |
| 68 | Recurring revenue (subscriptions) | 13.6 | M | Original |
| 69 | Local SEO autopilot | 13.7 | M | Original + Ops |
| 70 | Tax-saving calendar | 13.8 | S | Original + Finance |
| 71 | Quiet season planner | 13.9 | M | Original + Marketing |
| 72 | Gallery analytics for client | 13.10 | S | Original |
| 73 | Cross-vendor wedding-day room | 13.11 | M | Original + Ops |
| 74 | "Off the record" notes | 13.12 | S | Original |
| 75 | Brand voice calibration | 13.13 | S | Original + AI |
| 76 | Investment + Process hybrid page | 13.14 | S | Original + Client UX |
| 77 | First 100 Clients dashboard | 13.15 | S | Original |
| 78 | Far-future-date risk flag | 13.16 | S | Original |
| 79 | Commercial Brand Brief workflow | 13.17 | M | Original |
| 80 | Ad-spend / ROAS tracking | 13.18 | S | Original + Finance |
| 81 | Vendor reciprocity tracking | 13.19 | S | Original + Ops |

---

## Appendix B — Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Phase 1 takes longer than 6 weeks due to Gmail sync complexity | Medium | Medium | Build everything else in parallel; gate Phase 1.5 as optional for "done" |
| Firestore composite index creation friction | High | Low | Document each query in `docs/architecture/firestore-indexes.md`; add to deployment checklist |
| Stripe webhook race conditions during status auto-advance | Medium | Medium | Idempotency keys (already partial); transaction guards in `handleProjectTransition` |
| AI cost overruns when usage scales | Medium | Medium | Token-budget per call + prompt caching + monthly cap; alert at 80% of budget |
| GDPR delete request hits multiple systems (Firestore + R2 + CF Images + email archives + backups) | Low | High | Build the orchestration in Phase 3.10; document the data map; rehearse a dry-run quarterly |
| Korrin manually edits a workflow code while a feature is mid-flight | Medium | Low | Branch protection on main; PR review for any `lib/project-transitions.ts` change |
| The legacy `bookingInquiries` dual-write loses data due to a partial failure | Low | High | Wrap submitBooking in a Firestore batch with retries; alert on inconsistent state |
| Cloudflare Images variant change breaks gallery rendering | Low | Medium | Version-tag the variant names; never delete a variant in active use |
| Firebase Auth UID ↔ `clients` ID mismatch (the §0.2 latent bug) blocks gallery access for new clients | High (until fixed) | High | **Fix in Phase 0.2 before any new client-facing rollout** |
| Schema drift if Phase 2 portal redesign happens without finishing Phase 0 cleanups first | Medium | Medium | Phase order is binding; don't skip Phase 0 |
| Vendor scope creep (e.g. Twilio outage during Phase 1.5 launch) | Medium | Low | Every external dependency wrapped in a circuit-breaker pattern; surface fallback in admin |

---

## Appendix C — Out of scope

Deliberate omissions, with rationale, so future-Korrin doesn't relitigate.

- **Multi-photographer studio.** Single-operator is a feature; doubles down on simplicity.
- **White-label / reseller mode.** This is Korrin's tool, not a SaaS.
- **Real-time collaborative editing.** `router.refresh()` is fine for one operator (ADR-007).
- **Native mobile apps (iOS / Android).** PWA covers 80%; revisit at 500+ active clients.
- **WhatsApp Business.** Add only if a measurable client cohort prefers it.
- **In-person sales (IPS) UI.** Gallery favorites + print store covers the same revenue surface with less friction.
- **Album designer.** Partner with Fundy / Smartalbums via export; don't reinvent the canvas.
- **Lab print fulfillment integration.** Add when print revenue >$1k/mo justifies the engineering.
- **Marketing-automation visual builder.** 8 named recipes >>> a node-canvas for one user.
- **AI image culling / editing.** Use Aftershoot / Imagen as external tools; integrate via export rather than build.
- **Video gallery / 4K casting.** Add when Korrin offers video; not a wedding-photo concern today.
- **Anonymous booking-form heatmap analytics.** Defer until conversion rate is the bottleneck.
- **Stripe Tap-to-Pay on iPhone.** Niche for high-ticket photographers.
- **Open-source extraction of the platform.** Decision deferred — never the reason to build a feature.
- **Adopting an external CRM as the backend.** This document presumes we keep building. If at any point the cost/benefit flips, the migration cost is "export every Firestore collection as CSV and import into HoneyBook" — straightforward, but it would erase the brand-owned data thesis.

---

## Appendix D — References

The research that informed this plan is preserved verbatim in the relevant agent reports (May 2026). Key sources:

### Platform research
- Pixieset, ShootProof, Pic-Time, HoneyBook, Dubsado, 17hats, Iris Works, Studio Ninja, Táve / VSCO Workspace, Sprout Studio — feature lists from each platform's public marketing site.

### Client experience trend research
- Multi-step form CRO: Responsify, VentureHarbour 300% study.
- Pricing transparency: Embrace Presets, ForegroundWeb, Aviso Studios.
- Gallery features: Pixieset 2025 release notes + 15+ hidden features.
- Communications cadence: Pixieset 13 templates, Rangefinder text+email automations.
- Mobile + accessibility: Baymard mobile image gestures, W3C WAI, AllAccessible alt-text 2025.
- Awwwards portfolio 2025 SOTD, Wix 2026 design trends, Creative Boom 2025 photography in design.

### Business operations research
- QuickBooks Self-Employed Schedule C mapping (Intuit).
- Bench, Bastian Accounting, Amy Northard CPA photographer chart of accounts.
- Aftershoot, FilterPixel, Narrative Select for AI culling.
- 3-2-1-1-0 backup rule (Aftershoot, DPReview).
- Photography KPIs: PixelPhant, Financial Models Lab, PPA.
- Tax/compliance: TaxJar, Washington DOR, IRS Form 4562, GDPR Local, The Legal Paige.

### CRM research
- Pipedrive, HubSpot, Attio, Folk, Linear — interaction patterns.
- Missive, Front, Superhuman — shared-inbox patterns.
- Cal.com, SavvyCal — scheduling.
- Outreach, HubSpot Sequences, Pipedrive AI Assistant — sales activity.
- Anthropic / Claude integration patterns (Attio, Folk AI follow-ups).

### Financial dashboard research
- Stripe Reports & Balance API, Stripe Tax, Stripe Sigma.
- ChartMogul / Baremetrics / ChartMogul cohort retention.
- Mercury / Brex real-time cash flow.
- The Knot, French Touch, PPA, BusinessDojo industry benchmarks.
- Drivetrain weighted pipeline, Xero cash flow forecasting.

### Marketing automation research
- Flodesk, ConvertKit, ActiveCampaign, Klaviyo, Customer.io.
- Junebug Weddings, Style Me Pretty submission guidelines.
- ReferralCandy, Tremendous, Extole on referral programs.
- Sara Does SEO 2025 Wedding Pro Survey.
- Schema markup: Over The Top SEO, Koanthic, JestFocus.

### Internal references
- `/Users/hunter/Documents/GitHub/korrinsphotos/CLAUDE.md`
- `/Users/hunter/Documents/GitHub/korrinsphotos/DECISION.md`
- `/Users/hunter/Documents/GitHub/korrinsphotos/PROGRESS.md`
- `/Users/hunter/Documents/GitHub/korrinsphotos/docs/architecture/unified-client-lifecycle.md`
- Per-area CLAUDE.md files under `app/admin/`, `app/api/`, `lib/`, etc.

---

> End of roadmap. Edit this file whenever a feature is shipped, a phase is reordered, or a new constraint emerges. The point is for the next session — whether Korrin or an AI assistant — to walk in cold and know exactly where to start.
