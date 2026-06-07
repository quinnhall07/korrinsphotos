# Editor-Native Content Layer — Slice 1: Foundation + Modern Editor UX

**Date:** 2026-06-07
**Status:** Design (awaiting approval)
**Author:** Quinn Hall (with Claude)

---

## 1. Background & Problem

Korrin's Photos already ships an in-progress site editor (`lib/db/site-content.ts`,
`components/site-editor/*`, `/admin/site`, draft→publish + revisions). The engine is
sound — `SectionsCanvas` is a single React tree that *is* the source of truth (no iframe,
no postMessage). But it **feels finicky and buggy**, for concrete, code-confirmed reasons:

1. Editing happens in a **right-side drawer form**, not on the page — eyes on the canvas,
   hands in a panel.
2. Reordering is **up/down arrow buttons**, not drag-and-drop.
3. **Manual save**, and you must *save before you can publish* — a two-step dance.
4. **Native `confirm()` / `prompt()`** pop-ups for delete, discard, and publish notes.
5. **No undo/redo.**
6. **Full-page reload flash** after publish/discard (`router.refresh()`).
7. **No device preview.**

Additionally, every public page has **two-to-three lives**: an editor path, a ~200-line
hand-coded fallback, and a `*_DEFAULTS` copy. These drift apart, which compounds the
"glitchy" feeling.

The owner's instinct — *"if it were built from the ground up with the editor in mind, it
would work better"* — is correct **about the content/presentation layer**, but a full app
rebuild would needlessly discard proven back-of-house (auth, Stripe, galleries, uploads,
email, admin pipeline). So this project rebuilds **only the content layer + editor
front-end**, on top of the existing infrastructure.

---

## 2. Goals / Non-Goals

### Goals (Slice 1)
- Every editable page renders through **one path** (sections only). No fallback JSX, no
  `*_DEFAULTS` duplication.
- A **Squarespace-style editor**: inline text editing, click-to-replace photos,
  drag-to-reorder, a guided "add section" gallery, autosave, undo/redo, device preview,
  in-app dialogs (no native pop-ups), one-click publish, no reload flash.
- The four content pages wired in: **Landing, Portfolio (incl. bio), Pricing, Booking**.

### Non-Goals (later slices / separate projects)
- **Global settings** (nav links, logo, socials, per-page SEO) — *Slice 2*.
- **Theme controls** (editable colors/fonts) — *Slice 3*.
- **Additional section types** (FAQ, video, etc.) — *Slice 4*.
- **Gallery print sales** (hover-to-add prints, cart, checkout) — *separate project*.
- **Backend teardown** of dissolved features' collections/admin (journal, locations,
  products) — deferred cleanup (see §8).

---

## 3. Roadmap Context

| Slice | Scope | Status |
|---|---|---|
| **1** | Editor-native foundation + modern editor UX (this doc) | designing |
| 2 | Global settings: nav, logo, socials, per-page SEO | future |
| 3 | Theme controls (guard-railed color/font tokens) | future |
| 4 | New section types (FAQ, contact, video, …) | future |
| — | **Gallery print sales** (own brainstorm → spec) | parked |

---

## 4. Locked Site Map

**Editable content pages** (sections-only, editor-native):
- `/` — **Landing**
- `/portfolio` — **Portfolio** (the About bio/story folds in here as a section)
- `/pricing` — **Pricing** (renamed from `/investment`; `301`/redirect from old path)
- `/booking` — **Booking** (editable copy *around* the functional inquiry form)

**Functional app areas** (not section-edited): **My Galleries** (`/gallery`), **Login**,
**Admin**, plus global **Nav + Footer** (both become editable in Slice 2 — see §2).

**Dissolved** (public routes + nav removed in Slice 1; backend teardown deferred):
`/about` (bio → Portfolio), `/journal`, `/locations`, `/shop`.

---

## 5. Slice 1 Design

### 5.1 Rendering model — seed once, then single path

Each editable page becomes exactly:

```
sections = (admin && ?edit) ? draft : published
render <SectionsCanvas sections={sections} />     // no `else` branch
```

A **one-time seed migration** writes the current hand-crafted designs into Firestore as
*published* sections for `home`, `portfolio`, `pricing`, and `booking` (the global
**footer** stays as the `<Footer>` component until Slice 2). Then the hand-coded fallback
JSX and the `*_DEFAULTS` constants are **deleted**. After this, the
editor view and the live page are the same bytes — always.

`RICH_TEXT` bodies currently stored as markdown are converted to a **sanitized HTML
subset** during the seed (see §5.4 inline text + §7 security).

### 5.2 Editor architecture (keep the good core, rebuild the front-end)

The canvas-is-source-of-truth model stays. What changes is state and interaction.

- **History/undo-redo** — replace ad-hoc `useState` with a reducer (`useEditorHistory`)
  holding `{ past: Section[][], present: Section[], future: Section[][] }`. Actions:
  `UPDATE_SECTION`, `INSERT_SECTION`, `MOVE_SECTION`, `DUPLICATE`, `DELETE`, `UNDO`,
  `REDO`, `RESET`. Keyboard: **Cmd/Ctrl+Z** undo, **Cmd/Ctrl+Shift+Z** redo.
- **Autosave** (`useAutosave`) — debounced (~1s) call to `saveDraftAction` whenever
  `present` changes. Status machine: `saved | unsaved | saving | error`, surfaced live in
  the top bar. On error, changes are retained + retry offered. `beforeunload` guard only
  while `saving`/`unsaved`.
- **Publish** — one button. If there are pending changes, it flushes the save first, then
  publishes. Removes the "save before publishing" friction.
- **No reload flash** — `publishDraftAction` / `discardDraftAction` **return the resulting
  published sections**; the client updates state in place instead of `router.refresh()`.

### 5.3 Editor chrome & interaction (decisions locked via mockups)

- **Chrome = minimal top bar + floating per-section toolbars** (mockup choice **A**).
  Top bar: `☰ Pages · ↶ ↷ · 💻📱 device · ● <status> · Publish`.
- **Floating section toolbar** (`SectionToolbar`) appears on hover/select, pinned to the
  section: drag-handle (dnd-kit), duplicate, **⚙ settings**, delete (in-app confirm).
- **Add section = guided gallery modal** (mockup choice **2**): `AddSectionModal` with
  categories + thumbnail/description tiles, filtered by the page's `allowedSections`,
  inserting at the clicked "＋" index.
- **Inline text** (mockup ①): click text on the canvas and type via an `<Editable>`
  contentEditable primitive; a floating `TextFormatToolbar` (bold/italic/link/heading)
  appears on selection. No drawer needed for copy.
- **Photo replace** (mockup ②): click an image → `PhotoPicker` opens with **three
  sources** — *From sessions* (project-photo collectionGroup), *Site library*
  (`site-assets`), *Upload* — plus an optional **focal-point** control (stored on
  `PhotoRef`, applied via `object-position`). Full freeform crop is deferred.
- **Settings drawer (secondary)** — the existing `SectionDrawer` is repurposed for
  *non-inline* props only (columns, `variant` DARK/LIGHT, slideshow interval, etc.),
  opened from the ⚙ in the floating toolbar.
- **Device preview** — top-bar toggle constrains canvas max-width (desktop 100% / tablet
  ~768px / mobile ~390px); sections already render responsively.
- **In-app dialogs** — `ConfirmDialog` + `PublishDialog` replace all `confirm()`/`prompt()`.

### 5.4 Editable render layer

`lib/site-content/render.tsx` gains an **edit-mode variant**: renderers accept an optional
edit context that swaps static text for `<Editable>` and static `<img>` for clickable
image slots, dispatching back into the reducer. This is the largest refactor — it touches
all current section renderers (HERO, PHOTO_GRID, RICH_TEXT, CTA_BANNER, PROCESS_STEPS,
PACKAGE_CARDS, TESTIMONIAL, SLIDESHOW, STATS) — but each change is small and bounded.

### 5.5 Pages in scope — specifics

- **Landing (`home`)** — seed from current `app/page.tsx` design (hero slideshow, selected
  work, stats, CTA) as sections; delete the hand-coded fallback + `HOME_DEFAULTS`.
- **Portfolio** — seed current header + grid; add a `RICH_TEXT`/about section carrying the
  bio folded from `/about`.
- **Pricing** — **rename `/investment` → `/pricing`**. Relocate `app/investment/packages.ts`
  → `app/pricing/packages.ts` (or `lib/pricing/packages.ts`) and update the
  `app/booking/page.tsx` import. Add a permanent redirect `/investment → /pricing`. Seed
  from current investment design.
- **Booking** — keep `BookingFormSteps` + `submitBooking` untouched; introduce a new
  **`BOOKING_FORM`** section type (an embed) so copy above/below the form is editable but
  the form itself can't be broken. `allowedSections` for `booking` = copy sections +
  `BOOKING_FORM`.

### 5.6 Route dissolution

Remove the **public routes and nav entries** for `/about`, `/journal`, `/locations`,
`/shop`, and update `components/Navbar.tsx` to the new map (Home, Portfolio, Pricing,
Booking; My Galleries/Login as auth-aware). Backend collections + admin management for
journal/locations/products are **left intact for now** and removed in a later cleanup (the
products teardown rides with the print-sales project, since both touch Stripe).

---

## 6. Data Model & Migrations

- **`siteContent` schema unchanged** (`draftSections` / `publishedSections` / `revisions`).
- **`page-registry.ts`** → editable pages become `home, portfolio, pricing, booking`
  (remove `about`, rename `investment`→`pricing`; `footer` stays registered but is not
  re-wired until Slice 2).
- **`types.ts`** → add `BOOKING_FORM` to `SectionType` + section union; add optional
  `focalX?/focalY?` to `PhotoRef`.
- **Seed script** (`scripts/seed-site-content.ts`) — idempotent (skips a page that already
  has `publishedSections`); writes current designs as published; converts RICH_TEXT
  markdown → sanitized HTML; if a legacy `investment` siteContent doc exists, copy →
  `pricing` then delete.

---

## 7. Error Handling, Edge Cases, Security

- **Autosave failure** → keep edits, show `error` status, offer retry; block unload while
  unsaved.
- **Publish/discard** return canonical published sections so the client never shows stale
  state and never full-reloads.
- **Seed idempotency** — safe to re-run; never clobbers an existing published page.
- **contentEditable sanitization** — on save, RICH_TEXT/inline HTML is sanitized
  server-side against a strict allowlist (`b,i,em,strong,a[href],h2,h3,p,ul,ol,li,br`)
  before persisting. `a[href]` restricted to http/https/mailto.
- **Auth** — all `/admin/site` actions keep `requireAdmin()` as the first line.

---

## 8. Component Inventory

**New**
- `components/site-editor/EditorShell.tsx` (reducer + autosave + keyboard + device preview)
- `components/site-editor/EditorTopBar.tsx`
- `components/site-editor/SectionToolbar.tsx`
- `components/site-editor/AddSectionModal.tsx`
- `components/site-editor/Editable.tsx`
- `components/site-editor/TextFormatToolbar.tsx`
- `components/site-editor/ConfirmDialog.tsx`, `PublishDialog.tsx`
- `components/site-editor/useEditorHistory.ts`, `useAutosave.ts`
- `scripts/seed-site-content.ts`
- `app/pricing/page.tsx` (+ `app/pricing/packages.ts`), redirect for `/investment`

**Changed**
- `lib/site-content/page-registry.ts`, `types.ts`, `render.tsx`
- `components/site-editor/SectionsCanvas.tsx` (delegates to `EditorShell`)
- `components/site-editor/SectionDrawer.tsx` (repurposed: advanced props only)
- `app/admin/site/actions.ts` (publish/discard return published sections)
- `app/page.tsx`, `app/portfolio/page.tsx`, `app/booking/page.tsx`
- `components/Navbar.tsx`

**Removed**
- Hand-coded fallback JSX in the page files; `*_DEFAULTS` (`home.ts`, `portfolio.ts`,
  `investment.ts`, `about.ts`)
- `components/site-editor/EditBar.tsx`, `AddSectionGap.tsx`, `SectionWrapper.tsx` (superseded)
- Public routes: `app/about`, `app/journal`, `app/locations`, `app/shop`

**Reused as-is**
- `@dnd-kit/*` (already installed), `PhotoPicker`, `lib/db/site-content.ts`,
  `lib/db/site-assets.ts`, Cloudflare Images/R2 pipeline, revisions modal.

---

## 9. Testing Plan

- `npm run build` + `npm run lint` clean.
- **Editor flows:** inline text edit + format toolbar; photo replace from each of the 3
  sources; focal-point; drag reorder; add via gallery modal; undo/redo (incl. keyboard);
  autosave status transitions; publish with no reload flash; discard; device preview;
  in-app confirm/publish dialogs (no native pop-ups).
- **Seed:** run twice → idempotent; published pages match prior hand-coded designs
  visually; markdown→HTML conversion intact.
- **Routing:** `/investment` → `/pricing` redirect; dissolved routes gone; booking form
  still submits (`submitBooking` unaffected); package query params still resolve.
- **Public render:** all four pages render published sections with no fallback path.

---

## 10. Risks & Open Questions

- **Biggest risk:** the editable render refactor (§5.4) + contentEditable HTML for
  RICH_TEXT. Mitigation: strict sanitizer, bounded per-renderer changes, snapshot the
  seeded output against the current pages before deleting fallbacks.
- **Focal-point vs full crop** — Slice 1 ships focal-point only; confirm that's acceptable.
- **Dead backend code** for journal/locations/products remains until a later cleanup —
  acceptable short-term?
