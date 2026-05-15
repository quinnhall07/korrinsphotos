# New-Session Prompt — Execute the UX Improvements

> Open a fresh Claude Code session, `cd` into this repo, ensure the branch is
> `ux-audit-improvements`, then paste the **PROMPT** block below verbatim.
>
> The plan and audit context live in `UX_AUDIT_PLAN.md` at the repo root. Do
> not re-derive the audit — work from that document.

---

## How this is organised

1. **`UX_AUDIT_PLAN.md`** — the full backlog, prioritized. Source of truth.
2. **Eight audit gaps** are listed at the bottom of `UX_AUDIT_PLAN.md` Part 3.
   Re-running them is optional but valuable — the prompts for each are at the
   end of this file.
3. **The implementation prompt** is the centerpiece. Paste it directly.

The prompt is written to be self-contained: it tells a fresh Claude exactly
which files exist, which rules apply (server/client boundary, Server Actions
vs API routes, soft-delete invariants), and how to split the work across
parallel subagents.

---

## PROMPT — paste into a fresh Claude Code session

````
You are picking up a UX-improvement implementation pass on the
korrinsphotos repo, branch `ux-audit-improvements`.

DO NOT re-run audits. The plan is already written in `UX_AUDIT_PLAN.md`
at the repo root. Read that file first — it is the source of truth.

Architecture rules you MUST respect (also in root `CLAUDE.md`):

- Server-only files: `lib/firebase-admin.ts`, anything under `lib/db/`,
  `lib/domain/`, `lib/storage/`, `lib/stripe.ts`, `lib/session.ts`,
  `lib/firebase-email.ts`, `lib/project-transitions.ts`,
  `lib/contract-renderer.ts`. NEVER import these from a `"use client"` file.
- Server Actions live in `actions.ts` co-located with the page; first line
  MUST be `await requireAdmin()` or `await requireSession()`.
- New collections → new file in `lib/db/<collection>.ts`; never aggregate.
- After any Server-Action mutation, `revalidatePath` for EVERY route that
  displays the data (detail + list pages).
- Don't use `lib/cloudflare.ts` — import from `lib/storage/*` directly.
- Use `toast(...)` from `@/components/ui/Toaster` (event-driven, no context).
- The inbox archive is now SOFT (`archivedAt` field) — never call `.delete()`
  on `inboxItems/`. Use `archiveItem` / `unarchiveItem` from `lib/db/inbox.ts`.

State of the branch:

- 9 P0 / privacy edits have already been shipped in the first pass (listed
  in `UX_AUDIT_PLAN.md` Part 1). `npm run build` is green.
- `UX_AUDIT_PLAN.md` Part 2 is the prioritized backlog by area (A through K).
- Suggested execution order is at the end of `UX_AUDIT_PLAN.md` (Sprint 1
  / Sprint 2 / Sprint 3).

Your task:

1. Read `UX_AUDIT_PLAN.md` end to end (it's ~12k tokens; budget for it).
2. Confirm the branch is `ux-audit-improvements` and the build is green.
3. Execute **Sprint 1** in full. Dispatch parallel subagents for items
   that touch disjoint files; serialise items that share a file.

   Sprint 1 items (all P0 from the plan):
   a. Gallery "I'm done picking" finalize CTA + inbox/email notify
      (Section E.P0). Files: `app/gallery/[id]/GalleryViewer.tsx`,
      `app/gallery/[id]/actions.ts`, `lib/db/projects.ts` (new
      `favoritesFinalizedAt` field).
   b. Upload `beforeunload` warning (Section I.P0). Files: `UploadZone.tsx`
      (find it via Grep), `lib/upload.ts`.
   c. Send-gallery-ready CTA on event detail (Section I.P0). Files:
      `app/admin/events/[id]/page.tsx`, the existing `InvitePanel`,
      new server action.
   d. Dashboard rework: Today/Tomorrow shoots card + Needs-Action stack
      (Section H.P0). File: `app/admin/page.tsx`.
   e. "Pending Actions" card on workspace Overview (Section B.P0). File:
      `app/admin/projects/[id]/ProjectWorkspaceClient.tsx` — inject
      AT THE TOP of the Overview tab.
   f. Pipeline filter bar with text search + lead-source + value range
      (Section B.P0). File:
      `app/admin/projects/ProjectsPipelineClientPage.tsx`.
   g. Event → Project linkage header link (Section I.P0). File:
      `app/admin/events/[id]/page.tsx`.
   h. `/admin/settings` hub page (Section J.P0). New file:
      `app/admin/settings/page.tsx` — 2-column tile grid grouped by
      Automations / Voice / Business linking to existing leaf pages.
   i. Mobile admin shell: hamburger drawer for `AdminSidebar` + a
      header search affordance that opens the Cmd-K palette
      (Sections C.P1 + K.P0). Files: `app/admin/layout.tsx`,
      `components/admin/AdminSidebar.tsx`,
      `components/ui/CommandPaletteProvider.tsx`.

   Dispatching guidance: items (a), (b), (c), (d), (g), (h) are
   file-disjoint and can run in parallel. (e) and (f) both touch
   workspace/pipeline files — keep them sequential or in the same agent.
   (i) touches the layout + sidebar — give it its own agent.

4. After Sprint 1 completes:
   - `npm run build` MUST be green.
   - `npm run lint` MUST not introduce new errors.
   - Write a short addendum to `UX_AUDIT_PLAN.md` under a new
     "## Sprint 1 — Shipped" section: what landed, what changed, and
     any deviations from the plan.

5. If time permits, continue into Sprint 2 (P1 high-leverage items).
   Same parallel/serial guidance applies — keep each subagent
   file-scoped.

6. Commit + push frequently — at minimum one commit per Sprint
   boundary. Conventional commit subjects, e.g.:
   `ux: ship Sprint 1 P0 fixes (gallery finalize, upload warning, ...)`

Self-imposed checks before declaring Sprint 1 done:

- [ ] `npm run build` exit 0.
- [ ] No new files under `lib/db/` that violate the no-aggregator rule.
- [ ] No `"use client"` file imports `lib/firebase-admin`, `lib/db/*`,
      `lib/domain/*`, `lib/storage/*`, `lib/stripe`, `lib/session`,
      `lib/firebase-email`, `lib/project-transitions`, or
      `lib/contract-renderer`.
- [ ] Every new Server Action's first line is `requireAdmin()` or
      `requireSession()`.
- [ ] Every Server Action that mutates calls `revalidatePath` for ALL
      affected routes (detail + list).
- [ ] Mobile drawer dismisses on overlay tap and on route change.

Do NOT consult the user during execution. They have asked for autonomous
implementation. Commit and push the branch when Sprint 1 is done. If
anything is blocked (missing env var, unclear schema), make the smallest
defensible decision, log it in the Sprint 1 addendum, and keep moving.
````

---

## Optional — re-run the 8 audit gaps first

If you want a fuller picture before implementing, dispatch the prompts below
as parallel agents. They were rate-limited on the original pass. Each prompt
is self-contained.

### Gap 1 — Public marketing pages

```
Read-only UX audit of the public marketing surface at
C:\Users\danie\Documents\GitHub\korrinsphotos.

Scope: app/page.tsx (home), app/portfolio/**, app/investment/**,
app/journal/**, app/locations/**, app/shop/**, app/magnet/[slug]/**,
app/style/**, components/Navbar.tsx, Footer.tsx.

Concrete questions:
1. Navbar entries — too many or too few? What's missing for a first-time
   visitor (testimonials, FAQ, About-Korrin, pricing, reviews)?
2. Home page — what's the first call-to-action? Is "book" 1 click away?
3. Portfolio — is category filtering obvious? Does clicking a photo offer
   a path to "book a shoot like this"?
4. Investment — three packages, but is there clarity on custom quotes?
5. Journal — can you browse by location / session type / season?
6. Locations — do they cross-link to journal posts from that city?
7. Shop — findable from marketing or orphaned?
8. Style quiz `/style` — orphaned vs integrated into the booking funnel?
9. Footer — does it expose Journal / Locations / Shop / Magnets / FAQ?
10. Is there an `/about` or `/faq` page?

Output: numbered findings, SEV (P0/P1/P2), file:line, one-line rec.
Cap 350 words. Read only.
```

### Gap 2 — Empty / loading / error states

```
Read-only UX audit of empty states, loading skeletons, and error states
across C:\Users\danie\Documents\GitHub\korrinsphotos.

Scope: scan all `app/**/page.tsx`, `app/**/loading.tsx`,
`app/**/not-found.tsx`, `app/**/error.tsx`, and major list/grid
components.

Concrete questions:
1. List pages (inbox, projects, events, vendors, locations, broadcasts,
   segments) — when empty, do they teach the admin what to do next?
2. Loading skeletons — present on heavy list pages? Match eventual layout?
3. Error boundaries — global error.tsx? Per-route? Helpful copy?
4. Form errors — server-action `{ error: "..." }` returns — surfaced via
   toast or inline? file:line.
5. 404 → not-found.tsx — on-brand? Offers search/back?
6. Upload errors — clear retry path when an upload fails partway?

Output: numbered findings, SEV, file:line, one-line rec. Cap 350 words.
Read only.
```

### Gap 3 — Mobile / responsive UX

```
Read-only audit of mobile responsiveness across the site at
C:\Users\danie\Documents\GitHub\korrinsphotos.

Scope: public pages (app/page.tsx, app/portfolio, app/investment,
app/booking, app/gallery, app/portal, app/journal, app/locations,
app/shop), admin pages (app/admin/**), app/globals.css, Navbar.tsx,
AdminSidebar.tsx, Lightbox.tsx, MasonryGrid.tsx, UploadZone.

Concrete questions:
1. Where are responsive breakpoints applied vs missing? Which pages look
   desktop-first only?
2. AdminSidebar on mobile — hamburger toggle? If not, P0.
3. Tap targets — buttons under 44×44px?
4. Tables on mobile — horizontal scroll, stack, or hide columns?
5. Modals — fit on 375px viewport?
6. Forms — booking wizard works on mobile?
7. Drag-and-drop — timeline reorder, gallery editor — touch-capable?
8. PWA install — does the mobile install prompt actually trigger?

Output: numbered findings, SEV, file:line, one-line rec. Cap 350 words.
Read only.
```

### Gap 4 — Notifications + engagement

```
Read-only audit of notifications, toasts, and engagement signals at
C:\Users\danie\Documents\GitHub\korrinsphotos.

Scope: components/ui/Toaster.tsx, lib/email/tracking.ts,
app/api/t/o/**, /t/c/**, emailEvents usage in lib/db/email-events.ts,
NPS widget in gallery, inbox notification flow.

Concrete questions:
1. Toast persistence — history of toasts the admin can review?
2. Browser push notifications — PWA registered? Useful for CLIENT_MESSAGE?
3. Email open/click — surfaced only on MessagesTab? Could a per-client
   engagement view roll up?
4. NPS — does the result email a summary? Low NPS trigger inbox item?
5. Stripe events — dispute/refund surfaced via inbox AND email?
6. Bounce / unsubscribe — where does admin see them?
7. Client side — notification when Korrin replies via portal Contact?
8. Daily digest — does one exist? Propose if not.

Output: numbered findings, SEV, file:line, one-line rec. Cap 350 words.
Read only.
```

### Gap 5 — Reports consolidation

```
Read-only UX audit of admin reports surfaces at
C:\Users\danie\Documents\GitHub\korrinsphotos.

Scope: every `app/admin/reports/**` route plus `app/admin/exports/`,
`app/admin/health/`. Reports inventory: /finance, /tax, /sales-tax,
/compliance, /ad-spend, /referrals, /first-100, /quiet-season.

Concrete questions:
1. Could finance + tax + sales-tax + ad-spend live under one tabbed
   `/admin/reports/finance` page?
2. Could compliance + quiet-season + first-100 + referrals live under
   one tabbed `/admin/reports/operations` page?
3. Each report — data fresh enough to trust? Where is the "as of"
   timestamp?
4. CSV export — every report should have an export button.
5. Cross-link — from a /finance KPI tile, can the admin drill to the
   underlying invoices?
6. /admin/exports — is it the center for all CSV exports?
7. /admin/health — tells Korrin what to DO when red, or just that it's red?
8. Date-range picker shared across reports?

Output: numbered findings, SEV, file:line, one-line rec. Cap 350 words.
Read only.
```

### Gap 6 — Data tracking gaps

```
Read-only audit of data tracking and conversion funnel at
C:\Users\danie\Documents\GitHub\korrinsphotos.

Scope: middleware.ts (__origin + __campaign), app/booking/actions.ts
(firstTouch fields), lib/db/clients.ts, lib/domain/analytics.ts,
roas.ts, quiet-season.ts, referral-graph.ts, emailEvents tracking,
photo view/download tracking.

Concrete questions:
1. Single funnel view — visit → booking step 1 → submit → BOOKED?
2. Page-view tracking beyond submit — /style starts/completions, /shop?
3. Lead-magnet downloads — tied to client + campaign?
4. Style quiz completion tagged as soft-conversion?
5. Inbox CLIENT_MESSAGE — response time tracked? Reported?
6. Photo view/download — per-gallery rollup beyond /admin/events/[id]/analytics?
7. Bouncing email recipients — aggregate tracking?
8. UTM attribution — when __campaign overrides __origin, do we LOSE the
   landing URL?

Output: numbered findings, SEV, file:line, one-line rec. Cap 350 words.
Read only.
```

### Gap 7 — Style / voice / notes integration

```
Read-only audit of how Wave-9 surfaces integrate at
C:\Users\danie\Documents\GitHub\korrinsphotos.

Scope: app/style/** (public style quiz), lib/db/style-profiles.ts,
StyleProfileCard on /admin/projects/[id], app/admin/settings/brand-voice/**,
VoiceAnchorsCard in /admin/inbox detail pane, offTheRecordNotes on
ProjectDoc, NotesTab in ProjectWorkspaceClient.

Concrete questions:
1. Style quiz — every public CTA entry point (footer, booking confirmation,
   auto-responder, etc.)?
2. When a style profile exists for a client, is StyleProfileCard visible
   above workspace? "Request style profile" button when missing?
3. Brand voice samples — used anywhere besides inbox VoiceAnchorsCard?
   Workspace reply composer? Broadcast composer?
4. Off-the-record notes — confirm: never in CSV exports, never read by
   welcome-packet, shoot-brief, journal-drafter, contract-renderer, AI.
5. Cross-link from brand-voice settings to "compose a test reply"?
6. Should the style quiz thank-you invite a booking inquiry?

Output: numbered findings, SEV, file:line, one-line rec. Cap 350 words.
Read only.
```

### Gap 8 — Shop + lead magnets flow

```
Read-only audit of digital store and lead magnet flows at
C:\Users\danie\Documents\GitHub\korrinsphotos.

Scope: app/shop/** + app/shop/[slug]/** + app/shop/thank-you/**,
app/magnet/[slug]/**, app/admin/shop/**, app/admin/lead-magnets/**,
lib/db/products.ts, lead-magnets.ts, lead-magnet-downloads.ts,
lib/stripe.ts, app/api/webhooks/stripe/**.

Concrete questions:
1. Shop visibility — in Navbar or only Footer?
2. Product detail page — cross-sell other products?
3. Thank-you page — buyer can download immediately or must wait for email?
4. 7-day presigned URL — what if buyer loses the email? Resend form?
5. Buyer account creation — creates a clients doc and links?
6. Lead magnets — /magnet/[slug] integrated into nav or campaign-URL only?
7. Magnet → sequence enrollment — default or opt-in per magnet?
8. Admin shop — "test purchase" button when publishing?
9. Refund flow for products?

Output: numbered findings, SEV, file:line, one-line rec. Cap 350 words.
Read only.
```
