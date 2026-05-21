// lib/site-content/types.ts
// Section discriminated union for the site editor.
// Pure types module — safe to import from server OR client components.

export type SectionType =
  | "HERO"
  | "PHOTO_GRID"
  | "RICH_TEXT"
  | "CTA_BANNER";

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

export type Section =
  | HeroSection
  | PhotoGridSection
  | RichTextSection
  | CtaBannerSection;

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
