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
//       - sticky EditBar at the top (Save / Publish / Discard / Revisions)
//       - per-section hover outline + select toolbar (SectionWrapper)
//       - "+ Add section" gap between sections (AddSectionGap)
//       - right-side property drawer (SectionDrawer)
//
// One React tree, one window. No iframe, no postMessage bridge — the canvas
// IS the source of truth, so every keystroke in the drawer updates the
// rendered page live.

import { useState, useTransition, useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "@/components/ui/Toaster";
import { PhotoPicker } from "@/components/admin/PhotoPicker";
import { renderSection, renderSections } from "@/lib/site-content/render";
import type { Section, SectionType, PhotoRef } from "@/lib/site-content/types";
import { getPageDefinition, CUSTOM_PAGE_ALLOWED_SECTIONS } from "@/lib/site-content/page-registry";
import { saveDraftAction, discardDraftAction, publishDraftAction } from "@/app/admin/site/actions";

import { EditBar, EDIT_BAR_HEIGHT } from "./EditBar";
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
      onAfterPublishOrRestore={() => router.refresh()}
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
  onAfterPublishOrRestore,
}: {
  pageId: string;
  pageLabel: string;
  initialSections: Section[];
  pickerData: PickerData;
  allowedSections: readonly SectionType[];
  onExit: () => void;
  onAfterPublishOrRestore: () => void;
}) {
  const [sections, setSections] = useState<Section[]>(initialSections);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [picker, setPicker] = useState<PickerSlot | null>(null);
  const [showRevisions, setShowRevisions] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Re-sync if the parent rehydrates after publish/restore.
  useEffect(() => {
    setSections(initialSections);
    setDirty(false);
  }, [initialSections]);

  // Beforeunload guard for unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const selected = useMemo(
    () => sections.find((s) => s.id === selectedId) ?? null,
    [sections, selectedId]
  );

  function updateSection(id: string, patch: Partial<Section>) {
    setSections((prev) => prev.map((s) => (s.id === id ? ({ ...s, ...patch } as Section) : s)));
    setDirty(true);
  }

  function insertSection(type: SectionType, atIndex: number) {
    const s = blank(type);
    setSections((prev) => {
      const next = [...prev];
      next.splice(atIndex, 0, s);
      return next;
    });
    setSelectedId(s.id);
    setDirty(true);
  }

  function moveSection(id: string, dir: -1 | 1) {
    setSections((prev) => {
      const i = prev.findIndex((s) => s.id === id);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(i, 1);
      next.splice(j, 0, item);
      return next;
    });
    setDirty(true);
  }

  function duplicateSection(id: string) {
    setSections((prev) => {
      const i = prev.findIndex((s) => s.id === id);
      if (i < 0) return prev;
      const clone = { ...prev[i], id: makeId(prev[i].type) } as Section;
      const next = [...prev];
      next.splice(i + 1, 0, clone);
      return next;
    });
    setDirty(true);
  }

  function deleteSection(id: string) {
    if (!confirm("Delete this section?")) return;
    setSections((prev) => prev.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
    setDirty(true);
  }

  function handlePhotoSelected(ref: PhotoRef) {
    if (!picker) return;
    const target = sections.find((s) => s.id === picker.sectionId);
    if (!target) {
      setPicker(null);
      return;
    }
    const updated = applyPickedPhoto(target, picker, ref);
    setSections((prev) => prev.map((s) => (s.id === target.id ? updated : s)));
    setDirty(true);
    setPicker(null);
  }

  function handleSave() {
    const payload = JSON.stringify(sections);
    startTransition(async () => {
      const res = await saveDraftAction(pageId, payload);
      if (!res.success) {
        toast(res.error ?? "Save failed.");
        return;
      }
      setDirty(false);
      toast("Draft saved.");
    });
  }

  function handleDiscard() {
    if (!confirm("Discard unsaved changes and revert to the published version?")) return;
    startTransition(async () => {
      const res = await discardDraftAction(pageId);
      if (!res.success) {
        toast(res.error ?? "Discard failed.");
        return;
      }
      toast("Draft discarded.");
      onAfterPublishOrRestore();
    });
  }

  function handlePublish() {
    if (dirty) {
      toast("Save your draft before publishing.");
      return;
    }
    const note = prompt("Optional changelog note for this publish:") ?? undefined;
    startTransition(async () => {
      const res = await publishDraftAction(pageId, note?.trim() || undefined);
      if (!res.success) {
        toast(res.error ?? "Publish failed.");
        return;
      }
      toast("Published.");
      onAfterPublishOrRestore();
    });
  }

  return (
    <>
      <EditBar
        pageLabel={pageLabel}
        dirty={dirty}
        saving={isPending}
        onSaveDraft={handleSave}
        onPublish={handlePublish}
        onDiscard={handleDiscard}
        onOpenRevisions={() => setShowRevisions(true)}
        onExit={() => {
          if (dirty && !confirm("Exit edit mode? Your unsaved changes will be lost.")) return;
          onExit();
        }}
      />

      {/* Push the canvas down so the sticky bar never covers the top of a hero. */}
      <div style={{ paddingTop: EDIT_BAR_HEIGHT }}>
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

      <SectionDrawer
        section={selected}
        onChange={(patch) => {
          if (!selected) return;
          updateSection(selected.id, patch);
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
        onRestored={onAfterPublishOrRestore}
      />
    </>
  );
}
