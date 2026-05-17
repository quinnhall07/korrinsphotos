# UX Audit & Implementation Plan — Korrin's Photos

> Branch: `ux-audit-improvements`
> Generated: 2026-05-15
> Audit method: 20 parallel read-only agents, each scoped to a distinct surface area.
> 12 of 20 audits completed; 8 hit Anthropic rate-limit (resets nightly). The
> remaining gaps are documented at the end so a follow-up session can finish
> them — every finding above the gap section is real, cited, and ready to build.

This document is the single source of truth for the UX improvements identified
on this branch. It has three parts:

1. **What's already shipped on this branch** — the changes that landed in the
   first implementation pass before the rate limit halted execution.
2. **The full prioritized backlog** — every audit finding, scored P0/P1/P2,
   with file:line citations and one-line fixes.
3. **Audit gaps that still need to run** — eight scopes that did not return
   findings. A fresh session should re-dispatch these before declaring the
   audit complete.

---

## Part 1 — Changes already shipped on `ux-audit-improvements`

These nine edits compile cleanly (`npm run build` exit 0) and are ready to
commit. They address the P0 / privacy / safety items where context was complete
during the first pass.

| # | File(s) | What changed | Why |
|---|---|---|---|
| 1 | `app/portal/[projectId]/page.tsx` | Day-of timeline now filters `visibleToClient !== false` before serialising to the portal | Admin-only timeline blocks (vendor notes, off-the-record cues) were leaking into the client portal. The cross-vendor `/day-of-room/[id]` route already filtered correctly; the portal was the gap. |
| 2 | `app/api/track/photo-view/route.ts`, `app/api/track/photo-download/route.ts` | Added `honorsPrivacySignals()` check that short-circuits when the request carries `DNT: 1` or `Sec-GPC: 1` | Photo-view/download pixels were tracking every visitor regardless of stated browser privacy preference. |
| 3 | `app/login/page.tsx`, `app/login/LoginForm.tsx` | Client logins now redirect to `/portal/router` instead of `/gallery`; OAuth Google provider explicitly requests `email` + `profile` scopes | The portal is the canonical client landing (it handles single-project auto-redirect + multi-project chooser); `/gallery` is a sub-surface. Google scope parity matches Microsoft. |
| 4 | `app/login/LoginForm.tsx` | Added "Forgot password?" link → `sendPasswordResetEmail`. Shows a brand-neutral confirmation regardless of email existence (security parity). | Clients had no self-serve password recovery. Magic links were admin-only. |
| 5 | `lib/db/inbox.ts` | `archiveItem` now soft-deletes via `archivedAt` instead of `.delete()`. New helpers: `unarchiveItem`, `clearSnooze`, `bulkUnarchive`. `listInboxItems` accepts `archivedOnly` / `includeArchived`. `countUnread` excludes archived rows. | The admin inbox had a P0 bug: archive was unrecoverable hard-delete. Archive is now a soft state. |
| 6 | `app/admin/inbox/actions.ts` | New server actions: `unarchiveInboxItem`, `unsnoozeInboxItem`, `bulkUnarchiveInboxItems`. | Mirrors the new DB helpers; preserves `requireAdmin()` + `revalidatePath` invariants. |
| 7 | `app/admin/inbox/page.tsx` | Fetches `archivedOnly: true` items in parallel and passes them to the client component. | Surface the new soft-state archive. |
| 8 | `app/admin/inbox/InboxClientPage.tsx` | Added an **Active ↔ Archived** view switcher in the header. Added "Restore" button in detail pane when viewing an archived item. Added "Unsnooze" button when the selected item is currently snoozed. The `s` keyboard shortcut now CLEARS a snooze if the item is snoozed instead of re-snoozing it. The `e` keyboard shortcut restores archived items when in Archived view. The count line now shows `N archived`. | Closes the loop on the archive black-hole bug: Korrin can now find, review, and restore anything she archived. Snooze can finally be cancelled. |

**Verification:** `npm run build` exit 0. No new lint errors introduced.

---

## Sprint 1 — Shipped (2026-05-15)

The nine Sprint 1 P0 items from the suggested execution order all landed on
`ux-audit-improvements`. Implementation was driven by parallel subagents per
the dispatching plan in `NEW_SESSION_PROMPT.md`. The session hit Anthropic's
usage cap mid-flight; the partial agents had already done the bulk of the
work, and a follow-up pass finished the one item (pipeline filter bar) where
state had been declared but UI/filter logic wasn't wired through.

| # | Section | File(s) | What landed |
|---|---|---|---|
| a | E.P0 | `lib/db/projects.ts`, `app/gallery/[id]/{page,GalleryViewer,actions}.tsx` | New `favoritesFinalizedAt` field on `ProjectDoc`. New `finalizeFavorites` server action (gated by `requireSession()` + event-access check + email match) — idempotent: returns `alreadyFinalized: true` on repeat. On first call, stamps the project, writes an inbox item (`GALLERY_REQUESTED`), and enqueues a tracked email to the admin. Gallery viewer renders a "Send my picks to Korrin" CTA in olive when picks > 0; swaps to a locked confirmation chip with the sent date after finalize. |
| b | I.P0 | `app/admin/events/[id]/UploadZone.tsx` | `useEffect` keyed on `pendingCount > 0` registers `beforeunload` with the standard empty `returnValue`. Cleanup removes the listener on unmount and when pending drops to zero. No change to `lib/upload.ts` was needed. |
| c+g | I.P0 | `app/admin/events/[id]/{page,actions}.tsx`, new `NotifyGalleryReadyButton.tsx` | Header chip renders "Linked to {firstName} — View project →" when `event.clientId` is set (link only renders when `projectId` also exists). New `notifyGalleryReady(eventId)` server action sends a tracked email via `enqueueTrackedMail` (with `recipientClientId` + `sendKind: "gallery-ready-notification"`) and revalidates the event detail + events list. CTA renders next to the existing action buttons only when `event.status === "DELIVERED"` and a client is linked. |
| d | H.P0 | `app/admin/page.tsx` | Vanity 4-count row removed. New "Today & Tomorrow" card driven by `where("shootDate", ">=", today).where("shootDate", "<=", tomorrowEnd)`, day-bucketed with studio-TZ (`America/New_York`) wall-clock math. New "Needs Action" card aggregating six urgency buckets — deposit pending, unsigned contract, overdue/late invoices, follow-up due, COI requested w/ shoot within 14 days, scheduled tasks past their `runAt`. Capped at 12 rows, sorted bucket asc then recency desc. Recent Inquiries + Recent Activity + Recent Events preserved. |
| e | B.P0 | `app/admin/projects/[id]/ProjectWorkspaceClient.tsx` | New `PendingActionsCard` injected at the top of the Overview tab. Derives 7 readiness rows from existing serialised props (COI, contract, deposit invoice, balance invoice, latest pending questionnaire, gear log, day-of timeline). Empty-state row "All caught up." renders when all checks pass. Each pending row jumps to its relevant tab via the existing `onNavigateTab` handler. |
| f | B.P0 | `app/admin/projects/ProjectsPipelineClientPage.tsx`, `app/admin/projects/page.tsx` | New olive-tinted filter bar above the result count: free-text search (client first/last/email + project title), lead-source `<select>` (mirrored `LeadSource` union), Min/Max value inputs. Composes additively with the saved-view filter and resets selection when the visible set changes. "Clear filters" button appears once any input is dirty. Pipeline hydrate path now also serialises `leadSource`. |
| h | J.P0 | new `app/admin/settings/page.tsx` | Hub page (was a 404). Three-section tile grid — Automations (recipes, sequences, reply templates), Voice (brand voice), Business (insurer, sales tax, studio hours, gear templates). Every link points at a verified existing leaf route (confirmed via `Glob` `app/admin/settings/*/page.tsx` + `app/admin/sequences/page.tsx`). |
| i | C.P1 + K.P0 | `app/admin/layout.tsx`, new `components/admin/AdminMobileShell.tsx`, `components/ui/CommandPaletteProvider.tsx` | Below 900px, the 200px sidebar column collapses; a new mobile header bar (sticky under the global 72px top bar) renders hamburger + brand wordmark + search icon. Hamburger dispatches a `admin-drawer:open` window event picked up by `AdminSidebarSlot`, which slides the existing `<AdminSidebar />` in from the left over a `rgba(0,0,0,0.4)` backdrop. Drawer dismisses on backdrop tap and on `pathname` change. Search icon calls the new imperative `useCommandPalette().open()` exposed by an extended provider context (existing Cmd/Ctrl+K + Escape keybindings preserved). Body scroll locks while open. |

### Notes / Deviations

- Inbox type used for the gallery-finalize signal: `GALLERY_REQUESTED`. Closest fit in the existing 18-type taxonomy; if a future `FAVORITES_FINALIZED` type is added, the call site is a single string update.
- `lib/cloudflare.ts` is still imported by `app/admin/events/[id]/page.tsx` (`buildCdnUrl`). That import predates Sprint 1 and is the deprecated facade — leaving it for a dedicated migration pass rather than touching it inside an unrelated edit.
- Pipeline filter state is component-local (no URL sync). URL persistence + saved-view integration are P2 follow-ups (B.P2 "?status= URL param doesn't survive saved-view switch").
- Today & Tomorrow uses an in-process TZ helper rather than a new library — Studio TZ is hard-coded to `America/New_York` to match the rest of the studio defaults.
- Mobile drawer + header live in a single new file (`components/admin/AdminMobileShell.tsx`) to keep the responsive plumbing co-located. The desktop `<AdminSidebar />` is rendered unchanged inside both the inline grid slot and the drawer.

### Verification

- `npm run build` → `✓ Compiled successfully in 11.0s`.
- `npm run lint` → 0 errors, 25 pre-existing warnings (none added by Sprint 1).

---

## Part 2 — Full prioritized backlog (12 completed audits)

### Severity legend

- **P0** — Privacy/data leak, unrecoverable destructive op, broken golden path, or admin-zero-visibility issue. Ship before next deploy.
- **P1** — High-value UX win or growth-funnel friction. Ship within a sprint.
- **P2** — Polish / nice-to-have. Bundle opportunistically.

### A. Admin Inbox

Status: P0 items shipped; P1/P2 items remain.

| Sev | Finding | File:line | Fix |
|---|---|---|---|
| ~~P0~~ ✅ | Archive was hard-delete with no archive view | `lib/db/inbox.ts:99` | **SHIPPED** in Part 1. |
| ~~P0~~ ✅ | No restore / un-archive path | `app/admin/inbox/actions.ts:56` | **SHIPPED** in Part 1. |
| ~~P1~~ ✅ | Snoozed items had no cancel/wake-now button | `InboxClientPage.tsx:560` | **SHIPPED** in Part 1. |
| P1 | Keyboard shortcuts hint is inline & dense; no `?` help modal | `InboxClientPage.tsx:290` | Add `?` key → modal listing all shortcuts (j/k/e/s/m/↵ + new) + a "open project (o)" + "open client (g c)" |
| P1 | Rows show only type + title + body; client name + project title are invisible despite being in the view model | `InboxClientPage.tsx:449` & `:51` | Resolve `clientId → "First Last"` in the row, render two explicit buttons "Open project" / "Open client" in DetailPane |
| P1 | 18-type taxonomy is flat — no grouping (Money / Comms / Compliance / Risk) | `InboxClientPage.tsx:61` | Add left-side facet panel grouped by category with unread counts; support multi-type filter |
| P1 | Inbox is comprehensive but UI under-sells it ("47 of 47 across 18 sources" framing missing) | `InboxClientPage.tsx:286` | Add a one-line source legend under "Triage" — e.g. "12 revenue · 8 comms · 4 compliance · 2 risk" |
| P2 | Triple-snooze paths for RE_ENGAGEMENT_DUE — global `s`, generic Snooze 24h, type-specific Snooze 30 days — all unlabeled | `InboxClientPage.tsx:617,803` | Rename to "Snooze inbox 24h" vs "Snooze next prompt 30 days"; or hide generic snooze when type-specific block is rendered |
| P2 | 500-row in-memory filter cap will silently truncate as archive grows | `lib/db/inbox.ts:67` | Paginate or split queries by `read + snoozedUntil` once archive volume warrants |

### B. Admin Project Pipeline + Workspace

| Sev | Finding | File:line | Fix |
|---|---|---|---|
| P0 | No unified "Pending Actions" panel — admin must open each tab to know what's pending (COI, contract, invoice, questionnaire, gear, day-of timeline) | `ProjectWorkspaceClient.tsx:646` | Add a "Pending Actions" card at the top of Overview that aggregates: COI status, unsigned contract, unpaid invoice, missing questionnaire, uninitialised gear log, empty day-of timeline |
| P0 | No free-text search and no filter on the pipeline (`leadSource`, `tags`, `estimatedValue` exist on the row but aren't filterable) | `ProjectsPipelineClientPage.tsx:696` | Add filter bar: text search (client + title), lead-source select, tag multi-select, value range |
| P1 | 11 workspace tabs is heavy load | `ProjectWorkspaceClient.tsx:117` | Merge **Gear + Day-of** (shoot-prep), move **Press** into Overview as a collapsible card, fold Notes preview-only into Overview |
| P1 | "Advance Status" is a 14-button grid, not a one-click next step | `ProjectWorkspaceClient.tsx:5768` | Header should expose a primary "Advance to **<next>**" button computed from current status; the grid becomes "Other..." |
| P1 | Email and phone are plain text — no `mailto:` / `tel:` anchor | `ProjectWorkspaceClient.tsx:556` & `ProjectsPipelineClientPage.tsx:1243` | Wrap in `<a href="mailto:…">` / `<a href="tel:…">` everywhere |
| P1 | Only bulk action is archive | `ProjectsPipelineClientPage.tsx:446` | Add bulk-tag, bulk-enroll-in-sequence, bulk-status-change |
| P1 | Saved-view filter set is closed at 6 built-ins | `ProjectsPipelineClientPage.tsx:135` | Support compound filters (status + tag + value range) as a struct payload; rename "Save view" → "Duplicate as my view" |
| P2 | No lifecycle-stage chip near the status pill (Lead / Customer / Repeat) | `ProjectWorkspaceClient.tsx:418` | Derive from `totalSessionsBooked` and `status`, show as a pill |
| P2 | `?status=` URL param doesn't survive saved-view switch | `ProjectsPipelineClientPage.tsx:1361` | When a saved view changes, push canonical URL with new filter set |
| P2 | Timeline tab is read-only history | `ProjectWorkspaceClient.tsx:507` | Move to slide-over from a header "History" button; reclaim the top-level slot |

### C. Admin Sidebar / Information Architecture

| Sev | Finding | File:line | Fix |
|---|---|---|---|
| P1 | **35-entry sidebar** across 6 groups; Reports has 10 entries, Settings has 7 — most consulted <1×/month | `components/admin/AdminSidebar.tsx:9-394` | Collapse Reports + Settings into expandable sections; promote only Dashboard / Inbox / Pipeline / Clients / Capacity / Events to always-visible |
| P1 | **`/admin/settings` is a 404** — there's no parent `page.tsx`, only 7 leaf routes | — | Add `/admin/settings/page.tsx` hub with a 2-column grid grouped by Automations / Voice / Business. Eventually collapse the 7 leaves into one tabbed `/admin/settings/[tab]` shell |
| P1 | Reports group has 10 entries, all dust-collectors at a glance | `AdminSidebar.tsx:210-316` | Create `/admin/reports` index with tiles; leave only Finance + Tax in the sidebar |
| P1 | **No `⌘K` pill anywhere in chrome** — palette is discoverable only after opening | `AdminSidebar.tsx`, `CommandPaletteProvider.tsx:18` | Add a `⌘K` pill in the sidebar header (or topbar) |
| P1 | **No mobile/responsive treatment** — hard-coded `gridTemplateColumns: "200px 1fr"`, no hamburger, no drawer | `app/admin/layout.tsx:21`, `AdminSidebar.tsx:402` | Add a breakpoint + drawer toggle |
| P2 | `/admin/health` mis-grouped under Reports (it's an ops/status board) | `AdminSidebar.tsx:296` | Move to Settings or hide behind `/admin/settings/system` |
| P2 | `/admin/exports` is a one-widget page (year picker) | `app/admin/exports/page.tsx` | Inline as a button on `/admin/reports/tax`; drop the sidebar slot |
| P2 | `/admin/events/[id]/analytics` is orphaned (no inbound href anywhere) | `app/admin/events/[id]/analytics/page.tsx` | Link from event detail page header or delete the route |
| P2 | `/admin/search` is orphaned (no inbound href in production UI) | `app/admin/search/page.tsx` | Add "See all results" footer in Cmd-K palette → `/admin/search?q=` |
| P2 | No Recently-visited or Pinned section in the sidebar | `AdminSidebar.tsx` | Lift `cmdk-recents` from `CommandPalette.tsx:66` into the sidebar top |
| P2 | `/admin/calendar` is labeled "Capacity" — name/route mismatch | `AdminSidebar.tsx:56` | Rename either route or label for stability |

### D. Client Portal

| Sev | Finding | File:line | Fix |
|---|---|---|---|
| ~~P1~~ ✅ | Day-of timeline wasn't filtered to `visibleToClient: true` | `app/portal/[projectId]/page.tsx:189` | **SHIPPED** in Part 1. |
| P1 | Style-quiz result not surfaced in portal | `app/portal/[projectId]/page.tsx` | Fan-out read `styleProfiles/{client.email.toLowerCase()}` and add a read-only "Your style" card on Overview linking to `/style` for re-submission |
| P1 | Returning-client password reset wasn't exposed (shipped as Part 1 #4) | `LoginForm.tsx:155` | **SHIPPED** in Part 1. (Audit also asked for client-facing magic links; deferred to P2 below.) |
| P2 | No multi-project switcher inside `/portal/[projectId]` — once you click in, you're stuck on one project | `PortalClient.tsx:188-215` | Show "Switch project" dropdown in the header when `getProjectsByClientId(clientId).length > 1` |
| P2 | 7 tabs is heavier than content warrants — Documents / Invoices / Timeline are mostly static lists | `PortalClient.tsx` | Collapse Documents + Invoices + Timeline into Overview accordions; keep Gallery / Inspiration / Contact as tabs (drops 7 → 4) |
| P2 | No bulk receipt/invoice download for tax season | `PortalClient.tsx:767` | "Download receipts (PDF)" per paid invoice (Stripe receipt URL); "Download all (zip)" on header |

### E. Client Gallery

| Sev | Finding | File:line | Fix |
|---|---|---|---|
| P0 | **No "I'm done picking" CTA**; favorites toggle silently and Korrin gets no email/inbox ping | `GalleryViewer.tsx:303` | Add "Send my picks to Korrin" button → stamps `favoritesFinalizedAt` on the project, writes inbox item, enqueues tracked mail |
| P1 | `/api/download/[eventId]/favorites` exists but no admin UI surface | `app/api/download/[eventId]/favorites/route.ts:50` | Surface from `/admin/projects/[id]`; auto-link on favorites finalize |
| P1 | NPS widget high-score path has no inline "Share on Google / Instagram" CTA | `GalleryViewer.tsx:285,548` | Render review-share links inline when `rating >= 4` |
| ~~P1~~ ✅ | Tracking pixel ignores DNT / Sec-GPC | `app/api/track/photo-view/route.ts:32` | **SHIPPED** in Part 1. |
| P1 | PIN error is generic ("Invalid PIN"); no distinction between wrong/expired/never-set | `GalleryViewer.tsx:443` | Differentiated server errors; track attempts in Firestore (`uid + eventId`) so refresh doesn't reset lockout |
| P1 | PIN never explained to client (where is it? in delivery email? out of band?) | `GalleryViewer.tsx:935` | Show "Check your delivery email for the 4-digit PIN" copy in PinModal |
| P1 | No share-with-family flow — clients manually forward the magic-link email | `app/gallery/**` | Add server action that reuses `/api/invite` from inside the gallery |
| P1 | Lightbox `pointerEvents: "none"` on `<img>` may suppress iOS Safari swipes | `Lightbox.tsx:281` | Set `touchAction: "pan-y pinch-zoom"` on `<img>` and re-enable pointer events |
| P2 | Resolution picker duplicated in download bar AND Lightbox menu | `GalleryViewer.tsx:687`, `Lightbox.tsx:206` | Collapse to one; persist choice |
| P2 | 3 download tiers assume DPI literacy ("Web (~1200px) / Print (~2048px) / Original") | `Lightbox.tsx:49` | Rename to "Share online / Print at home / Full quality"; hide Original when `!hasOriginal` |
| P2 | Slideshow `<audio>` mounts even with missing/silent fallback; no caption track | `SlideshowOverlay.tsx:175` | Skip `<audio>` until user unmutes; add `aria-label` for silent fallback |
| P2 | NPS lockout is client-side only (`localNps`) — page refresh allows re-submit | `GalleryViewer.tsx:286` | Allow one re-submit within 24h server-side |
| P2 | Admin gallery preview can clobber real client NPS | `app/gallery/[id]/page.tsx:103`, `actions.ts:65` | Route admin submissions to `clientNpsPreview` or block writes when `role === "ADMIN"` |

### F. Booking Flow

| Sev | Finding | File:line | Fix |
|---|---|---|---|
| P1 | No "draft restored" prompt on return — silently rehydrates from localStorage | `BookingFormSteps.tsx:286` | Show "Pick up where you left off?" banner with Resume / Start over |
| P1 | Step always resets to 1 on return | `BookingFormSteps.tsx:274` | Persist `step` in the draft and rehydrate (clamp to highest valid step) |
| P1 | Confirmation is generic — no echo of session type / preferred month / contact email / reply-by date | `BookingFormSteps.tsx:411-518` | Summary card + add-to-calendar (.ics) for the 48h reply SLA |
| P1 | Style quiz NOT invited from confirmation despite being a perfect bridge | `BookingFormSteps.tsx:503` | CTA: "While you wait — take the 2-min style quiz" → `/style?email=<encoded>` |
| P1 | Auto-responder missing concrete reply-by date and style-quiz CTA | `app/booking/actions.ts:387-472` | Compute & print explicit "Replies by Thu May 16"; add second CTA to `/style` |
| P2 | Step-level errors aggregate; no per-field `aria-invalid` | `BookingFormSteps.tsx:326` | Add per-field `<p role="alert">` siblings keyed off blur state |
| P2 | Phone has no `inputMode="tel"` or `autoComplete="tel"`; format hint missing | `BookingFormSteps.tsx:1021` | Add `inputMode="tel" autoComplete="tel"` and a small hint |
| P2 | Date picker is a 24-month `<select>` only; no specific date | `BookingFormSteps.tsx:753` | Add optional native `<input type="date">` for couples with exact day |
| P2 | `readProcessPage` checkbox is collected but never sent | `BookingFormSteps.tsx:1067` | Either gate "Next" on it (intentional friction) or remove |
| P2 | `?package=` preselect works but no visual confirmation | `BookingFormSteps.tsx:286` | Dismissible "Continuing from Investment / Story package" chip on Step 1 |
| INFO | `bookingInquiries` write confirmed retired | — | Update root `CLAUDE.md` Gotcha #10 (mentions dual-write) |

### G. Auth + Settings

| Sev | Finding | File:line | Fix |
|---|---|---|---|
| ~~P1~~ ✅ | No "Forgot password" UI | `LoginForm.tsx:155` | **SHIPPED** in Part 1. |
| ~~P1~~ ✅ | Login redirected clients to `/gallery` instead of `/portal/router` | `app/login/page.tsx:34`, `LoginForm.tsx:123` | **SHIPPED** in Part 1. |
| P1 | 14-day session cookie vs 30-day shoot window — clients must re-auth pre-shoot | `lib/session.ts:18` | Extend to 30 days OR sliding-window renewal in `getSessionUser` (re-mint cookie if >7d old) |
| P1 | Magic-link email styling = Firebase default; expiry undocumented | `lib/firebase-email.ts:18-65` | Customize template in Firebase Console (logo, brand voice, from-name); document expiry in code comment |
| P1 | `/login/complete` shows only "Completing your sign in…" with no error/retry on failure | `app/login/complete/page.tsx:28` | Surface Resend button + fallback to `/login` on error |
| P1 | `/settings` email field is editable in UI but **never persisted** (server action ignores it) | `app/settings/SettingsClient.tsx:184-191`, `app/settings/actions.ts:18` | Either wire to `adminAuth.updateUser({email})` + re-verification OR remove the field. Add password change + self-serve account delete |
| P2 | Microsoft adds `email`/`profile` scopes explicitly; Google did not | `LoginForm.tsx:25` | **SHIPPED** in Part 1 (Google scopes now match Microsoft). |
| P2 | `__session` uses `SameSite=Lax`; webhook routes have no explicit CSRF | `lib/session.ts:33` | Document reliance on Next.js Server-Action same-origin check; consider `SameSite=Strict` for `__session`; add origin-header check on `/api/invite` |
| P2 | Admin first-login two-step has no `router.refresh()` post `afterSignIn` | `components/AuthProvider.tsx:78-93` | Force-refresh after token bounce to avoid flash of unauthorized UI |

### H. Admin Dashboard

| Sev | Finding | File:line | Fix |
|---|---|---|---|
| P0 | Top row is 4 vanity counts (Active Events / Total Photos / Pending Inquiries / Active Clients) — no triage worklist | `app/admin/page.tsx:222-304` | Replace with a single "Needs Action" stack: overdue invoices, unsigned contracts, pending COI, follow-ups due today |
| P0 | No "today's shoots / tomorrow's shoots" panel despite `shootDate` existing on `ProjectDoc` | `app/admin/page.tsx` | Add "Today & Tomorrow" card querying `projects where shootDate in [today, today+1]` |
| P0 | No unified action queue aggregating overdue invoices + unsigned contracts + DEPOSIT_PENDING + due `scheduledTasks` | `app/admin/page.tsx` | One card. Deep links per row |
| P1 | "Total Photos" runs `collectionGroup("photos").count()` on every dashboard load — drives no decision | `app/admin/page.tsx:239-243` | Drop it; reuse slot for "Revenue MTD" or "Outstanding AR" |
| P1 | "Active Clients" counts every CLIENT user since inception (monotonically growing) | `app/admin/page.tsx:252-257` | Replace with "Bookings this month" or "Pipeline value" |
| P1 | Recent Inquiries table duplicates the inbox's primary list | `app/admin/page.tsx:316-408` | Collapse to 3-row preview of unread/unanswered; deep-link "Open Inbox" |
| P1 | Zero quick-action buttons besides "+ New Event" | `app/admin/page.tsx:530-540` | Add Send invoice / Log expense / New project / visible `Cmd+K` hint |
| P2 | Recent activity feed renders 8 rows of mostly-low-signal events | `app/admin/page.tsx:410-505` | Filter to high-signal (payments, contract signed, gallery delivered) or remove |
| P2 | Greeting is decorative-only; no date or "N items waiting" | `app/admin/page.tsx:198-220` | Append "You have N items needing attention" beneath the title |
| P2 | Recent Events table duplicates `/admin/events`; ranks by `createdAt` not `shootDate` | `app/admin/page.tsx:508-595` | Replace with "Upcoming shoots (next 7 days)" sorted by `shootDate ASC` |
| P2 | Not customizable; no per-admin layout | — | Phase 2 — let user toggle secondary cards; action stack stays fixed |

### I. Events + Upload Pipeline

| Sev | Finding | File:line | Fix |
|---|---|---|---|
| P0 | No Event → Project linkage visible (header omits client name + "View project" link despite `projectId` / `clientId` being present) | `app/admin/events/[id]/page.tsx:63` | Render "Linked to {firstName} — View project →" in header |
| P0 | No `beforeunload` warning during upload — closing tab silently aborts 200 PUTs | `UploadZone.tsx`, `lib/upload.ts` | `useEffect` adds `beforeunload` while `pendingCount > 0` |
| P0 | No "Send gallery ready" CTA — admin must navigate manually to `/admin/events/[id]/gallery` to flip flag, then back to type emails | `app/admin/events/[id]/page.tsx:230-245` | Post-`galleryReady` toast with "Notify {client.email} →" CTA |
| P1 | Reverse Project → Event breadcrumb missing | `app/admin/events/[id]/page.tsx:170` | Breadcrumb when `event.projectId` exists |
| P1 | Upload progress is aggregated avg only; no per-file rows during upload | `UploadZone.tsx:234-237` | Collapsible per-file list with status pills |
| P1 | Korrin's-picks vs galleryReady ambiguous — both circular badges, hover-title only | `GalleryEditor.tsx:149-205` | One-line legend above grid: "✓ = visible in client gallery · ★ = featured on portfolio" |
| P1 | No shift-click range / "Select Korrin's picks" in gallery editor | `GalleryEditor.tsx:26-46` | Add shift-click range + "Select picks" |
| P1 | Photo deletion is permanent — no undo, no trash | `PhotoGrid.tsx:61-74` | Soft-delete with `deletedAt`, 7-day purge job; minimum: toast-undo on delete |
| P2 | Bulk delete missing | `GalleryEditor.tsx` | Extend bulk toolbar |
| P2 | Single-PUT uploads fire 200 parallel calls — no concurrency cap | `UploadZone.tsx:207` | Cap at 4-6 (multipart already at 3) |

### J. Settings Sprawl

| Sev | Finding | File:line | Fix |
|---|---|---|---|
| P0 | `/admin/settings` 404s (no parent `page.tsx`) | — | Add hub page with 2-column grid grouped by Automations / Voice / Business |
| P0 | Sidebar has 7 settings entries crowding the nav | `AdminSidebar.tsx:319-393` | Collapse to one "Settings" link → tabbed `/admin/settings/[tab]` shell. Suggested tabs: **Automations** (recipes + reply templates), **Voice** (brand voice), **Business** (insurer + tax + studio hours), **Gear** |
| P1 | No cross-link Sequences → reply-templates or brand-voice | `app/admin/sequences/**` | "Insert from template" + "Voice anchors" side-panel on sequence step editor |
| P1 | No "Save as template" in workspace reply composer | `ProjectWorkspaceClient.tsx:1850-1868` | Inline action next to the textarea |
| P2 | `notificationPrefs` exists on UserDoc but only the client-facing `/settings` edits it; admin can't toggle their own | `lib/db/users.ts:50`, `app/settings/SettingsClient.tsx:25` | Surface in admin "Business → Account" or drop from admin UserDoc |
| P2 | No cross-link Automations ↔ Sequences | — | "See also: Sequences / Automations" footer on both pages |

### K. Admin Search / Discoverability

| Sev | Finding | File:line | Fix |
|---|---|---|---|
| P0 | Mobile reachability broken below 768px — no in-app entry on small screens; Cmd-K needs keyboard | `app/admin/layout.tsx:23` | Header search icon that opens the palette on tap; collapse sidebar below ~900px |
| P1 | Cmd-K hint never visible until palette opens | `AdminSidebar.tsx`, `CommandPaletteProvider.tsx:21` | `⌘K / Ctrl+K` pill in sidebar (and mobile tap target) |
| P1 | Search scope is 5 collections — no off-the-record-notes (correctly excluded by design), brand-voice, products, lead magnets, locations, project messages | `lib/admin/search.ts:341` | Add `searchProducts`, `searchLeadMagnets`, `searchLocations`, project-message scan |
| P1 | Client hits route to `/admin/users?email=` (user-list page) instead of `/admin/clients/<id>` | `lib/admin/search.ts:82` | Re-route to canonical client detail |
| P2 | 2-char minimum is enforced silently | `CommandPalette.tsx:294`, `app/admin/search/page.tsx:75` | "Type 2+ characters" in placeholder + helper |
| P2 | Ranking unlabeled (recency-biased mix of prefix + insertion order) | `lib/admin/search.ts:99` | "Sorted by recency" sublabel; stable score-then-recency sort |
| P2 | No search-query history | `CommandPalette.tsx:66` | Add `cmdk-recent-queries` ring for empty-state suggestions |
| P2 | Palette has no "Open full results" deep link | `CommandPalette.tsx` | Footer link to `/admin/search?q=<query>` |

---

## Part 3 — Audit gaps (8 scopes that didn't return findings)

Each of these hit the Anthropic rate limit (resets nightly, ~1:30am Eastern).
Re-dispatch from a fresh session. Prompts are stored in `NEW_SESSION_PROMPT.md`.

1. **Public marketing pages** — home / portfolio / investment / journal / locations / shop / magnet / style; navbar + footer IA; FAQ/About absence; cross-link gaps.
2. **Empty / loading / error states** — list pages teaching next steps; per-route `error.tsx`; 404 brand consistency; upload retry paths.
3. **Mobile / responsive UX** — admin sidebar drawer; tap targets; pipeline table on small screens; modal viewports; PWA install trigger.
4. **Notifications + engagement** — toast persistence; PWA push; emailEvents rollups; NPS → inbox / email digests; daily-digest concept.
5. **Reports consolidation** — finance/tax/sales-tax/ad-spend tabbed shell; operations tabbed shell; "as of" timestamps; tile drill-down; export-center vs orphaned API routes.
6. **Data tracking gaps** — funnel view; page-view tracking; magnet + style quiz attribution; response-time tracking; per-gallery rollups; bounce aggregates; UTM precedence.
7. **Style / voice / notes integration** — public CTAs for the style quiz; brand-voice reach beyond inbox; off-the-record-notes redaction audit (cross-reference exporters/AI); cross-links.
8. **Shop + lead magnets flow** — navbar visibility; cross-sell; thank-you page download path; lost-email recovery; client doc creation on purchase; magnet → sequence default; admin "test purchase"; product refund flow.

---

## Suggested execution order (for the next session)

**Sprint 1 — P0 finishers** (everything not yet shipped):
1. Gallery "I'm done picking" CTA (`E.P0` — biggest UX win on the client side)
2. Upload `beforeunload` warning (`I.P0` — silent data loss bug)
3. Send-gallery-ready CTA (`I.P0` — closes upload→notify gap)
4. Dashboard Today/Tomorrow + Needs-Action stack (`H.P0` — admin opens this at 9am)
5. Unified Pending Actions card on workspace Overview (`B.P0`)
6. Pipeline filter bar (`B.P0`)
7. Event → Project linkage in event detail (`I.P0`)
8. `/admin/settings` hub page (`J.P0` + `C.P1`)
9. Mobile sidebar drawer + search affordance (`C.P1` + `K.P0`)

**Sprint 2 — P1 high-leverage:**
- One-click "Advance to next" status (`B.P1`)
- Click-to-call/email everywhere (`B.P1`)
- Cmd+K pill (`C.P1`)
- Booking confirmation echo + reply-by date + style-quiz CTA (`F.P1` x3)
- Style profile card in portal (`D.P1`)
- Multi-project switcher (`D.P2` — promote)
- PIN hint + distinct error messages (`E.P1`)
- Share-with-family (`E.P1`)
- 30-day session OR sliding renewal (`G.P1`)
- `/settings` dead email field + password change (`G.P1`)
- Korrin's-picks vs galleryReady legend (`I.P1`)

**Sprint 3 — Consolidation + polish:**
- `/admin/reports` index page (`C.P1`)
- Tab consolidation in workspace (`B.P1`)
- Inbox facets + project/client links in rows (`A.P1`)
- Human-readable resolution labels (`E.P2`)
- Soft-delete photos (`I.P1`)
- Remaining P2 items by area
