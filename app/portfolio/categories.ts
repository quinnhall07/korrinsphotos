// app/portfolio/categories.ts
// Single source of truth for the public portfolio's category vocabulary.
// Both the public filter UI (PortfolioClient) and the admin upload/edit
// affordances import this so the lists never drift apart.
//
// May 2026 redesign: vocabulary shifted to lowercase-plural shoot
// categories per operator. The legacy types ("wedding" / "editorial" /
// "portrait" / "landscape") remain valid as stored values until the
// migration script (`scripts/2026-05-remap-portfolio-categories.ts`)
// runs in production; they are intentionally NOT in PORTFOLIO_CATEGORIES
// so they don't appear in the public filter bar.

export type PortfolioCategory =
  | "portraits"
  | "landscapes"
  | "nature"
  | "edits";

export interface PortfolioCategoryOption {
  /** Stored value (lowercase, used as the Firestore `photo.category` field). */
  value: PortfolioCategory;
  /** Human-readable label rendered in tabs and dropdowns. */
  label: string;
}

/** Canonical category options, in the order they appear in the public filter bar. */
export const PORTFOLIO_CATEGORIES: PortfolioCategoryOption[] = [
  { value: "portraits",  label: "Portraits" },
  { value: "landscapes", label: "Landscapes" },
  { value: "nature",     label: "Nature" },
  { value: "edits",      label: "Edits" },
];

/**
 * Maps a stored category (possibly legacy) to one of the new public
 * options. Used by the public filter UI so old-vocabulary photos still
 * appear under a sensible bucket between code deploy and the migration
 * script running.
 */
export function normaliseStoredCategory(value: string | null | undefined): PortfolioCategory | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  switch (v) {
    case "portraits":
    case "portrait":
    case "wedding":
    case "family":
      return "portraits";
    case "landscapes":
    case "landscape":
      return "landscapes";
    case "nature":
      return "nature";
    case "edits":
    case "editorial":
    case "edit":
      return "edits";
    default:
      return null;
  }
}
