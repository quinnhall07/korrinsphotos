"use server";

// app/admin/settings/tax/actions.ts
// Phase 3.11 — Server Action for saving the admin's tax configuration.

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { logActivity } from "@/lib/db/activity";
import { updateTaxConfig, type TaxConfig } from "@/lib/db/admin-settings";
import { STATE_TAX_RULES, type StateTaxRule } from "@/lib/sales-tax-rules";

export type SaveTaxConfigResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Persist the admin's tax configuration. Receives a FormData payload from
 * the settings form:
 *
 *   collectSalesTax            "on" | absent (checkbox)
 *   defaultBusinessStateCode   string ("NC" by default)
 *   override_<STATE>_ratePct   number string (override the seeded base rate)
 *   override_<STATE>_digital   "on" | absent
 *   override_<STATE>_prints    "on" | absent
 *
 * Overrides are persisted only when they differ from the seeded rule, to keep
 * the stored map small.
 */
export async function saveTaxConfigAction(
  formData: FormData
): Promise<SaveTaxConfigResult> {
  const session = await requireAdmin();
  try {
    const collectSalesTax = formData.get("collectSalesTax") === "on";
    const defaultBusinessStateCode =
      String(formData.get("defaultBusinessStateCode") ?? "NC").toUpperCase() || "NC";

    const overrides: Record<string, Partial<StateTaxRule>> = {};
    for (const code of Object.keys(STATE_TAX_RULES)) {
      if (code === "OTHER") continue;
      const base = STATE_TAX_RULES[code];
      const rateRaw = formData.get(`override_${code}_ratePct`);
      const digitalChecked = formData.get(`override_${code}_digital`) === "on";
      const printsChecked = formData.get(`override_${code}_prints`) === "on";

      const partial: Partial<StateTaxRule> = {};

      if (typeof rateRaw === "string" && rateRaw.trim() !== "") {
        const n = Number(rateRaw);
        if (Number.isFinite(n) && n >= 0 && n <= 25) {
          if (n !== base.ratePct) partial.ratePct = n;
        }
      }
      if (digitalChecked !== base.digitalPhotosTaxable) {
        partial.digitalPhotosTaxable = digitalChecked;
      }
      if (printsChecked !== base.printsTaxable) {
        partial.printsTaxable = printsChecked;
      }

      if (Object.keys(partial).length > 0) {
        overrides[code] = partial;
      }
    }

    const patch: Partial<TaxConfig> = {
      collectSalesTax,
      defaultBusinessStateCode,
      overrideRulesByState: overrides,
    };

    await updateTaxConfig(session.uid, patch);
    await logActivity("NOTE_ADDED", "Tax configuration updated", {
      uid: session.uid,
      collectSalesTax,
      defaultBusinessStateCode,
      overrideCount: Object.keys(overrides).length,
    }).catch(() => {});

    revalidatePath("/admin/settings/tax");
    revalidatePath("/admin/reports/sales-tax");
    return { success: true };
  } catch (err) {
    console.error("saveTaxConfigAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to save tax settings.",
    };
  }
}
