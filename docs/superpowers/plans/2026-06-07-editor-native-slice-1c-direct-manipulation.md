# Editor-Native Content Layer — Slice 1C: Direct Manipulation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the editor feel like Squarespace: **inline click-to-edit text** on the page, **drag-to-reorder** sections, a **guided add-section gallery**, and **click-to-replace images** with a focal-point control — replacing the side-drawer-for-everything + ↑↓-buttons + tiny-inline-menu interactions from 1A/1B.

**Architecture:** A single `EditableText` primitive renders the markdown source in read mode and a **plain-text contentEditable of the markdown source** in edit mode (commit on blur). Because only plain source strings are ever stored and the existing constrained-markdown renderers stay the rendering boundary, **no HTML is stored/injected and no sanitizer or data migration is required**. `renderSection`/`renderSections` gain an optional `EditContext` that turns text into `EditableText` and images into clickable replace-slots; `EditModeCanvas` renders through that context. The per-section drawer remains (opened from a floating `SectionToolbar`'s gear) for **structured/list fields** (package cards, process steps, stat rows, slideshow photo lists, CTA hrefs, variants, columns). Drag-reorder uses `@dnd-kit` (already a dependency). The add-section gap opens a guided `AddSectionModal`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, `@dnd-kit/core` + `@dnd-kit/sortable` (already installed), existing `PhotoPicker`, `renderInlineMarkdown`/`renderConstrainedMarkdown`. Verification: `npx tsc --noEmit` + `npm run lint` (+ final `npm run build`). No unit-test runner.

---

## Scope decisions (read first)
- **Inline editing covers top-level text fields only** (eyebrow, headline, sub, heading, intro, body, CTA headline, testimonial quote/author/role). **Structured/list data stays in the drawer** (package cards & their includes, process-steps array, stats rows, slideshow photo list, CTA/Hero CTA hrefs+labels, variant toggles, column counts, slideshow interval). This is the right Squarespace-like split (panels for complex blocks) and keeps the slice tractable.
- **No rich-text WYSIWYG toolbar in 1C.** Inline editing edits the markdown *source* as plain text (e.g. you see `Selected *work*` while editing; it renders italic when not editing). A markdown insert toolbar (bold/italic/link buttons) is a small **optional follow-up** (1C-2), not in this slice. This is what eliminates the sanitizer/migration risk.
- **`BOOKING_FORM`** keeps its drawer form (1A) + inline editing of its eyebrow/heading/intro via the same `EditableText` path.

---

## Conventions
- **Verify** = `npx tsc --noEmit` (only the pre-existing `.next/types/validator.ts` error allowed, if present) + `npm run lint` (no NEW issues). Final `npm run build` in the wrap-up review.
- Work on the **current branch**. Commit-trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Don't start a task before the previous task's Verify passes.

## File Map
| File | Change | Responsibility |
|---|---|---|
| `components/site-editor/EditableText.tsx` | create | Dual-mode text: markdown render (read) / contentEditable source (edit) |
| `components/site-editor/EditableImage.tsx` | create | Dual-mode image: plain `<img>` (read) / clickable "Replace" slot (edit) |
| `lib/site-content/render.tsx` | modify | Thread optional `EditContext`; route text→`EditableText`, images→`EditableImage` |
| `components/site-editor/SectionToolbar.tsx` | create | Floating per-section toolbar (drag handle, duplicate, settings, delete) |
| `components/site-editor/AddSectionModal.tsx` | create | Guided add-section gallery (categories + descriptions), replaces the gap menu |
| `components/site-editor/SectionsCanvas.tsx` | modify | Render via EditContext; dnd-kit Sortable list; SectionToolbar; AddSectionModal; image-replace wiring |
| `components/site-editor/SectionWrapper.tsx` | modify/retire | Selection/hover wrapper kept; its ↑↓/dup/del toolbar replaced by `SectionToolbar` + drag |
| `components/site-editor/AddSectionGap.tsx` | modify | Becomes a thin "+" affordance that opens `AddSectionModal` at an index |
| `lib/site-content/edit-context.ts` | create | Shared `EditContext` type (imported by render.tsx + canvas; keeps render.tsx prop-typed) |

---

## Task 1: `EditContext` type + `EditableText` primitive

**Files:** Create `lib/site-content/edit-context.ts`, `components/site-editor/EditableText.tsx`

- [ ] **Step 1: `lib/site-content/edit-context.ts`** (pure types — safe for server render.tsx + client canvas)
```ts
// lib/site-content/edit-context.ts
// Optional editing hooks threaded through the render layer. When present,
// renderSection() renders editable text/image affordances; when absent it
// renders read-only. Pure types — no React, safe to import anywhere.
export interface ImageSlot {
  /** field on the section, e.g. "slides" | "photos" | "heroImage" */
  field: string;
  /** index into an array field, if applicable */
  index?: number;
}

export interface EditContext {
  onText: (sectionId: string, field: string, value: string) => void;
  onImage: (sectionId: string, slot: ImageSlot) => void;
}
```

- [ ] **Step 2: `components/site-editor/EditableText.tsx`**
```tsx
"use client";
// components/site-editor/EditableText.tsx
// Dual-mode text. Read mode renders the markdown source via the constrained
// renderers (same output as production). Edit mode shows the raw markdown
// source in a plain contentEditable that commits on blur. No HTML is ever
// stored — only the plain source string — so the markdown renderers remain
// the single safe rendering boundary.
import { useRef, useEffect } from "react";
import { renderInlineMarkdown, renderConstrainedMarkdown } from "@/lib/site-content/markdown";

type Tag = "h1" | "h2" | "h3" | "p" | "span" | "div" | "blockquote";

export function EditableText({
  as = "span", value, editing, onCommit, markdown = "inline", placeholder, style,
}: {
  as?: Tag;
  value: string;
  editing: boolean;
  onCommit: (next: string) => void;
  markdown?: "inline" | "block" | "none";
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLElement | null>(null);

  // Keep the contentEditable text in sync ONLY when not focused (avoid caret jumps).
  useEffect(() => {
    const el = ref.current;
    if (!el || !editing) return;
    if (document.activeElement !== el && el.textContent !== value) {
      el.textContent = value;
    }
  }, [value, editing]);

  const Tag = as as keyof React.JSX.IntrinsicElements;

  if (editing) {
    return (
      // @ts-expect-error dynamic intrinsic tag
      <Tag
        ref={ref as never}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onBlur={(e: React.FocusEvent<HTMLElement>) => {
          const next = e.currentTarget.textContent ?? "";
          if (next !== value) onCommit(next);
        }}
        onKeyDown={(e: React.KeyboardEvent) => {
          // Single-line fields (not block markdown) commit on Enter.
          if (e.key === "Enter" && markdown !== "block") { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); }
        }}
        style={{ ...style, outline: "none", cursor: "text", minWidth: "1ch", whiteSpace: markdown === "block" ? "pre-wrap" : undefined }}
        suppressHydrationWarning
      >
        {value}
      </Tag>
    );
  }

  // Read mode
  if (markdown === "none") {
    // @ts-expect-error dynamic intrinsic tag
    return <Tag style={style}>{value}</Tag>;
  }
  const html = markdown === "block" ? renderConstrainedMarkdown(value) : renderInlineMarkdown(value);
  // @ts-expect-error dynamic intrinsic tag
  return <Tag style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}
```
(If the `@ts-expect-error` dynamic-tag approach trips strict typing, instead render via `React.createElement(as, props, ...)` — use whichever compiles cleanly. Add CSS for `[contenteditable][data-placeholder]:empty:before { content: attr(data-placeholder); color: var(--charcoal-muted); }` to `app/globals.css` so empty fields show a placeholder.)

- [ ] **Step 3: Verify** (`tsc` + `lint`). **Step 4: Commit** `feat(site-editor): EditContext type + EditableText dual-mode primitive`.

---

## Task 2: Editable render layer + canvas integration

**Files:** `components/site-editor/EditableImage.tsx` (create), `lib/site-content/render.tsx`, `components/site-editor/SectionsCanvas.tsx`

- [ ] **Step 1: `EditableImage.tsx`** — read mode = the existing `<img>`; edit mode = same img wrapped in a button-like div with a hover "⇄ Replace" overlay calling `onClick`. Props: `{ src; alt; editing; onClick; style }`. Preserve `onContextMenu` block + `draggable={false}`.

- [ ] **Step 2: `render.tsx` — thread `EditContext`**
  - Import `EditContext` from `@/lib/site-content/edit-context`, `EditableText`, `EditableImage`.
  - Change `renderSection(section, edit?: EditContext)` and `renderSections(sections, edit?)`. Pass `edit` to every block.
  - In each block, replace top-level TEXT JSX with `<EditableText editing={!!edit} value={field} onCommit={(v) => edit?.onText(section.id, "field", v)} as={...} markdown={...} placeholder={...} style={...} />`. Mapping:
    - HERO: `eyebrow` (span/p, markdown none), `headline` (h1, inline), `sub` (p, none).
    - PHOTO_GRID: `eyebrow` (span, none), `heading` (h2, inline), `body` (p, none).
    - RICH_TEXT: `eyebrow` (p, none), `heading` (h2, none), `body` (div, **block**).
    - CTA_BANNER: `eyebrow` (p, none), `headline` (h2, inline).
    - PROCESS_STEPS: `eyebrow` (span, none), `heading` (h2, inline), `intro` (p, none). (Steps array stays drawer-only.)
    - PACKAGE_CARDS: `eyebrow`, `heading` (inline), `intro`. (Cards array drawer-only.)
    - TESTIMONIAL: `eyebrow` (none), `quote` (blockquote, none — keep the surrounding quotes), `author`/`authorRole` (none).
    - SLIDESHOW: `eyebrow`, `heading` (none). (Slides drawer-only.)
    - STATS: items are structured → drawer-only (skip inline for now).
    - BOOKING_FORM: `eyebrow`, `heading` (none), `intro` (none).
  - Replace HERO background image + PHOTO_GRID images + SLIDESHOW images with `<EditableImage editing={!!edit} ... onClick={() => edit?.onImage(section.id, { field: "slides"|"photos", index })} />`. For empty image slots in edit mode, render a placeholder "＋ Add image" tile that calls `onImage`.
  - IMPORTANT: when `edit` is undefined the output must be **byte-equivalent** to today's read-only render (so public pages are unchanged). Confirm by eye on a couple of blocks.

- [ ] **Step 3: `SectionsCanvas.tsx` — render through the context**
  - Build an `EditContext` in `EditModeCanvas`: `onText: (id, field, value) => updateSectionH(id, { [field]: value } as Partial<Section>)`; `onImage: (id, slot) => setPicker({ sectionId: id, ...slot })` (reuse existing `picker` plumbing / `applyPickedPhoto`).
  - Render each section's body via `renderSection(section, editCtx)` instead of the bare `renderSection(section)` inside `SectionWrapper`.
  - The drawer (`SectionDrawer`) stays — opened via the section toolbar gear (Task 3) — and remains the editor for structured fields. Inline edits and drawer edits both flow through `updateSectionH`, so undo/autosave already work.
  - Because clicks inside an editable section now need to NOT trigger section-select when editing text, adjust `SectionWrapper`'s onClick: if the click target is a `[contenteditable]` or inside one, do not preventDefault the caret / still select the section but don't blur. (Read current handler; make text editing usable — clicking text should focus it, not just select the section.)

- [ ] **Step 4: Verify** (`tsc` + `lint`; confirm public pages still render — reason about the `edit===undefined` path). **Step 5: Commit** `feat(site-editor): inline editable text + image slots via render EditContext`.

---

## Task 3: `SectionToolbar` (floating) + drag-to-reorder (dnd-kit)

**Files:** `components/site-editor/SectionToolbar.tsx` (create), `components/site-editor/SectionsCanvas.tsx`, `components/site-editor/SectionWrapper.tsx`

- [ ] **Step 1: `SectionToolbar.tsx`** — a small floating toolbar (replaces SectionWrapper's ↑↓/dup/del block): drag-handle (⠿, the dnd-kit listeners attach here), duplicate (⎘), settings/gear (⚙ → opens drawer), delete (×, destructive). Props: `{ onDuplicate; onOpenSettings; onDelete; dragHandleProps }`. No emojis beyond these geometric/symbol glyphs (avoid the 🖥-style emoji per CLAUDE.md; ⠿/⎘/⚙/× are acceptable symbol glyphs — if ⚙ is considered an emoji, use the text "Edit").

- [ ] **Step 2: dnd-kit Sortable in `SectionsCanvas.tsx`**
  - Import `DndContext`, `closestCenter`, `PointerSensor`, `useSensor`, `useSensors` from `@dnd-kit/core`; `SortableContext`, `verticalListSortingStrategy`, `useSortable`, `arrayMove` from `@dnd-kit/sortable`; `CSS` from `@dnd-kit/utilities`.
  - Wrap the section list in `<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>` + `<SortableContext items={sections.map(s=>s.id)} strategy={verticalListSortingStrategy}>`.
  - Create a `SortableSection` wrapper component using `useSortable({ id })` that applies `transform`/`transition` and passes `attributes`+`listeners` to the `SectionToolbar` drag handle; render `SectionWrapper` + `renderSection(section, editCtx)` inside it.
  - `onDragEnd(e)`: if `over` and `active.id !== over.id`, compute `arrayMove(sections, from, to)` and `replace(reordered, "move")`.
  - Use a `PointerSensor` with an activation constraint (`{ distance: 6 }`) so clicks/text-edits aren't swallowed by drag.
  - Drag handle lives in `SectionToolbar`; dragging anywhere else should NOT start a drag (so inline text editing still works).

- [ ] **Step 3: Retire SectionWrapper's button toolbar** — remove its internal ↑↓/dup/del `<div>` + `ToolbarBtn` (now provided by `SectionToolbar`). Keep the hover/select outline + selection click behavior. `moveSection(id, dir)` may be removed if nothing else uses it (drag replaces it); keep `duplicateSection`/`deleteSection`.

- [ ] **Step 4: Verify** (`tsc` + `lint`; reason: drag reorder dispatches through history → undo + autosave work). **Step 5: Commit** `feat(site-editor): drag-to-reorder (dnd-kit) + floating SectionToolbar`.

---

## Task 4: `AddSectionModal` (guided gallery)

**Files:** `components/site-editor/AddSectionModal.tsx` (create), `components/site-editor/AddSectionGap.tsx`, `components/site-editor/SectionsCanvas.tsx`

- [ ] **Step 1: `AddSectionModal.tsx`** — a centered overlay (pattern + z-index from `ConfirmDialog`) listing the page's `allowedSections` as tiles with `SECTION_LABEL[type]` + a one-line description (define a `SECTION_DESCRIPTION: Record<SectionType,string>` in `styles.ts` or the modal). Optional category grouping (Headers / Photos / Text / Pricing / Social) — a simple grouped list is fine. Props: `{ open; allowedSections; onPick: (type) => void; onClose }`. Escape + backdrop close.

- [ ] **Step 2: `AddSectionGap.tsx`** — strip the inline menu; it becomes a thin hover-revealed "+" line that calls a passed `onRequestAdd(index)` (no local menu). 

- [ ] **Step 3: `SectionsCanvas.tsx`** — add `const [addAt, setAddAt] = useState<number | null>(null);`. `AddSectionGap` `onRequestAdd={(i) => setAddAt(i)}`. Render `<AddSectionModal open={addAt !== null} allowedSections={allowedSections} onClose={() => setAddAt(null)} onPick={(type) => { insertSection(type, addAt!); setAddAt(null); }} />`. (`insertSection` already dispatches through history.)

- [ ] **Step 4: Verify** + **Commit** `feat(site-editor): guided AddSectionModal gallery`.

---

## Task 5: Image replace + focal-point control

**Files:** `components/site-editor/SectionsCanvas.tsx`, `components/admin/PhotoPicker.tsx` (read; extend only if needed), `components/site-editor/FocalPointPicker.tsx` (create, optional)

- [ ] **Step 1: Read `components/admin/PhotoPicker.tsx`** to see its current props/tabs (it already takes `pickerData` with `siteAssets` + `projectPhotos`). Confirm it supports choosing from project photos (sessions) + site library, and whether it has an upload tab. If an **Upload** path is missing, wire it to the existing `/api/site-assets/upload` + `/api/site-assets/confirm` flow used elsewhere (read how the admin site-assets uploader calls them; reuse, don't reinvent).
- [ ] **Step 2: Wire image-click → picker** — Task 2 already routes `edit.onImage(sectionId, slot)` to `setPicker({ sectionId, field, index })`. Ensure `handlePhotoSelected(ref)` uses `applyPickedPhoto(section, picker, ref)` to set the chosen photo into the right slot (existing helper). Verify `applyPickedPhoto` handles HERO `slides[0]`, PHOTO_GRID `photos[index]`, SLIDESHOW `slides[index]`, and appends when `index` is undefined (empty-slot add).
- [ ] **Step 3: `FocalPointPicker.tsx`** — after a photo is chosen (or via the drawer), allow setting `focalX`/`focalY` (0–1): a small preview with a draggable dot; on change, `updateSectionH` the photo ref's focal fields. Render it in the `SectionDrawer` for image-bearing sections (HERO/PHOTO_GRID/SLIDESHOW) next to each photo, OR as a step after picking. Keep it simple — a click-to-set focal point on a preview thumbnail is enough. (Render layer already honors `focalX/focalY` via `objectPosition`.)
- [ ] **Step 4: Verify** + **Commit** `feat(site-editor): click-to-replace images with 3 sources + focal point`.

---

## Self-Review (completed)
- **Spec coverage:** inline text (Tasks 1–2), image replace + focal point (Tasks 2,5), drag reorder (Task 3), floating toolbar (Task 3), guided add gallery (Task 4). The editable render layer is unified through `EditableText`/`EditableImage` so read-mode output is unchanged (public pages safe).
- **Deliberate scope:** structured/list fields stay in the drawer; no rich-text WYSIWYG toolbar (markdown-source inline editing instead → no sanitizer/migration). Both flagged at top. Optional follow-up **1C-2**: markdown insert toolbar (bold/italic/link) on text selection.
- **Safety:** no HTML is stored (only markdown source strings); the constrained-markdown renderers remain the only HTML boundary; `edit===undefined` keeps production rendering byte-identical.
- **Type consistency:** `EditContext`/`ImageSlot` (edit-context.ts) consumed by render.tsx + SectionsCanvas; `EditableText` `markdown` modes match the existing `renderInlineMarkdown`/`renderConstrainedMarkdown` usage per field; dnd-kit `arrayMove` result dispatched via `replace(..., "move")` (history/autosave from 1B).
- **Placeholders:** none — full code for the linchpin (`EditableText`, `EditContext`); precise per-block/per-API steps for the mechanical conversions (which require reading the current code in place).
