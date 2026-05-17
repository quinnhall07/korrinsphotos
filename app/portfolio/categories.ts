// app/portfolio/categories.ts
// Single source of truth for the public portfolio's category vocabulary.
// Both the public filter UI (PortfolioClient) and the admin upload/edit
// affordances import this so the lists never drift apart.
//
// Adding a new category? Add it here and it'll appear everywhere.

export type PortfolioCategory =
  | "wedding"
  | "portrait"
  | "editorial"
  | "landscape";

export interface PortfolioCategoryOption {
  /** Stored value (lowercase, used as the Firestore `photo.category` field). */
  value: PortfolioCategory;
  /** Human-readable label rendered in tabs and dropdowns. */
  label: string;
}

/** Canonical category options, in the order they appear in the public filter bar. */
export const PORTFOLIO_CATEGORIES: PortfolioCategoryOption[] = [
  { value: "wedding", label: "Weddings" },
  { value: "portrait", label: "Portraits" },
  { value: "editorial", label: "Editorial" },
  { value: "landscape", label: "Landscape" },
];
