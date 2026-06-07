"use client";

// components/site-editor/SectionsCanvas.tsx
//
// The one component the public pages render. It has two modes:
//
//   • Public mode (default, or admin who hasn't entered edit mode):
//     just renders the sections via the same renderSections() that
//     visitors see. Adds a small floating "Edit this page" pill if the
//     viewer is an admin.
//
//   • Edit mode (admin + ?edit=1): renders the SAME sections at the SAME
//     full-page width, wrapped in admin-only chrome:
//       - sticky EditorTopBar at the top (status / undo/redo / device / Publish / Discard / Revisions / Exit)
//       - per-section hover outline + select toolbar (SectionWrapper)
//       - "+ Add section" gap between sections (AddSectionGap)
//       - right-side property drawer (SectionDrawer)
//
// One React tree, one window. No iframe, no postMessage bridge — the canvas
// IS the source of truth, so every keystroke in the drawer updates the
// rendered page live.

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "@/components/ui/Toaster";
import { PhotoPicker } from "@/components/admin/PhotoPicker";
import { renderSection, renderSections } from "@/lib/site-content/render";
import type { Section, SectionType, PhotoRef } from "@/lib/site-content/types";
import { getPageDefinition, CUSTOM_PAGE_ALLOWED_SECTIONS } from "@/lib/site-content/page-registry";
import { saveDraftAction, discardDraftAction, publishDraftAction } from "@/app/admin/site/actions";

import { useEditorHistory } from "./useEditorHistory";
import { useAutosave } from "./useAutosave";
import { EditorTopBar, TOP_BAR_HEIGHT } from "./EditorTopBar";
import type { DeviceMode } from "./EditorTopBar";
import { ConfirmDialog } from "./ConfirmDialog";
import { PublishDialog } from "./PublishDialog";
import { SectionWrapper } from "./SectionWrapper";
import { AddSectionGap } from "./AddSectionGap";
import { SectionDrawer, applyPickedPhoto, type PickerSlot } from "./SectionDrawer";
import { RevisionsModal } from "./RevisionsModal";
import { FloatingEditPill } from "./FloatingEditPill";

interface PickerData {
  siteAssets: { id: string; cloudflareImageId: string; label: string; altText: string }[];
  projectPhotos: { photoId: string; eventId: string; cloudflareImageId: string; label: string | null; category: string | null }[];
}

interface Props {
  pageId: string;
  pageLabel: string;
  initialSections: Section[];
  isAdmin: boolean;
  editParam: boolean;
  pickerData: PickerData;
  /** Custom-page allowed sections override (when the slug isn't in the registry). */
  allowedSectionsOverride?: readonly SectionType[];
}

function makeId(type: SectionType): string {
  return `${type.toLowerCase()}-${Math.random().toString(36).slice(2, 9)}`;
}

function blank(type: SectionType): Section {
  switch (type) {
    case "HERO":
      return { id: makeId("HERO"), type: "HERO", slides: [], headline: "Your headline" };
    case "PHOTO_GRID":
      return { id: makeId("PHOTO_GRID"), type: "PHOTO_GRID", columns: 3, photos: [] };
    case "RICH_TEXT":
      return { id: makeId("RICH_TEXT"), type: "RICH_TEXT", body: "Write something here." };
    case "CTA_BANNER":
      return { id: makeId("CTA_BANNER"), type: "CTA_BANNER", headline: "Your headline", variant: "DARK" };
    case "PROCESS_STEPS":
      return {
        id: makeId("PROCESS_STEPS"),
        type: "PROCESS_STEPS",
        steps: [
          { n: "01", title: "Step one", body: "Describe the first step here." },
          { n: "02", title: "Step two", body: "Describe the second step here." },
        ],
      };
    case "PACKAGE_CARDS":
      return { id: makeId("PACKAGE_CARDS"), type: "PACKAGE_CARDS", packages: [] };
    case "TESTIMONIAL":
      return { id: makeId("TESTIMONIAL"), type: "TESTIMONIAL", quote: "A real testimonial will live here.", variant: "DARK" };
    case "SLIDESHOW":
      return { id: makeId("SLIDESHOW"), type: "SLIDESHOW", slides: [], intervalMs: 5000 };
    case "STATS":
      return {
        id: makeId("STATS"),
        type: "STATS",
        items: [
          { number: "0+", label: "Sessions" },
          { number: "0", label: "Years" },
          { number: "0%", label: "Satisfaction" },
        ],
      };
    case "BOOKING_FORM":
      return { id: makeId("BOOKING_FORM"), type: "BOOKING_FORM", heading: "Book your session", intro: "Tell me about your session and I'll be in touch." };
  }
}

const DEVICE_WIDTH: Record<DeviceMode, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px",
};

export function SectionsCanvas({
  pageId,
  pageLabel,
  initialSections,
  isAdmin,
  editParam,
  pickerData,
  allowedSectionsOverride,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const editing = isAdmin && editParam;

  // ─── Non-edit render path (everyone, plus admins not in edit mode) ──
  if (!editing) {
    return (
      <>
        {renderSections(initialSections)}
        {isAdmin && <FloatingEditPill pageLabel={pageLabel} />}
      </>
    );
  }

  // ─── Edit mode ────────────────────────────────────────────────────────
  return (
    <EditModeCanvas
      pageId={pageId}
      pageLabel={pageLabel}
      initialSections={initialSections}
      pickerData={pickerData}
      allowedSections={allowedSectionsOverride ?? getPageDefinition(pageId)?.allowedSections ?? CUSTOM_PAGE_ALLOWED_SECTIONS}
      onExit={() => router.push(pathname)}
    />
  );
}

function EditModeCanvas({
  pageId,
  pageLabel,
  initialSections,
  pickerData,
  allowedSections,
  onExit,
}: {
  pageId: string;
  pageLabel: string;
  initialSections: Section[];
  pickerData: PickerData;
  allowedSections: readonly SectionType[];
  onExit: () => void;
}) {
  // ─── History + autosave ───────────────────────────────────────────────
  const { sections, canUndo, canRedo, reset, replace, updateSection: updateSectionH, undo, redo } =
    useEditorHistory(initialSections);

  const saveFn = useCallback(
    (s: Section[]) => saveDraftAction(pageId, JSON.stringify(s)),
    [pageId]
  );
  const { status, flush, suppressNext } = useAutosave(sections, saveFn);

  // ─── Local UI state ───────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [picker, setPicker] = useState<PickerSlot | null>(null);
  const [showRevisions, setShowRevisions] = useState(false);
  const [device, setDevice] = useState<DeviceMode>("desktop");

  // In-app dialog state (replaces native confirm/prompt)
  const [confirmState, setConfirmState] = useState<{
    title: string;
    body?: string;
    destructive?: boolean;
    onConfirm: () => void;
  } | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Re-sync if the parent rehydrates (e.g. server-side initialSections changes).
  // NOTE: assumes SectionsCanvas is only re-mounted/re-parented on navigation,
  // not on every parent re-render — so this won't clobber history mid-edit.
  useEffect(() => {
    reset(initialSections);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSections]);

  // Beforeunload guard for unsaved / in-flight changes.
  useEffect(() => {
    if (status !== "unsaved" && status !== "saving") return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [status]);

  // Keyboard undo / redo — suppressed while any dialog is open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (confirmState || publishOpen) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, confirmState, publishOpen]);

  const selected = useMemo(
    () => sections.find((s) => s.id === selectedId) ?? null,
    [sections, selectedId]
  );

  // ─── Mutation helpers (all go through the reducer) ────────────────────

  function insertSection(type: SectionType, atIndex: number) {
    const s = blank(type);
    const next = [...sections];
    next.splice(atIndex, 0, s);
    replace(next, "insert");
    setSelectedId(s.id);
  }

  function moveSection(id: string, dir: -1 | 1) {
    const i = sections.findIndex((s) => s.id === id);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= sections.length) return;
    const next = [...sections];
    const [item] = next.splice(i, 1);
    next.splice(j, 0, item);
    replace(next, "move");
  }

  function duplicateSection(id: string) {
    const i = sections.findIndex((s) => s.id === id);
    if (i < 0) return;
    const clone = { ...sections[i], id: makeId(sections[i].type) } as Section;
    const next = [...sections];
    next.splice(i + 1, 0, clone);
    replace(next, "duplicate");
  }

  function deleteSection(id: string) {
    const filtered = sections.filter((s) => s.id !== id);
    setConfirmState({
      title: "Delete this section?",
      destructive: true,
      onConfirm: () => {
        replace(filtered, "delete");
        if (selectedId === id) setSelectedId(null);
      },
    });
  }

  function handlePhotoSelected(ref: PhotoRef) {
    if (!picker) return;
    const target = sections.find((s) => s.id === picker.sectionId);
    if (!target) {
      setPicker(null);
      return;
    }
    const updated = applyPickedPhoto(target, picker, ref);
    const next = sections.map((s) => (s.id === target.id ? updated : s));
    replace(next, "photo");
    setPicker(null);
  }

  // ─── Top-level actions ─────────────────────────────────────────────────

  function handleDiscard() {
    setConfirmState({
      title: "Discard draft?",
      body: "Discard unsaved changes and revert to the published version?",
      destructive: true,
      onConfirm: async () => {
        const res = await discardDraftAction(pageId);
        if (!res.success) {
          toast(res.error ?? "Discard failed.");
          return;
        }
        suppressNext();
        reset(res.sections);
        toast("Draft discarded.");
      },
    });
  }

  function handleExit() {
    if (status === "unsaved" || status === "saving") {
      setConfirmState({
        title: "Exit editing?",
        body: "Your latest change may not be saved.",
        onConfirm: () => onExit(),
      });
    } else {
      onExit();
    }
  }

  // Publish: flush latest draft first, then publish. Dialog stays open on
  // failure (note is preserved) and only closes on success.
  async function doPublish(note?: string) {
    setPublishing(true);
    const ok = await flush();
    if (!ok) { toast("Couldn't save your draft — please try again."); setPublishing(false); return; }
    const res = await publishDraftAction(pageId, note);
    setPublishing(false);
    if (!res.success) { toast(res.error ?? "Publish failed."); return; } // keep dialog OPEN
    suppressNext();
    reset(res.sections);
    setPublishOpen(false);
    toast("Published.");
  }

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <>
      <EditorTopBar
        pageLabel={pageLabel}
        status={status}
        canUndo={canUndo}
        canRedo={canRedo}
        device={device}
        onUndo={undo}
        onRedo={redo}
        onDeviceChange={setDevice}
        onPublish={() => setPublishOpen(true)}
        onDiscard={handleDiscard}
        onOpenRevisions={() => setShowRevisions(true)}
        onExit={handleExit}
      />

      {/* Push the canvas down so the sticky bar never covers the top of a hero. */}
      <div style={{ paddingTop: TOP_BAR_HEIGHT }}>
        {/* Device-preview width constraint */}
        <div
          style={{
            maxWidth: DEVICE_WIDTH[device],
            margin: "0 auto",
            transition: "max-width 0.25s ease",
            boxShadow: device === "desktop" ? "none" : "0 0 0 1px var(--border)",
          }}
        >
          <AddSectionGap index={0} allowedSections={allowedSections} onInsert={insertSection} />
          {sections.map((s, i) => (
            <div key={s.id}>
              <SectionWrapper
                sectionId={s.id}
                selected={selectedId === s.id}
                isFirst={i === 0}
                isLast={i === sections.length - 1}
                onSelect={() => setSelectedId(s.id)}
                onMoveUp={() => moveSection(s.id, -1)}
                onMoveDown={() => moveSection(s.id, 1)}
                onDuplicate={() => duplicateSection(s.id)}
                onDelete={() => deleteSection(s.id)}
              >
                {renderSection(s)}
              </SectionWrapper>
              <AddSectionGap index={i + 1} allowedSections={allowedSections} onInsert={insertSection} />
            </div>
          ))}

          {sections.length === 0 && (
            <div
              style={{
                padding: "5rem 4rem",
                textAlign: "center",
                color: "var(--charcoal-muted)",
                border: "0.5px dashed var(--border-strong)",
                margin: "4rem 4rem 0",
              }}
            >
              <p style={{ fontSize: "0.9rem", lineHeight: 1.7, margin: 0 }}>
                This page has no sections yet. Use the &ldquo;+ Add section&rdquo; line above to insert your first one.
              </p>
            </div>
          )}
        </div>
      </div>

      <SectionDrawer
        section={selected}
        onChange={(patch) => {
          if (!selected) return;
          updateSectionH(selected.id, patch);
        }}
        onClose={() => setSelectedId(null)}
        onRequestPicker={(slot) => setPicker(slot)}
      />

      <PhotoPicker
        open={picker !== null}
        onClose={() => setPicker(null)}
        onSelect={handlePhotoSelected}
        initialData={pickerData}
      />

      <RevisionsModal
        pageId={pageId}
        open={showRevisions}
        onClose={() => setShowRevisions(false)}
        onRestored={(restoredSections) => { suppressNext(); reset(restoredSections); }}
      />

      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.title ?? ""}
        body={confirmState?.body}
        destructive={confirmState?.destructive}
        onConfirm={() => {
          confirmState?.onConfirm();
          setConfirmState(null);
        }}
        onCancel={() => setConfirmState(null)}
      />

      <PublishDialog
        open={publishOpen}
        isPending={publishing}
        onPublish={doPublish}
        onCancel={() => { if (!publishing) setPublishOpen(false); }}
      />
    </>
  );
}
