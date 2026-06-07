# Editor-Native Content Layer — Slice 1B: Editor Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the site editor's finicky engine with a modern one — debounced **autosave** (no manual Save, no "save before publish"), **undo/redo**, **in-app dialogs** (no native `confirm()`/`prompt()`), **no full-page reload** on publish/discard/restore, a live **save-status** indicator, and a **device-preview** toggle — while keeping the existing per-section interactions (the drawer, the +Add gap, the move/duplicate/delete controls) unchanged. Those interaction upgrades (inline text, drag-reorder, add-section modal, image replace) are Slice 1C.

**Architecture:** Introduce a `useEditorHistory` reducer (`{past, present, future}` with coalesced text edits) and a `useAutosave` hook (debounced, status machine). Refactor the existing `EditModeCanvas` (in `components/site-editor/SectionsCanvas.tsx`) to drive all mutations through the reducer, autosave on change, and render a new `EditorTopBar` plus in-app `ConfirmDialog`/`PublishDialog`. Make `publishDraftAction`/`discardDraftAction`/`restoreRevisionAction` return the resulting sections so the client updates state in place instead of calling `router.refresh()`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, Firestore (Admin SDK), existing `@/components/ui/Toaster`. Verification: `npx tsc --noEmit` + `npm run lint` (+ a final `npm run build`). No unit-test runner in this repo (per project `CLAUDE.md`); behavior is verified manually.

---

## Conventions for every task
- **Verify** = `npx tsc --noEmit` (only the pre-existing `.next/types/validator.ts` error is allowed) and `npm run lint` (no NEW issues on touched files). A full `npm run build` runs in the final review.
- Work on the **current branch** (`claude/site-editor-integration-review-hxEIF`). Don't switch branches.
- Commit-message trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Don't start a task before the previous task's Verify passes.

## File Map (what 1B touches)
| File | Change | Responsibility |
|---|---|---|
| `lib/db/site-content.ts` | modify | `discardDraft`/`publishDraft`/`restoreRevisionToDraft` return the resulting `Section[]` |
| `app/admin/site/actions.ts` | modify | `discardDraftAction`/`publishDraftAction`/`restoreRevisionAction` return `{ sections }` |
| `components/site-editor/useEditorHistory.ts` | create | undo/redo reducer hook (coalesced edits) |
| `components/site-editor/useAutosave.ts` | create | debounced autosave + status machine |
| `components/site-editor/ConfirmDialog.tsx` | create | in-app confirm modal (replaces `confirm()`) |
| `components/site-editor/PublishDialog.tsx` | create | in-app publish-note modal (replaces `prompt()`) |
| `components/site-editor/EditorTopBar.tsx` | create | status + undo/redo + device toggle + Publish/Revisions/Exit (replaces `EditBar`) |
| `components/site-editor/SectionsCanvas.tsx` | modify | refactor `EditModeCanvas` to use the above; device-preview wrapper; remove native dialogs + `router.refresh()` |
| `components/site-editor/EditBar.tsx` | delete | superseded by `EditorTopBar` (after the refactor compiles) |
| `components/site-editor/RevisionsModal.tsx` | modify | use returned sections from restore (no `router.refresh`) |

---

## Task 1: Server actions return resulting sections (enables no-flash)

**Files:** `lib/db/site-content.ts`, `app/admin/site/actions.ts`

- [ ] **Step 1: `lib/db/site-content.ts` — return sections from the three mutators**

`discardDraft` currently returns `void`. Change it to return the published sections it reverted the draft to:
```ts
export async function discardDraft(pageId: string, uid: string): Promise<Section[]> {
  const ref = siteContentCol().doc(pageId);
  const snap = await ref.get();
  if (!snap.exists) return [];
  const data = snap.data() as Omit<SiteContentDoc, "id">;
  const published = data.publishedSections ?? [];
  await ref.update({
    draftSections: published,
    draftDirty: false,
    draftUpdatedAt: FieldValue.serverTimestamp(),
    draftUpdatedByUid: uid,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return published;
}
```
`publishDraft` currently returns `{ revisionId }`. Add the published sections:
```ts
export async function publishDraft(
  pageId: string, uid: string, noteSummary?: string
): Promise<{ revisionId: string; sections: Section[] }> {
  // ...unchanged body until the return...
  await pruneOldRevisions(pageId);
  return { revisionId: revisionRef.id, sections };
}
```
`restoreRevisionToDraft` currently returns `void`. Return the restored sections:
```ts
export async function restoreRevisionToDraft(
  pageId: string, revisionId: string, uid: string
): Promise<Section[]> {
  const revSnap = await revisionsCol(pageId).doc(revisionId).get();
  if (!revSnap.exists) throw new Error(`Revision not found: ${revisionId}`);
  const rev = revSnap.data() as Omit<SiteContentRevisionDoc, "id">;
  await saveDraftSections(pageId, rev.sections, uid);
  return rev.sections;
}
```

- [ ] **Step 2: `app/admin/site/actions.ts` — surface sections in the action results**

Extend the result type and the three actions. Add a type:
```ts
type SectionsResult = { success: true; sections: Section[] } | { success: false; error: string };
```
- `discardDraftAction` → `Promise<SectionsResult>`: capture `const sections = await dbDiscardDraft(pageId, session.uid);` and `return { success: true, sections };` (keep the activity log + revalidatePath calls).
- `publishDraftAction` → `Promise<SectionsResult>`: `const { revisionId, sections } = await dbPublishDraft(...)` and `return { success: true, sections };` (keep logging/revalidate).
- `restoreRevisionAction` → `Promise<SectionsResult>`: `const sections = await restoreRevisionToDraft(...)` and `return { success: true, sections };`.
Keep `saveDraftAction` returning `ActionResult` (no sections needed). Leave `revalidatePath` calls in place — they refresh the *public* route for the next visitor; the editor itself will no longer rely on `router.refresh()`.

- [ ] **Step 3: Verify** — `npx tsc --noEmit` will flag the existing callers in `SectionsCanvas.tsx`/`RevisionsModal.tsx` that consumed the old `{success}` shape; that's expected — they're fixed in Task 6/7. For THIS task, confirm `lib/db/site-content.ts` and `app/admin/site/actions.ts` themselves type-check in isolation by checking the errors are ONLY "property 'sections' ..." at the call sites, not in the two files you edited. Run `npm run lint` on the two files.

- [ ] **Step 4: Commit**
```bash
git add lib/db/site-content.ts app/admin/site/actions.ts
git commit -m "feat(site-editor): publish/discard/restore return resulting sections (no-flash groundwork)"
```

---

## Task 2: `useEditorHistory` — undo/redo reducer with coalesced edits

**Files:** Create `components/site-editor/useEditorHistory.ts`

- [ ] **Step 1: Write the hook**
```ts
"use client";
// components/site-editor/useEditorHistory.ts
// Undo/redo state for the section list. Structural ops (insert/move/delete/
// duplicate/replace) each create one history step. Consecutive field edits to
// the SAME section coalesce into one step (so typing isn't 1 undo per keystroke).
import { useReducer, useCallback } from "react";
import type { Section, SectionType } from "@/lib/site-content/types";

interface HistoryState {
  past: Section[][];
  present: Section[];
  future: Section[][];
  lastTag: string | null; // coalescing key of the last applied edit
}

type Action =
  | { type: "RESET"; sections: Section[] }
  | { type: "REPLACE"; sections: Section[]; tag?: string } // generic structural replace
  | { type: "UPDATE"; id: string; patch: Partial<Section> } // coalesces per id
  | { type: "UNDO" }
  | { type: "REDO" };

function reducer(state: HistoryState, action: Action): HistoryState {
  switch (action.type) {
    case "RESET":
      return { past: [], present: action.sections, future: [], lastTag: null };
    case "REPLACE": {
      return { past: [...state.past, state.present], present: action.sections, future: [], lastTag: action.tag ?? null };
    }
    case "UPDATE": {
      const tag = `update:${action.id}`;
      const nextPresent = state.present.map((s) =>
        s.id === action.id ? ({ ...s, ...action.patch } as Section) : s
      );
      // Coalesce: if the previous step was an edit to the same section, replace
      // present in place without pushing a new past entry.
      if (state.lastTag === tag) {
        return { ...state, present: nextPresent, future: [] };
      }
      return { past: [...state.past, state.present], present: nextPresent, future: [], lastTag: tag };
    }
    case "UNDO": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
        lastTag: null,
      };
    }
    case "REDO": {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        past: [...state.past, state.present],
        present: next,
        future: state.future.slice(1),
        lastTag: null,
      };
    }
    default:
      return state;
  }
}

export function useEditorHistory(initial: Section[]) {
  const [state, dispatch] = useReducer(reducer, {
    past: [], present: initial, future: [], lastTag: null,
  });

  const reset = useCallback((sections: Section[]) => dispatch({ type: "RESET", sections }), []);
  const replace = useCallback((sections: Section[], tag?: string) => dispatch({ type: "REPLACE", sections, tag }), []);
  const updateSection = useCallback((id: string, patch: Partial<Section>) => dispatch({ type: "UPDATE", id, patch }), []);
  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const redo = useCallback(() => dispatch({ type: "REDO" }), []);

  return {
    sections: state.present,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    reset,
    replace,
    updateSection,
    undo,
    redo,
  };
}

// Re-export the type used by callers building structural ops.
export type { SectionType };
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit` (no new errors) + `npm run lint` on the new file.
- [ ] **Step 3: Commit**
```bash
git add components/site-editor/useEditorHistory.ts
git commit -m "feat(site-editor): add useEditorHistory undo/redo reducer"
```

---

## Task 3: `useAutosave` — debounced autosave + status machine

**Files:** Create `components/site-editor/useAutosave.ts`

- [ ] **Step 1: Write the hook**
```ts
"use client";
// components/site-editor/useAutosave.ts
// Debounced autosave for the section list. Calls `save(sections)` ~900ms after
// the last change. Exposes a status the top bar renders. Also exposes flush()
// so Publish can guarantee the latest draft is persisted before publishing.
import { useEffect, useRef, useState, useCallback } from "react";
import type { Section } from "@/lib/site-content/types";

export type SaveStatus = "saved" | "unsaved" | "saving" | "error";

const DEBOUNCE_MS = 900;

export function useAutosave(
  sections: Section[],
  save: (sections: Section[]) => Promise<{ success: boolean; error?: string }>
) {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(sections);
  const firstRun = useRef(true);
  latest.current = sections;

  const doSave = useCallback(async () => {
    setStatus("saving");
    const res = await save(latest.current);
    setStatus(res.success ? "saved" : "error");
  }, [save]);

  useEffect(() => {
    // Don't autosave the initial hydration.
    if (firstRun.current) { firstRun.current = false; return; }
    setStatus("unsaved");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void doSave(); }, DEBOUNCE_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [sections, doSave]);

  // Persist immediately (used before publish). Returns success.
  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    setStatus("saving");
    const res = await save(latest.current);
    setStatus(res.success ? "saved" : "error");
    return res.success;
  }, [save]);

  return { status, flush };
}
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit` + `npm run lint` on the new file.
- [ ] **Step 3: Commit**
```bash
git add components/site-editor/useAutosave.ts
git commit -m "feat(site-editor): add useAutosave debounced-save hook"
```

---

## Task 4: In-app dialogs — `ConfirmDialog` + `PublishDialog`

**Files:** Create `components/site-editor/ConfirmDialog.tsx`, `components/site-editor/PublishDialog.tsx`

Read `components/site-editor/styles.ts` first to reuse `editorStyles` (primaryBtn/secondaryBtn/publishBtn) and match the editor's look. Both dialogs are simple controlled overlays (no portal needed; use a fixed overlay at `zIndex: 8800`, above the top bar's 8600). Close on Escape and on backdrop click.

- [ ] **Step 1: `ConfirmDialog.tsx`**
```tsx
"use client";
// components/site-editor/ConfirmDialog.tsx
import { useEffect } from "react";
import { editorStyles } from "./styles";

export function ConfirmDialog({
  open, title, body, confirmLabel = "Confirm", cancelLabel = "Cancel",
  destructive = false, onConfirm, onCancel,
}: {
  open: boolean; title: string; body?: string;
  confirmLabel?: string; cancelLabel?: string; destructive?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onCancel(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div onClick={onCancel} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={panel} role="dialog" aria-modal="true" aria-label={title}>
        <h3 style={dialogTitle}>{title}</h3>
        {body && <p style={dialogBody}>{body}</p>}
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1.25rem" }}>
          <button type="button" onClick={onCancel} style={editorStyles.secondaryBtn}>{cancelLabel}</button>
          <button type="button" onClick={onConfirm}
            style={destructive ? { ...editorStyles.primaryBtn, background: "#9a3434", borderColor: "#9a3434" } : editorStyles.primaryBtn}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(42,42,40,0.28)", zIndex: 8800, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" };
const panel: React.CSSProperties = { background: "var(--white)", border: "0.5px solid var(--border-strong)", borderRadius: 8, padding: "1.5rem", maxWidth: 420, width: "100%", boxShadow: "0 20px 50px rgba(0,0,0,0.18)" };
const dialogTitle: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: "1.4rem", margin: 0 };
const dialogBody: React.CSSProperties = { fontWeight: 300, lineHeight: 1.7, color: "var(--charcoal-light)", marginTop: "0.5rem", fontSize: "0.92rem" };
```

- [ ] **Step 2: `PublishDialog.tsx`** — same overlay/panel pattern, with an optional changelog `<textarea>`; `onPublish(note?: string)`.
```tsx
"use client";
// components/site-editor/PublishDialog.tsx
import { useEffect, useState } from "react";
import { editorStyles } from "./styles";

export function PublishDialog({
  open, onPublish, onCancel,
}: { open: boolean; onPublish: (note?: string) => void; onCancel: () => void }) {
  const [note, setNote] = useState("");
  useEffect(() => {
    if (!open) return;
    setNote("");
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onCancel(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div onClick={onCancel} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={panel} role="dialog" aria-modal="true" aria-label="Publish page">
        <h3 style={dialogTitle}>Publish this page?</h3>
        <p style={dialogBody}>Your draft will go live immediately. Add an optional note for the revision history.</p>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
          placeholder="e.g. Updated pricing copy" style={textareaStyle} />
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1.25rem" }}>
          <button type="button" onClick={onCancel} style={editorStyles.secondaryBtn}>Cancel</button>
          <button type="button" onClick={() => onPublish(note.trim() || undefined)} style={editorStyles.publishBtn}>Publish now</button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(42,42,40,0.28)", zIndex: 8800, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" };
const panel: React.CSSProperties = { background: "var(--white)", border: "0.5px solid var(--border-strong)", borderRadius: 8, padding: "1.5rem", maxWidth: 460, width: "100%", boxShadow: "0 20px 50px rgba(0,0,0,0.18)" };
const dialogTitle: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: "1.4rem", margin: 0 };
const dialogBody: React.CSSProperties = { fontWeight: 300, lineHeight: 1.7, color: "var(--charcoal-light)", margin: "0.5rem 0 1rem", fontSize: "0.92rem" };
const textareaStyle: React.CSSProperties = { width: "100%", padding: "0.6rem 0.7rem", border: "0.5px solid var(--border-strong)", borderRadius: 4, font: "inherit", fontSize: "0.9rem", resize: "vertical" };
```

- [ ] **Step 3: Verify** — `npx tsc --noEmit` + `npm run lint`. (If `editorStyles` lacks a needed key, use an inline style instead — don't invent keys.)
- [ ] **Step 4: Commit**
```bash
git add components/site-editor/ConfirmDialog.tsx components/site-editor/PublishDialog.tsx
git commit -m "feat(site-editor): add in-app ConfirmDialog + PublishDialog (replace native popups)"
```

---

## Task 5: `EditorTopBar` — status + undo/redo + device toggle + actions

**Files:** Create `components/site-editor/EditorTopBar.tsx` (reuse `EDIT_BAR_HEIGHT`/`editorStyles`)

- [ ] **Step 1: Write the component**
```tsx
"use client";
// components/site-editor/EditorTopBar.tsx
import { editorStyles } from "./styles";
import type { SaveStatus } from "./useAutosave";

export const TOP_BAR_HEIGHT = 56;
export type DeviceMode = "desktop" | "tablet" | "mobile";

const STATUS_TEXT: Record<SaveStatus, string> = {
  saved: "All changes saved", unsaved: "Editing…", saving: "Saving…", error: "Save failed — retrying on next change",
};

export function EditorTopBar({
  pageLabel, status, canUndo, canRedo, device,
  onUndo, onRedo, onDeviceChange, onPublish, onDiscard, onOpenRevisions, onExit,
}: {
  pageLabel: string; status: SaveStatus; canUndo: boolean; canRedo: boolean; device: DeviceMode;
  onUndo: () => void; onRedo: () => void; onDeviceChange: (d: DeviceMode) => void;
  onPublish: () => void; onDiscard: () => void; onOpenRevisions: () => void; onExit: () => void;
}) {
  return (
    <div role="toolbar" aria-label="Site editor" style={bar}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", minWidth: 0 }}>
        <span style={eyebrow}>Editing</span>
        <span style={label}>{pageLabel}</span>
        <span style={{ fontSize: "0.7rem", color: status === "error" ? "#9a3434" : "var(--charcoal-muted)", letterSpacing: "0.06em" }}>
          • {STATUS_TEXT[status]}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <button type="button" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl/Cmd+Z)"
          style={{ ...editorStyles.secondaryBtn, opacity: canUndo ? 1 : 0.4 }}>↶</button>
        <button type="button" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl/Cmd+Shift+Z)"
          style={{ ...editorStyles.secondaryBtn, opacity: canRedo ? 1 : 0.4 }}>↷</button>
        <div role="group" aria-label="Preview width" style={{ display: "flex", border: "0.5px solid var(--border-strong)", borderRadius: 4, overflow: "hidden" }}>
          {(["desktop", "tablet", "mobile"] as DeviceMode[]).map((d) => (
            <button key={d} type="button" onClick={() => onDeviceChange(d)} aria-pressed={device === d}
              title={d} style={{ border: "none", padding: "0.3rem 0.6rem", cursor: "pointer", fontSize: "0.85rem",
                background: device === d ? "var(--olive-dim)" : "transparent", color: "var(--charcoal)" }}>
              {d === "desktop" ? "🖥" : d === "tablet" ? "▭" : "▯"}
            </button>
          ))}
        </div>
        <button type="button" onClick={onOpenRevisions} style={editorStyles.secondaryBtn}>Revisions</button>
        <button type="button" onClick={onDiscard} style={editorStyles.secondaryBtn}>Discard</button>
        <button type="button" onClick={onPublish} style={editorStyles.publishBtn}>Publish</button>
        <button type="button" onClick={onExit} style={editorStyles.secondaryBtn}>Exit</button>
      </div>
    </div>
  );
}

const bar: React.CSSProperties = { position: "sticky", top: 0, zIndex: 8600, height: TOP_BAR_HEIGHT, background: "var(--white)", borderBottom: "0.5px solid var(--border-strong)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 1.25rem", gap: "1rem", boxShadow: "0 1px 0 rgba(42,42,40,0.04)" };
const eyebrow: React.CSSProperties = { fontSize: "0.62rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--olive)" };
const label: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontSize: "1.1rem", fontWeight: 300, color: "var(--charcoal)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit` + `npm run lint`.
- [ ] **Step 3: Commit**
```bash
git add components/site-editor/EditorTopBar.tsx
git commit -m "feat(site-editor): add EditorTopBar (status, undo/redo, device toggle)"
```

---

## Task 6: Refactor `EditModeCanvas` to use the new engine

**Files:** `components/site-editor/SectionsCanvas.tsx` (modify `EditModeCanvas`), then delete `components/site-editor/EditBar.tsx`.

This is the integration task. READ the current `EditModeCanvas` fully first.

- [ ] **Step 1: Swap state for the history hook + autosave**
- Replace `const [sections, setSections] = useState(...)` and the `dirty` state with:
```ts
const { sections, canUndo, canRedo, reset, replace, updateSection: updateSectionH, undo, redo } = useEditorHistory(initialSections);
const saveFn = useCallback((s: Section[]) => saveDraftAction(pageId, JSON.stringify(s)), [pageId]);
const { status, flush } = useAutosave(sections, saveFn);
```
- Keep `selectedId`, `picker`, `showRevisions` as `useState`. Remove `isPending`/`useTransition` and the manual `handleSave`.
- Rewrite the mutation helpers to go through the reducer (all structural ops use `replace(next, tag)`; field edits use `updateSectionH`):
  - `updateSection(id, patch)` → `updateSectionH(id, patch)`
  - `insertSection`, `moveSection`, `duplicateSection`, `deleteSection`, `handlePhotoSelected` → compute the next array (same logic as today) then `replace(next, "<op>")` and set `selectedId` as before.
- Keep the `useEffect([initialSections])` re-sync but call `reset(initialSections)` instead of `setSections`.

- [ ] **Step 2: Keyboard undo/redo + beforeunload**
```ts
useEffect(() => {
  function onKey(e: KeyboardEvent) {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    if (e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
    else if ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
  }
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, [undo, redo]);
```
Keep a `beforeunload` guard, but key it off `status` (`"saving" || "unsaved"`) instead of `dirty`.

- [ ] **Step 3: Replace native dialogs with in-app dialogs**
- Add state: `const [confirm, setConfirm] = useState<{title:string;body?:string;destructive?:boolean;onConfirm:()=>void}|null>(null);` and `const [publishOpen, setPublishOpen] = useState(false);`.
- `deleteSection`: instead of `confirm(...)`, open the ConfirmDialog (`setConfirm({ title:"Delete this section?", destructive:true, onConfirm: () => { replace(next,"delete"); ... } })`).
- `handleDiscard`: open ConfirmDialog ("Discard unsaved changes and revert to the published version?"); onConfirm calls `discardDraftAction(pageId)` and, on success, `reset(res.sections)` (NO `router.refresh()`), toast "Draft discarded."
- `handlePublish`: open `PublishDialog`. Its `onPublish(note)` first `await flush()` (ensure latest draft saved); if flush failed, toast + abort; else `const res = await publishDraftAction(pageId, note)`; on success `reset(res.sections)` and toast "Published." (No dirty-gate, no `router.refresh()`.)

- [ ] **Step 4: Device-preview wrapper + EditorTopBar**
- Add `const [device, setDevice] = useState<DeviceMode>("desktop");`.
- Replace `<EditBar .../>` with `<EditorTopBar pageLabel={pageLabel} status={status} canUndo={canUndo} canRedo={canRedo} device={device} onUndo={undo} onRedo={redo} onDeviceChange={setDevice} onPublish={() => setPublishOpen(true)} onDiscard={handleDiscard} onOpenRevisions={() => setShowRevisions(true)} onExit={handleExit} />`.
- `handleExit`: if `status === "unsaved" || status === "saving"`, open a ConfirmDialog ("Exit editing? Your latest change may not be saved.") whose onConfirm calls `onExit()`; otherwise call `onExit()` directly.
- Wrap the sections list in a width-constrained container driven by `device`:
```tsx
const DEVICE_WIDTH: Record<DeviceMode, string> = { desktop: "100%", tablet: "768px", mobile: "390px" };
// around the mapped sections:
<div style={{ maxWidth: DEVICE_WIDTH[device], margin: "0 auto", transition: "max-width 0.25s ease", boxShadow: device === "desktop" ? "none" : "0 0 0 1px var(--border)" }}>
  {/* existing AddSectionGap + SectionWrapper map + empty-state */}
</div>
```
- Render `<ConfirmDialog open={!!confirm} ... />` and `<PublishDialog open={publishOpen} onPublish={...} onCancel={() => setPublishOpen(false)} />` near the other overlays.

- [ ] **Step 5: Update `RevisionsModal` usage (no-flash restore)**
- `RevisionsModal`'s `onRestored` currently triggers `router.refresh()` via the parent. Change `EditModeCanvas` to pass an `onRestored={(sections) => reset(sections)}`-style callback, and update `RevisionsModal.tsx` so that after `restoreRevisionAction` succeeds it calls `onRestored(res.sections)` (read the current `RevisionsModal.tsx` and adapt its prop type from `() => void` to `(sections: Section[]) => void`). Remove the now-unused `onAfterPublishOrRestore`/`router.refresh()` path in `SectionsCanvas`.

- [ ] **Step 6: Delete `EditBar.tsx`**
After the refactor compiles and no file imports `EditBar`, `git rm components/site-editor/EditBar.tsx`. (Keep `EDIT_BAR_HEIGHT` only if still referenced — the new bar exports `TOP_BAR_HEIGHT`; update the one consumer that padded the canvas by `EDIT_BAR_HEIGHT` to use `TOP_BAR_HEIGHT`.)

- [ ] **Step 7: Verify** — `npx tsc --noEmit` (only the pre-existing error), `npm run lint` (no new issues). Manually confirm in reasoning: no remaining `confirm(`/`prompt(`/`router.refresh(` in `SectionsCanvas.tsx`.
- [ ] **Step 8: Commit**
```bash
git add components/site-editor/SectionsCanvas.tsx components/site-editor/RevisionsModal.tsx
git rm components/site-editor/EditBar.tsx
git commit -m "feat(site-editor): autosave + undo/redo + in-app dialogs + device preview engine"
```

---

## Self-Review (completed)
- **Spec coverage:** autosave + status (Tasks 3,6), undo/redo + keyboard (Tasks 2,6), in-app dialogs replacing `confirm`/`prompt` (Tasks 4,6), no-flash publish/discard/restore (Tasks 1,6, RevisionsModal), one-click publish via flush-then-publish (Task 6 Step 3), device preview (Tasks 5,6). `EditBar` retired (Task 6 Step 6).
- **Out of scope (Slice 1C):** inline text editing, drag-and-drop reorder, the add-section gallery modal, image-replace picker + focal-point UI, floating per-section toolbar. The existing `SectionWrapper`/`AddSectionGap`/`SectionDrawer`/`PhotoPicker` remain the interaction surface in 1B.
- **Type consistency:** `SaveStatus` (useAutosave) consumed by EditorTopBar; `DeviceMode` defined in EditorTopBar and used by SectionsCanvas; `SectionsResult.sections` returned by the three actions and consumed via `reset(res.sections)`; reducer `replace(next, tag)` vs `updateSection(id, patch)` used consistently.
- **Placeholders:** none — full code given for the new modules; the only "read first" steps are for adapting the existing `EditModeCanvas`/`RevisionsModal` whose current code must be edited in place.

## Follow-on
- **Slice 1C — direct manipulation:** editable render layer (`Editable` primitive + edit context in `render.tsx`), `TextFormatToolbar` + server-side HTML sanitization, `SectionToolbar` (floating + `@dnd-kit` drag), `AddSectionModal` (guided gallery), image-replace via upgraded `PhotoPicker` + focal-point control.
