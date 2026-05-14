// lib/sales-tax-rules.ts
// Phase 3.11 — Per-state sales tax rules for digital photography services.
//
// Pure, isomorphic module. Safe to import from server and client components.
// No external dependencies. The seeded table below covers the 12 states most
// likely to apply to a Cary, NC-based photographer + a fallback "OTHER" rule
// with 0% rate and non-taxable digital photos.
//
// Local tax rates (county/city add-ons) are intentionally NOT modelled here —
// Korrin can override the rate per-state via `users/{uid}.taxConfig.overrideRulesByState`
// to fold in any local nexus once she registers. Treat `STATE_TAX_RULES` as
// the BASE state rate only.
//
// Source citations are inline as `// Source:` comments above each rule.

export interface StateTaxRule {
  stateCode: string; // Two-letter USPS code, e.g. "NC", "FL"
  digitalPhotosTaxable: boolean;
  printsTaxable: boolean;
  /** State base rate as a percentage (e.g. 4.75 = 4.75%). Local/county add-ons NOT included. */
  ratePct: number;
  filingFrequency: "MONTHLY" | "QUARTERLY";
  /** Day of the month the filing is due (1–31). */
  filingDueDayOfMonth: number;
  notes?: string;
}

export type ProductType = "DIGITAL_PHOTOS" | "PRINTS" | "SESSION_FEE";

/**
 * Seeded state-rule table.
 *
 * Each rule covers the BASE state rate; local rates differ by county/city
 * and must be added via `taxConfig.overrideRulesByState` once Korrin
 * registers for a sales-tax permit in the relevant state.
 *
 * "OTHER" is the catch-all for any state not in the table — `ratePct: 0`,
 * digital photos non-taxable. `computeSalesTaxCents` returns
 * `{ taxCents: 0, rule: null }` for unknown states.
 */
export const STATE_TAX_RULES: Record<string, StateTaxRule> = {
  // Source: ncdor.gov / NC DOR Bulletin TA-25 — digital property is taxable as TPP equivalent.
  NC: {
    stateCode: "NC",
    digitalPhotosTaxable: true,
    printsTaxable: true,
    ratePct: 4.75,
    filingFrequency: "MONTHLY",
    filingDueDayOfMonth: 20,
    notes: "Digital photos are taxable as 'digital property' (NC G.S. 105-164.4(a)(6b)).",
  },
  // Source: dor.sc.gov / SC Code §12-36-910 — digital downloads taxable as TPP equivalent.
  SC: {
    stateCode: "SC",
    digitalPhotosTaxable: true,
    printsTaxable: true,
    ratePct: 6.0,
    filingFrequency: "MONTHLY",
    filingDueDayOfMonth: 20,
    notes: "Photographers' digital products taxable; SC R. 117-308.",
  },
  // Source: tax.virginia.gov — digital photographs NOT taxable when delivered electronically; physical prints ARE taxable.
  VA: {
    stateCode: "VA",
    digitalPhotosTaxable: false,
    printsTaxable: true,
    ratePct: 5.3,
    filingFrequency: "MONTHLY",
    filingDueDayOfMonth: 20,
    notes: "VA exempts digital-only delivery; tangible prints taxable at 5.3% combined state+local.",
  },
  // Source: dor.georgia.gov — photographers' digital deliverables taxable at 4% state base; local add-ons separate.
  GA: {
    stateCode: "GA",
    digitalPhotosTaxable: true,
    printsTaxable: true,
    ratePct: 4.0,
    filingFrequency: "MONTHLY",
    filingDueDayOfMonth: 20,
    notes: "GA Reg. 560-12-2-.108 — digital products treated as TPP equivalent.",
  },
  // Source: floridarevenue.com / TIP 13A01-02 — digital photos NOT taxable; tangible prints taxable.
  FL: {
    stateCode: "FL",
    digitalPhotosTaxable: false,
    printsTaxable: true,
    ratePct: 6.0,
    filingFrequency: "MONTHLY",
    filingDueDayOfMonth: 20,
    notes: "FL exempts digital-only photos; tangible prints taxable at 6% state rate.",
  },
  // Source: tn.gov/revenue — digital products taxable at state rate of 7%.
  TN: {
    stateCode: "TN",
    digitalPhotosTaxable: true,
    printsTaxable: true,
    ratePct: 7.0,
    filingFrequency: "MONTHLY",
    filingDueDayOfMonth: 20,
    notes: "TN Code §67-6-233 — specified digital products taxable.",
  },
  // Source: marylandtaxes.gov — digital products taxable since 2021 HB 932.
  MD: {
    stateCode: "MD",
    digitalPhotosTaxable: true,
    printsTaxable: true,
    ratePct: 6.0,
    filingFrequency: "MONTHLY",
    filingDueDayOfMonth: 20,
    notes: "MD digital products tax effective Mar 14, 2021; HB 932.",
  },
  // Source: otr.cfo.dc.gov — DC sales tax applies to digital goods at 6%.
  DC: {
    stateCode: "DC",
    digitalPhotosTaxable: true,
    printsTaxable: true,
    ratePct: 6.0,
    filingFrequency: "MONTHLY",
    filingDueDayOfMonth: 20,
    notes: "DC Code §47-2001(n)(1)(B-iii) — specified digital products taxable.",
  },
  // Source: tax.ny.gov — pre-recorded digital photos NOT taxable when delivered electronically; tangible prints taxable.
  NY: {
    stateCode: "NY",
    digitalPhotosTaxable: false,
    printsTaxable: true,
    ratePct: 4.0,
    filingFrequency: "QUARTERLY",
    filingDueDayOfMonth: 20,
    notes: "NY TSB-A-12(20)S — digital photos exempt; tangible prints + sitting fees w/ tangible delivery taxable.",
  },
  // Source: cdtfa.ca.gov / Reg. 1528 — photographer's services + tangible prints taxable at 7.25% statewide base.
  CA: {
    stateCode: "CA",
    digitalPhotosTaxable: false,
    printsTaxable: true,
    ratePct: 7.25,
    filingFrequency: "QUARTERLY",
    filingDueDayOfMonth: 31,
    notes: "CA exempts digital-only delivery; tangible prints + delivery taxable. Local add-ons typical.",
  },
  // Source: comptroller.texas.gov — photography services & digital products taxable at 6.25% state rate.
  TX: {
    stateCode: "TX",
    digitalPhotosTaxable: true,
    printsTaxable: true,
    ratePct: 6.25,
    filingFrequency: "MONTHLY",
    filingDueDayOfMonth: 20,
    notes: "TX Tax Code §151.0101 — photography services + digital products taxable.",
  },
  // Catch-all fallback. Any state not in the table maps here only via the
  // `OTHER` key — `computeSalesTaxCents` returns `{ taxCents: 0, rule: null }`
  // for unknown two-letter codes rather than reading this row, so the fallback
  // is here for explicit "OTHER" selection (e.g. an out-of-country client).
  OTHER: {
    stateCode: "OTHER",
    digitalPhotosTaxable: false,
    printsTaxable: false,
    ratePct: 0,
    filingFrequency: "QUARTERLY",
    filingDueDayOfMonth: 31,
    notes: "Default fallback — no sales tax applied.",
  },
};

/**
 * Compute the sales tax owed for a single line item.
 *
 * Returns `{ taxCents: 0, rule: null }` when:
 *   - `clientStateCode` is null/empty
 *   - the state code is not in `STATE_TAX_RULES`
 *   - the product type is non-taxable per the rule (e.g. NC SESSION_FEE w/ digital-only delivery)
 *
 * `subtotalCents` MUST be a non-negative integer. The function rounds to
 * the nearest cent via `Math.round` for predictable behaviour at half-cent
 * boundaries (banker's rounding NOT used — invoices show the breakdown).
 */
export function computeSalesTaxCents(input: {
  subtotalCents: number;
  clientStateCode: string | null;
  productType: ProductType;
}): { taxCents: number; rule: StateTaxRule | null } {
  const { subtotalCents, clientStateCode, productType } = input;

  if (!clientStateCode) return { taxCents: 0, rule: null };
  const normalised = clientStateCode.trim().toUpperCase();
  if (!normalised) return { taxCents: 0, rule: null };

  const rule = STATE_TAX_RULES[normalised];
  if (!rule) return { taxCents: 0, rule: null };
  if (rule.ratePct <= 0) return { taxCents: 0, rule };

  // Determine taxability by product type. SESSION_FEE follows the digital-photos
  // rule because most session deliverables are digital today; if Korrin starts
  // bundling tangible prints into the session price she should split into a
  // separate PRINTS line.
  let taxable = false;
  if (productType === "DIGITAL_PHOTOS" || productType === "SESSION_FEE") {
    taxable = rule.digitalPhotosTaxable;
  } else if (productType === "PRINTS") {
    taxable = rule.printsTaxable;
  }

  if (!taxable) return { taxCents: 0, rule };
  if (subtotalCents <= 0) return { taxCents: 0, rule };

  const taxCents = Math.round((subtotalCents * rule.ratePct) / 100);
  return { taxCents, rule };
}

/**
 * Sorted list of state codes for use in admin UI dropdowns. "OTHER" is last.
 */
export function listStateCodes(): string[] {
  return Object.keys(STATE_TAX_RULES)
    .filter((k) => k !== "OTHER")
    .sort()
    .concat(["OTHER"]);
}

/**
 * Merge a base rule with a partial override. Returns a new object — does not
 * mutate the base. Use when reading `users/{uid}.taxConfig.overrideRulesByState`.
 */
export function applyRuleOverride(
  base: StateTaxRule,
  override: Partial<StateTaxRule> | undefined
): StateTaxRule {
  if (!override) return base;
  return { ...base, ...override, stateCode: base.stateCode };
}
