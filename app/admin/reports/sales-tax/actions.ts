"use server";

// app/admin/reports/sales-tax/actions.ts
// Phase 3.11 — Server Actions for the sales-tax dashboard.

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { logActivity } from "@/lib/db/activity";
import {
  markFilingFiled,
  markFilingPaid,
} from "@/lib/db/sales-tax-filings";
import { regenerateUpcomingFilings } from "@/lib/domain/sales-tax-reports";

type ActionResult<T = void> =
  | (T extends void ? { success: true } : { success: true; data: T })
  | { success: false; error: string };

export async function markFilingFiledAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!id) return { success: false, error: "Missing filing id." };
  try {
    await markFilingFiled(id);
    await logActivity("NOTE_ADDED", `Sales-tax filing ${id} marked filed.`, { filingId: id }).catch(
      () => {}
    );
    revalidatePath("/admin/reports/sales-tax");
    return { success: true };
  } catch (err) {
    console.error("markFilingFiledAction error:", err);
    return { success: false, error: "Failed to mark filed." };
  }
}

export async function markFilingPaidAction(
  id: string,
  paidAtIso?: string
): Promise<ActionResult> {
  await requireAdmin();
  if (!id) return { success: false, error: "Missing filing id." };
  try {
    const paidAt = paidAtIso ? new Date(paidAtIso) : new Date();
    if (Number.isNaN(paidAt.getTime())) {
      return { success: false, error: "Invalid paid date." };
    }
    await markFilingPaid(id, paidAt);
    await logActivity("NOTE_ADDED", `Sales-tax filing ${id} marked paid.`, {
      filingId: id,
      paidAt: paidAt.toISOString(),
    }).catch(() => {});
    revalidatePath("/admin/reports/sales-tax");
    return { success: true };
  } catch (err) {
    console.error("markFilingPaidAction error:", err);
    return { success: false, error: "Failed to mark paid." };
  }
}

/**
 * Run the cron sweep manually from the dashboard. Useful right after an
 * admin edits a tax-config override and wants to see the filings list update.
 */
export async function regenerateFilingsAction(): Promise<ActionResult<{ created: number; skipped: number }>> {
  await requireAdmin();
  try {
    const result = await regenerateUpcomingFilings(new Date());
    revalidatePath("/admin/reports/sales-tax");
    return { success: true, data: result };
  } catch (err) {
    console.error("regenerateFilingsAction error:", err);
    return { success: false, error: "Failed to regenerate filings." };
  }
}
