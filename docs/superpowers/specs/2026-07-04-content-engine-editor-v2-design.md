# Goldenrod — Content Engine + Site Editor v2 (Sub-project 2)

**Date:** 2026-07-04
**Status:** Approved by Quinn
**Depends on:** `2026-07-03-greenfield-foundation-design.md` (tokens, primitives, auth, storage, conventions) · Builds in `C:\Users\danie\Documents\GitHub\goldenrod` (PR flow from this sub-project onward)
**Architecture decision:** Port-and-harden the v1 editor architecture (approved over block-tree redesign and OSS adoption)

---

## 1. Goal

The Squarespace-class editing layer the whole public site will be built with: a sections content engine + in-place WYSIWYG editor, carrying v1's proven architecture with every audited gap fixed, plus global site settings, per-page SEO, and seven new section types. Brand/theme is **fixed in code** (decided 2026-07-04) — the editor edits content, never identity.

## 2. Content model

- **Zod v4 schemas are the single source of truth** in `lib/site-content/schema.ts`; TS types via `z.infer`. No hand-written duplicate interfaces (v1's drift risk eliminated).
- `Section` = discriminated union on `type`:
  - **Carried from v1 (10):** HERO, PHOTO_GRID (legacy; hidden from the add menu — GALLERY supersedes it), RICH_TEXT, CTA_BANNER, PROCESS_STEPS, PACKAGE_CARDS, TESTIMONIAL, SLIDESHOW, STATS, BOOKING_FORM (placeholder render until SP3 wires the form).
  - **New (7):** FAQ (accordion, Radix), VIDEO (R2 upload via multipart pipeline OR YouTube/Vimeo URL embed; poster image; respects reduced-motion), CONTACT (email/phone/location/hours from business info + optional inquiry CTA), GALLERY (photos + `layout: "masonry" | "carousel" | "stack"`), INSTAGRAM_STRIP (curated site-library photos + handle link — deliberately NOT the Instagram API), BEFORE_AFTER (two PhotoRefs + accessible drag/keyboard slider), FIND_YOUR_GALLERY (public card linking to login/gallery; full function in SP4).
- `PhotoRef` keeps `source/id/cloudflareImageId/eventId?/focalX/focalY` and `altText` (editor UI nudges toward filling it; empty allowed but flagged in the drawer).
- **Page registry:** built-in pages with per-page `allowedSections`; admin-created custom pages (kebab slug, reserved-slug guard) allowing all types.

## 3. Global settings (new surface)

`siteSettings/global` document, same draft→publish workflow as pages, edited from a settings panel inside the editor:
- **Nav:** ordered links (built-in + custom pages + external), show/hide, label overrides.
- **Logo:** `wordmark` (brand component) | `image` (uploaded PhotoRef).
- **Footer:** sections-lite content (rich text + social row).
- **Social links:** typed list (platform + url), rendered wherever placed.
- **Announcement bar:** enabled, text (inline markdown), href, dismissible.
- **Business info:** email/phone/city/hours — feeds CONTACT sections, footer, and JSON-LD (SP3 consumes).

**Per-page SEO** (fields on the page doc, edited in a page-settings panel): `seoTitle`, `seoDescription`, `ogImage?` (defaults to brand OG), `slug` (custom pages only), `noindex`.

## 4. Persistence & workflow

- `siteContent/{pageId}`: `draftSections`, `publishedSections`, `draftDirty`, audit stamps, `revisions` subcollection — **cap 50, list 50** (v1 listed 25 of 50).
- **Optimistic concurrency (new):** drafts carry `draftRev` (int). `saveDraft(pageId, sections, baseRev)` rejects when `baseRev !== draftRev` → client shows a conflict dialog (reload draft / overwrite) instead of v1's silent last-write-wins.
- Autosave: 900ms debounce, generation-counter race guard (v1 pattern), **failure surfaces a toast** and schedules retry (v1 failed silently).
- Publish/discard/restore return resulting sections (no-flash), write revisions, `revalidatePath` all affected routes. Footer/nav/announcement publish revalidates every page.

## 5. Editor UX

Single React tree — the live page IS the canvas (`?edit=1`, admin-gated). Carried: floating edit pill, EditorTopBar (save status, undo/redo 50-deep with keystroke coalescing, device preview, Revisions/Discard/Publish/Exit), SectionWrapper/Toolbar (drag handle, duplicate, edit, delete), AddSectionModal gallery, per-type drawer forms, PhotoPicker (site library / project photos / upload), FocalPointPicker.

Hardened at the door (each was an audited v1 gap):
1. **Markdown toolbar** — bold/italic/link on text selection in EditableText (edits markdown source; no HTML storage).
2. **Keyboard a11y:** dnd-kit KeyboardSensor + sortableKeyboardCoordinates for section reorder; FocalPointPicker arrow keys + ARIA slider semantics.
3. Dialogs/popovers via foundation Radix primitives → focus traps + Escape for free.
4. Save status in an `aria-live="polite"` region.
5. Image replace flow includes alt-text and focal-point inline (not drawer-only).
6. STATS gets inline editing + empty-state placeholder like every other section; HERO slides array: only slide[0] renders → the schema constrains HERO to ONE slide (multi-image motion belongs to SLIDESHOW).
7. Mobile: device preview toggle + per-section `hideOnMobile` — **no separate mobile canvas** (decided 2026-07-04).

## 6. Rendering

`renderSection(section, edit?)` shared by public and editor paths, styled exclusively with brand tokens on the dark theater surface (marketing default). Read mode is byte-identical with `edit` absent. Every section emits `data-section-id/type`. Sanitization: constrained-markdown allow-list identical in spirit to v1 (`**`, `*`, links with SAFE_HREF, bullets); no raw HTML ever stored or rendered.

## 7. Security & validation

Server actions: `requireAdmin()` first line → existence check → Zod parse (the same schemas as the types — no drift) → page allow-list → write → best-effort activity log → `revalidatePath`. Upload endpoints reuse foundation storage with admin gates. All editor state changes are server-validated; client payloads never trusted.

## 8. Testing

- Unit: schema round-trips (every section type parses its own factory output), action validation/rejection paths, concurrency rejection, markdown renderer allow-list (XSS attempts must escape).
- Playwright (the SP2 acceptance backbone): admin enters edit mode → inline-edits a headline → autosave persists (reload keeps it) → adds FAQ section via modal → reorders via keyboard → publishes → public page (no `?edit=1`, signed-out context) shows the change; revisions restore round-trip; concurrency conflict dialog appears when `draftRev` is stale.
- Env-gated flows reuse the foundation's admin-credential gating.

## 9. Acceptance criteria

1. All 17 section types render on-brand in `/styleguide`-style catalog AND in the live editor; each has a working drawer form.
2. The full edit→autosave→publish→public-render loop passes in Playwright.
3. Keyboard-only operation: reorder a section and set a focal point without a pointer (Playwright keyboard test).
4. Global settings: change nav + announcement bar, publish, both appear on a public page.
5. Per-page SEO fields emit correct `<head>` metadata on a test page.
6. Markdown toolbar produces `**bold**`/`*italic*`/`[link](href)` source; XSS-vector inputs render escaped.
7. Concurrency: two simulated editors — the stale save is rejected with the conflict dialog, no data lost.
8. Zero-warning lint/typecheck/test baseline maintained; PRs only (foundation's direct-main window is closed).

## 10. Out of scope

Public page assembly + content seeding + booking form logic (SP3); galleries/portal + light-surface overlay work (SP4); admin CRM (SP5); theme controls (cut 2026-07-04); Instagram API integration (deliberate non-goal); migration of korrinsphotos `siteContent` data (fresh start; archive stays readable).
