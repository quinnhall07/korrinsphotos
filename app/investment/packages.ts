// app/investment/packages.ts
// Static configuration for the public /investment page package cards.
// Owned by the investment page only — do NOT reuse this shape across other
// pricing surfaces (auto-responder rate table, admin proposal builder, etc.).
// Roadmap §2.3 + §13.14.

/**
 * Subset of session-type values that the public booking form recognises.
 * Must stay in lockstep with the `sessionType` enum in
 * `app/booking/actions.ts` (Zod schema) and the local `SessionType` in
 * `app/booking/BookingFormSteps.tsx`.
 */
export type BookingSessionType =
  | "Wedding"
  | "Portrait"
  | "Editorial"
  | "Family"
  | "Engagement"
  | "Commercial";

export type InvestmentPackageId = "mini" | "story" | "day";

export interface InvestmentPackage {
  /** URL slug — matches the `?package=` query param consumed by /booking. */
  id:                InvestmentPackageId;
  /** Editorial name (e.g. "The Mini"). */
  name:              string;
  /** Floor price in USD; rendered as "starting at $X". */
  startingPriceUsd:  number;
  /**
   * Primary sessionType pre-selected on the booking form when the visitor
   * clicks the card's CTA. The booking form enum is fixed (see actions.ts)
   * so we pick the most representative match for each package.
   */
  sessionType:       BookingSessionType;
  /** Bullet-list inclusions rendered on the card. */
  includes:          string[];
  /** "Ideal for…" single-line audience descriptor. */
  idealFor:          string;
}

export const INVESTMENT_PACKAGES: InvestmentPackage[] = [
  {
    id:               "mini",
    name:             "The Mini",
    startingPriceUsd: 450,
    sessionType:      "Portrait",
    includes: [
      "60 minutes of coverage",
      "25 edited high-resolution images",
      "One location, one outfit",
      "Private online gallery for 12 months",
      "Personal print release",
    ],
    idealFor:
      "Ideal for solo portraits, branding headshots, and intimate family sessions.",
  },
  {
    id:               "story",
    name:             "The Story",
    startingPriceUsd: 1250,
    sessionType:      "Engagement",
    includes: [
      "2.5 hours of coverage",
      "75 edited high-resolution images",
      "Two locations, two outfit changes",
      "Sneak peek delivered within one week",
      "Private online gallery for 12 months",
      "Personal print release",
    ],
    idealFor:
      "Ideal for engagements, anniversary stories, and editorial concept shoots.",
  },
  {
    id:               "day",
    name:             "The Day",
    startingPriceUsd: 3500,
    sessionType:      "Wedding",
    includes: [
      "Full-day coverage (up to 10 hours)",
      "400+ edited high-resolution images",
      "Second shooter optional",
      "Sneak peek delivered within one week",
      "Full delivery within four weeks",
      "Private online gallery for 12 months",
      "Personal print release",
    ],
    idealFor:
      "Ideal for weddings and multi-event days that deserve start-to-finish coverage.",
  },
];

/** Lookup by `?package=` query value; returns null on unknown id. */
export function findPackageById(
  id: string | undefined | null,
): InvestmentPackage | null {
  if (!id) return null;
  const match = INVESTMENT_PACKAGES.find((p) => p.id === id);
  return match ?? null;
}
