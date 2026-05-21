// lib/site-content/types.ts
// Section discriminated union for the site editor.
// Pure types module — safe to import from server OR client components.

export type SectionType =
  | "HERO"
  | "PHOTO_GRID"
  | "RICH_TEXT"
  | "CTA_BANNER"
  | "PROCESS_STEPS"
  | "PACKAGE_CARDS"
  | "TESTIMONIAL"
  | "SLIDESHOW"
  | "STATS";

export type PhotoSource = "PROJECT" | "SITE";

export interface PhotoRef {
  source: PhotoSource;
  id: string;
  cloudflareImageId: string;
  eventId?: string;
  altText?: string;
}

export interface HeroSlide {
  photoRef: PhotoRef;
  caption?: string;
}

export interface HeroSection {
  id: string;
  type: "HERO";
  slides: HeroSlide[];
  eyebrow?: string;
  headline?: string;
  sub?: string;
  primaryCtaLabel?: string;
  primaryCtaHref?: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
}

export interface PhotoGridSection {
  id: string;
  type: "PHOTO_GRID";
  eyebrow?: string;
  heading?: string;
  body?: string;
  columns: 2 | 3 | 4;
  photos: PhotoRef[];
}

export interface RichTextSection {
  id: string;
  type: "RICH_TEXT";
  eyebrow?: string;
  heading?: string;
  body: string;
}

export interface CtaBannerSection {
  id: string;
  type: "CTA_BANNER";
  eyebrow?: string;
  headline: string;
  primaryCtaLabel?: string;
  primaryCtaHref?: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
  variant?: "DARK" | "LIGHT";
}

// ─── Phase 1 — structured section types ──────────────────────────────────

export interface ProcessStep {
  n: string;       // e.g. "01"
  title: string;
  body: string;
}

export interface ProcessStepsSection {
  id: string;
  type: "PROCESS_STEPS";
  eyebrow?: string;
  heading?: string;
  intro?: string;
  steps: ProcessStep[];
}

export interface PackageCard {
  id: string;             // slug-ish, used by the booking form's ?package=
  name: string;
  startingPriceUsd: number;
  sessionType: string;    // session-type the booking form should prefill
  includes: string[];
  idealFor: string;
  ctaLabel?: string;
}

export interface PackageCardsSection {
  id: string;
  type: "PACKAGE_CARDS";
  eyebrow?: string;
  heading?: string;
  intro?: string;
  packages: PackageCard[];
}

export interface TestimonialSection {
  id: string;
  type: "TESTIMONIAL";
  eyebrow?: string;
  quote: string;
  author?: string;
  authorRole?: string;
  variant?: "DARK" | "LIGHT";
}

export interface SlideshowSection {
  id: string;
  type: "SLIDESHOW";
  eyebrow?: string;
  heading?: string;
  slides: PhotoRef[];
  intervalMs?: number;    // defaults to 5000
}

export interface StatRow {
  number: string;         // "340+", "12", "98%"
  label: string;
}

export interface StatsSection {
  id: string;
  type: "STATS";
  items: StatRow[];
}

export type Section =
  | HeroSection
  | PhotoGridSection
  | RichTextSection
  | CtaBannerSection
  | ProcessStepsSection
  | PackageCardsSection
  | TestimonialSection
  | SlideshowSection
  | StatsSection;

export type SectionDraft = Section;

export function isPhotoRef(value: unknown): value is PhotoRef {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    (v.source === "PROJECT" || v.source === "SITE") &&
    typeof v.id === "string" &&
    typeof v.cloudflareImageId === "string"
  );
}
