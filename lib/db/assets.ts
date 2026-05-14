// lib/db/assets.ts
// Persistence layer for the depreciable-asset register (Phase 3.2).
// One row per equipment item Korrin owns and depreciates against taxable
// income (cameras, lenses, computers, lights, etc).
// Server-only — imports the admin SDK.

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Depreciation handling for a single asset:
 * - `MACRS_5`  — 5-year property (cameras, computers). Half-year convention.
 * - `MACRS_7`  — 7-year property (office furniture, certain studio rigs).
 * - `SECTION_179` — Full expense in the placed-in-service year (IRC §179 election).
 * - `BONUS`    — 100% bonus depreciation in the placed-in-service year (IRC §168(k));
 *                phase-down is ignored for this simple calculator.
 * - `NONE`     — No depreciation (recorded for inventory, not tax).
 */
export type DepreciationMethod =
  | "MACRS_5"
  | "MACRS_7"
  | "SECTION_179"
  | "BONUS"
  | "NONE";

export const DEPRECIATION_METHOD_LABELS: Record<DepreciationMethod, string> = {
  MACRS_5: "MACRS 5-year",
  MACRS_7: "MACRS 7-year",
  SECTION_179: "Section 179",
  BONUS: "Bonus depreciation",
  NONE: "None",
};

export interface AssetDoc {
  id: string;
  name: string;
  description?: string;
  purchaseDate: Timestamp;
  purchasePriceCents: number;
  depreciationMethod: DepreciationMethod;
  placedInServiceDate: Timestamp;
  /** Section 179 election dollar amount when partial. Falls back to full price if omitted. */
  section179Cents?: number;
  salvageValueCents?: number;
  retiredAt?: Timestamp | null;
  /** R2 key for an uploaded asset photo. UI wiring is a follow-up. */
  photoR2Key?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── MACRS half-year-convention tables (percentage of basis per year) ─────────
// IRS Pub. 946 Appendix A. Sums to 100 for each row.

const MACRS_5_HALF_YEAR = [20, 32, 19.2, 11.52, 11.52, 5.76];
const MACRS_7_HALF_YEAR = [14.29, 24.49, 17.49, 12.49, 8.93, 8.92, 8.93, 4.46];

/**
 * Computes the depreciation deduction for the *given* calendar year against
 * a single asset. Always returns cents (rounded to the nearest cent).
 *
 * Simplifying assumptions for the v1 dashboard:
 * - Half-year convention applies to all MACRS assets (this is the default
 *   for most photographers; the mid-quarter convention is not modeled).
 * - SECTION_179 and BONUS take the full eligible amount in the
 *   placed-in-service year and zero thereafter.
 * - Salvage value is subtracted from basis up-front for MACRS rows. (Real
 *   IRS MACRS ignores salvage; we keep the field so the studio can still
 *   reflect resale recovery if it wants. The default is 0.)
 *
 * Returns 0 once the recovery period has elapsed or the asset is retired
 * before the start of `year`.
 */
export function currentYearDepreciationCents(asset: AssetDoc, year: number): number {
  if (asset.depreciationMethod === "NONE") return 0;

  const placedInService = asset.placedInServiceDate.toDate().getUTCFullYear();
  const retiredYear = asset.retiredAt ? asset.retiredAt.toDate().getUTCFullYear() : null;
  if (retiredYear !== null && year > retiredYear) return 0;
  if (year < placedInService) return 0;

  const yearsInService = year - placedInService; // 0 in the first year

  if (asset.depreciationMethod === "SECTION_179") {
    if (yearsInService !== 0) return 0;
    return asset.section179Cents ?? asset.purchasePriceCents;
  }

  if (asset.depreciationMethod === "BONUS") {
    if (yearsInService !== 0) return 0;
    // 100% bonus through 2022; phasing down 80/60/40/20 thereafter.
    // For the v1 dashboard we treat bonus as 100%; the studio can switch
    // to SECTION_179 + MACRS for partial years if precision matters.
    return asset.purchasePriceCents;
  }

  const table =
    asset.depreciationMethod === "MACRS_5" ? MACRS_5_HALF_YEAR : MACRS_7_HALF_YEAR;
  if (yearsInService >= table.length) return 0;

  const basisCents = Math.max(
    0,
    asset.purchasePriceCents - (asset.salvageValueCents ?? 0)
  );
  const pct = table[yearsInService];
  return Math.round((basisCents * pct) / 100);
}

// ─── Collection handle ────────────────────────────────────────────────────────

export const assetsCol = () => adminDb.collection("assets");

// ─── Helpers ──────────────────────────────────────────────────────────────────

export async function getAsset(id: string): Promise<AssetDoc | null> {
  const snap = await assetsCol().doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as AssetDoc) : null;
}

export async function listAssets(): Promise<AssetDoc[]> {
  const snap = await assetsCol().orderBy("purchaseDate", "desc").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AssetDoc));
}

export async function createAsset(
  data: Omit<AssetDoc, "id" | "createdAt" | "updatedAt">
): Promise<AssetDoc> {
  const ref = assetsCol().doc();
  const now = Timestamp.now();
  const fullData = { ...data, createdAt: now, updatedAt: now };
  await ref.set(fullData);
  return { id: ref.id, ...fullData } as AssetDoc;
}

export async function updateAsset(
  id: string,
  data: Partial<Omit<AssetDoc, "id" | "createdAt">>
): Promise<void> {
  await assetsCol()
    .doc(id)
    .update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

export async function deleteAsset(id: string): Promise<void> {
  await assetsCol().doc(id).delete();
}
