"use client";

// components/site-editor/SectionDrawer.tsx
// Right-side property drawer that overlays the public page. The drawer never
// reduces page width — it slides over the canvas so what the admin sees is
// what visitors will see at full bleed.

import type {
  Section,
  PhotoRef,
  HeroSection,
  PhotoGridSection,
  RichTextSection,
  CtaBannerSection,
  ProcessStepsSection,
  PackageCardsSection,
  TestimonialSection,
  SlideshowSection,
  StatsSection,
} from "@/lib/site-content/types";
import { SECTION_LABEL } from "./styles";
import { HeroForm } from "./forms/HeroForm";
import { PhotoGridForm } from "./forms/PhotoGridForm";
import { RichTextForm } from "./forms/RichTextForm";
import { CtaBannerForm } from "./forms/CtaBannerForm";
import { ProcessStepsForm } from "./forms/ProcessStepsForm";
import { PackageCardsForm } from "./forms/PackageCardsForm";
import { TestimonialForm } from "./forms/TestimonialForm";
import { SlideshowForm } from "./forms/SlideshowForm";
import { StatsForm } from "./forms/StatsForm";

export type PickerSlot =
  | { sectionId: string; slot: "HERO_SLIDE"; index?: number }
  | { sectionId: string; slot: "GRID_PHOTO"; index?: number }
  | { sectionId: string; slot: "SLIDESHOW_SLIDE"; index?: number };

export function SectionDrawer({
  section,
  onChange,
  onClose,
  onRequestPicker,
}: {
  section: Section | null;
  onChange: (patch: Partial<Section>) => void;
  onClose: () => void;
  onRequestPicker: (slot: PickerSlot) => void;
}) {
  const open = section !== null;

  return (
    <aside
      aria-hidden={!open}
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: 360,
        maxWidth: "92vw",
        background: "var(--white)",
        borderLeft: "0.5px solid var(--border-strong)",
        boxShadow: open ? "-12px 0 32px rgba(42,42,40,0.06)" : "none",
        transform: open ? "translateX(0)" : "translateX(110%)",
        transition: "transform 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        zIndex: 8500,
        display: "flex",
        flexDirection: "column",
        pointerEvents: open ? "auto" : "none",
      }}
    >
      <header
        style={{
          padding: "1rem 1.25rem",
          borderBottom: "0.5px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "1.25rem",
            fontWeight: 300,
          }}
        >
          {section ? SECTION_LABEL[section.type] : ""}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close section editor"
          style={{
            background: "transparent",
            border: "none",
            fontSize: "0.7rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--charcoal-muted)",
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem" }}>
        {section?.type === "HERO" && (
          <HeroForm
            section={section as HeroSection}
            onChange={(patch) => onChange(patch as Partial<Section>)}
            onPickSlide={(i) => onRequestPicker({ sectionId: section.id, slot: "HERO_SLIDE", index: i })}
            onPickAdd={() => onRequestPicker({ sectionId: section.id, slot: "HERO_SLIDE" })}
          />
        )}
        {section?.type === "PHOTO_GRID" && (
          <PhotoGridForm
            section={section as PhotoGridSection}
            onChange={(patch) => onChange(patch as Partial<Section>)}
            onPickPhoto={(i) => onRequestPicker({ sectionId: section.id, slot: "GRID_PHOTO", index: i })}
            onPickAdd={() => onRequestPicker({ sectionId: section.id, slot: "GRID_PHOTO" })}
          />
        )}
        {section?.type === "RICH_TEXT" && (
          <RichTextForm section={section as RichTextSection} onChange={(patch) => onChange(patch as Partial<Section>)} />
        )}
        {section?.type === "CTA_BANNER" && (
          <CtaBannerForm section={section as CtaBannerSection} onChange={(patch) => onChange(patch as Partial<Section>)} />
        )}
        {section?.type === "PROCESS_STEPS" && (
          <ProcessStepsForm section={section as ProcessStepsSection} onChange={(patch) => onChange(patch as Partial<Section>)} />
        )}
        {section?.type === "PACKAGE_CARDS" && (
          <PackageCardsForm section={section as PackageCardsSection} onChange={(patch) => onChange(patch as Partial<Section>)} />
        )}
        {section?.type === "TESTIMONIAL" && (
          <TestimonialForm section={section as TestimonialSection} onChange={(patch) => onChange(patch as Partial<Section>)} />
        )}
        {section?.type === "SLIDESHOW" && (
          <SlideshowForm
            section={section as SlideshowSection}
            onChange={(patch) => onChange(patch as Partial<Section>)}
            onPickSlide={(i) => onRequestPicker({ sectionId: section.id, slot: "SLIDESHOW_SLIDE", index: i })}
            onPickAdd={() => onRequestPicker({ sectionId: section.id, slot: "SLIDESHOW_SLIDE" })}
          />
        )}
        {section?.type === "STATS" && (
          <StatsForm section={section as StatsSection} onChange={(patch) => onChange(patch as Partial<Section>)} />
        )}
      </div>
    </aside>
  );
}

// Re-exported so SectionsCanvas can route a PhotoPicker selection back to the
// right section without re-deriving the shape itself.
export function applyPickedPhoto(section: Section, slot: PickerSlot, ref: PhotoRef): Section {
  if (section.type === "HERO" && slot.slot === "HERO_SLIDE") {
    const slides = [...section.slides];
    if (slot.index != null) slides[slot.index] = { photoRef: ref };
    else slides.push({ photoRef: ref });
    return { ...section, slides };
  }
  if (section.type === "PHOTO_GRID" && slot.slot === "GRID_PHOTO") {
    const photos = [...section.photos];
    if (slot.index != null) photos[slot.index] = ref;
    else photos.push(ref);
    return { ...section, photos };
  }
  if (section.type === "SLIDESHOW" && slot.slot === "SLIDESHOW_SLIDE") {
    const slides = [...section.slides];
    if (slot.index != null) slides[slot.index] = ref;
    else slides.push(ref);
    return { ...section, slides };
  }
  return section;
}
