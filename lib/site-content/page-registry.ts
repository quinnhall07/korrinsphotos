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

export const SITE_PAGES: readonly PageDefinition[] = [
  {
    id: "home",
    label: "Home",
    publicHref: "/",
    description: "Landing page — hero slideshow, selected work, stats, closing CTA.",
    allowedSections: ["HERO", "PHOTO_GRID", "RICH_TEXT", "CTA_BANNER"] as const,
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
