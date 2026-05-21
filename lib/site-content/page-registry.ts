// lib/site-content/page-registry.ts
// Per-page allow-list of section types. Adding a new editable page = adding a row here.
// Pure types module — safe to import from server OR client.

import type { SectionType } from "./types";

export interface PageDefinition {
  id: string;
  label: string;
  publicHref: string;
  description: string;
  allowedSections: readonly SectionType[];
}

// Built-in pages. Each gets a fixed `pageId` (= `siteContent/{id}` doc id);
// `allowedSections` constrains the editor's "+ Add section" menu. Custom
// admin-created pages live in the same `siteContent` collection but are
// addressed by their slug and aren't listed here — see `app/[slug]/page.tsx`.
export const SITE_PAGES: readonly PageDefinition[] = [
  {
    id: "home",
    label: "Home",
    publicHref: "/",
    description: "Landing page — hero slideshow, selected work, stats, closing CTA.",
    allowedSections: ["HERO", "PHOTO_GRID", "SLIDESHOW", "STATS", "RICH_TEXT", "CTA_BANNER"] as const,
  },
  {
    id: "investment",
    label: "Investment / Pricing",
    publicHref: "/investment",
    description: "Process steps, package cards, testimonial, closing CTA.",
    allowedSections: ["HERO", "PROCESS_STEPS", "PACKAGE_CARDS", "TESTIMONIAL", "CTA_BANNER", "RICH_TEXT"] as const,
  },
  {
    id: "portfolio",
    label: "Portfolio",
    publicHref: "/portfolio",
    description: "Editorial showcase. The category filter is driven by the photos themselves.",
    allowedSections: ["HERO", "PHOTO_GRID", "RICH_TEXT", "CTA_BANNER"] as const,
  },
  {
    id: "about",
    label: "About",
    publicHref: "/about",
    description: "Long-form story page. Free-form prose + supporting imagery.",
    allowedSections: ["HERO", "RICH_TEXT", "PHOTO_GRID", "CTA_BANNER"] as const,
  },
  {
    id: "footer",
    label: "Footer",
    publicHref: "/",
    description: "Global footer rendered at the bottom of every page.",
    allowedSections: ["RICH_TEXT", "CTA_BANNER"] as const,
  },
] as const;

export function getPageDefinition(pageId: string): PageDefinition | null {
  return SITE_PAGES.find((p) => p.id === pageId) ?? null;
}

export function isSectionTypeAllowedForPage(
  pageId: string,
  type: SectionType
): boolean {
  const def = getPageDefinition(pageId);
  if (!def) return false;
  return def.allowedSections.includes(type);
}
