// app/admin/settings/tax/page.tsx
// Phase 3.11 — Sales-tax settings. Master switch + per-state overrides.

import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { getTaxConfigOrDefault } from "@/lib/db/admin-settings";
import {
  STATE_TAX_RULES,
  applyRuleOverride,
} from "@/lib/sales-tax-rules";
import { TaxSettingsForm, type StateRuleProp } from "./TaxSettingsForm";

export const metadata: Metadata = { title: "Tax Settings | Admin" };
export const dynamic = "force-dynamic";

export default async function TaxSettingsPage() {
  const session = await requireAdmin();
  const config = await getTaxConfigOrDefault(session.uid);

  const rules: StateRuleProp[] = Object.values(STATE_TAX_RULES)
    .filter((r) => r.stateCode !== "OTHER")
    .map((base) => {
      const override = config.overrideRulesByState?.[base.stateCode];
      const effective = applyRuleOverride(base, override);
      return {
        stateCode: base.stateCode,
        ratePct: base.ratePct,
        digitalPhotosTaxable: base.digitalPhotosTaxable,
        printsTaxable: base.printsTaxable,
        filingFrequency: base.filingFrequency,
        filingDueDayOfMonth: base.filingDueDayOfMonth,
        notes: base.notes,
        effectiveRatePct: effective.ratePct,
        effectiveDigital: effective.digitalPhotosTaxable,
        effectivePrints: effective.printsTaxable,
      };
    });

  return (
    <TaxSettingsForm
      collectSalesTax={config.collectSalesTax}
      defaultBusinessStateCode={config.defaultBusinessStateCode}
      rules={rules}
    />
  );
}
