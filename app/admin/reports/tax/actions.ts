"use server";

// app/admin/reports/tax/actions.ts
// Server Actions for the tax + expense dashboard.
// All mutations require admin and log to the activity feed best-effort.

import { revalidatePath } from "next/cache";
import { Timestamp } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/session";
import { logActivity } from "@/lib/db/activity";
import {
  createExpense as dbCreateExpense,
  updateExpense as dbUpdateExpense,
  deleteExpense as dbDeleteExpense,
  type ExpenseDoc,
  type ScheduleCLine,
} from "@/lib/db/expenses";
import {
  createAsset as dbCreateAsset,
  updateAsset as dbUpdateAsset,
  type AssetDoc,
  type DepreciationMethod,
} from "@/lib/db/assets";

// ─── Shared types ─────────────────────────────────────────────────────────────

type ActionResult<T = void> =
  | (T extends void ? { success: true } : { success: true; data: T })
  | { success: false; error: string };

export type ExpenseInput = {
  /** ISO date string (yyyy-mm-dd). Required. */
  date: string;
  vendor?: string;
  description: string;
  /** Dollars (input from the form). Converted to cents server-side. */
  amount: number;
  scheduleCLine: ScheduleCLine;
  projectId?: string;
  mileageMiles?: number;
  isReimbursable?: boolean;
  receiptR2Key?: string;
  taxDeductible?: boolean;
};

export type AssetInput = {
  name: string;
  description?: string;
  /** ISO date string. */
  purchaseDate: string;
  /** Dollars; converted to cents. */
  purchasePrice: number;
  depreciationMethod: DepreciationMethod;
  /** ISO date string. Defaults to purchaseDate if omitted. */
  placedInServiceDate?: string;
  /** Dollars; converted to cents. */
  section179Amount?: number;
  /** Dollars; converted to cents. */
  salvageValue?: number;
  photoR2Key?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseIsoDateToTimestamp(iso: string): Timestamp {
  // Treat the date as UTC midnight so it doesn't drift across timezones.
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) {
    throw new Error(`Invalid date string: ${iso}`);
  }
  return Timestamp.fromDate(new Date(Date.UTC(y, m - 1, d, 0, 0, 0)));
}

function dollarsToCents(value: number): number {
  return Math.round(value * 100);
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

export async function createExpenseAction(
  input: ExpenseInput
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();

  try {
    const description = input.description?.trim();
    if (!description) {
      return { success: false, error: "Description is required." };
    }
    if (!Number.isFinite(input.amount) || input.amount < 0) {
      return { success: false, error: "Amount must be a non-negative number." };
    }

    const doc: Omit<ExpenseDoc, "id" | "createdAt" | "updatedAt"> = {
      date: parseIsoDateToTimestamp(input.date),
      description,
      amountCents: dollarsToCents(input.amount),
      scheduleCLine: input.scheduleCLine,
      taxDeductible: input.taxDeductible ?? true,
      ...(input.vendor ? { vendor: input.vendor } : {}),
      ...(input.projectId ? { projectId: input.projectId } : {}),
      ...(typeof input.mileageMiles === "number"
        ? { mileageMiles: input.mileageMiles }
        : {}),
      ...(typeof input.isReimbursable === "boolean"
        ? { isReimbursable: input.isReimbursable }
        : {}),
      ...(input.receiptR2Key ? { receiptR2Key: input.receiptR2Key } : {}),
    };

    const created = await dbCreateExpense(doc);

    await logActivity(
      "NOTE_ADDED",
      `Expense added: ${description} ($${input.amount.toFixed(2)})`,
      { expenseId: created.id, scheduleCLine: input.scheduleCLine }
    ).catch(() => {});

    revalidatePath("/admin/reports/tax");
    revalidatePath("/admin");

    return { success: true, data: { id: created.id } };
  } catch (err) {
    console.error("createExpenseAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create expense.",
    };
  }
}

export async function updateExpenseAction(
  id: string,
  patch: Partial<ExpenseInput>
): Promise<ActionResult> {
  await requireAdmin();

  try {
    const cleaned: Partial<ExpenseDoc> = {};
    if (patch.date) cleaned.date = parseIsoDateToTimestamp(patch.date);
    if (patch.vendor !== undefined) cleaned.vendor = patch.vendor;
    if (patch.description !== undefined) cleaned.description = patch.description.trim();
    if (typeof patch.amount === "number") cleaned.amountCents = dollarsToCents(patch.amount);
    if (patch.scheduleCLine) cleaned.scheduleCLine = patch.scheduleCLine;
    if (patch.projectId !== undefined) cleaned.projectId = patch.projectId;
    if (typeof patch.mileageMiles === "number") cleaned.mileageMiles = patch.mileageMiles;
    if (typeof patch.isReimbursable === "boolean")
      cleaned.isReimbursable = patch.isReimbursable;
    if (patch.receiptR2Key !== undefined) cleaned.receiptR2Key = patch.receiptR2Key;
    if (typeof patch.taxDeductible === "boolean")
      cleaned.taxDeductible = patch.taxDeductible;

    await dbUpdateExpense(id, cleaned);

    revalidatePath("/admin/reports/tax");

    return { success: true };
  } catch (err) {
    console.error("updateExpenseAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update expense.",
    };
  }
}

export async function deleteExpenseAction(id: string): Promise<ActionResult> {
  await requireAdmin();

  try {
    await dbDeleteExpense(id);
    revalidatePath("/admin/reports/tax");
    return { success: true };
  } catch (err) {
    console.error("deleteExpenseAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete expense.",
    };
  }
}

// ─── Assets ───────────────────────────────────────────────────────────────────

export async function createAssetAction(
  input: AssetInput
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();

  try {
    const name = input.name?.trim();
    if (!name) return { success: false, error: "Asset name is required." };
    if (!Number.isFinite(input.purchasePrice) || input.purchasePrice < 0) {
      return { success: false, error: "Purchase price must be a non-negative number." };
    }

    const placedInService = parseIsoDateToTimestamp(
      input.placedInServiceDate ?? input.purchaseDate
    );

    const doc: Omit<AssetDoc, "id" | "createdAt" | "updatedAt"> = {
      name,
      purchaseDate: parseIsoDateToTimestamp(input.purchaseDate),
      purchasePriceCents: dollarsToCents(input.purchasePrice),
      depreciationMethod: input.depreciationMethod,
      placedInServiceDate: placedInService,
      ...(input.description ? { description: input.description } : {}),
      ...(typeof input.section179Amount === "number"
        ? { section179Cents: dollarsToCents(input.section179Amount) }
        : {}),
      ...(typeof input.salvageValue === "number"
        ? { salvageValueCents: dollarsToCents(input.salvageValue) }
        : {}),
      ...(input.photoR2Key ? { photoR2Key: input.photoR2Key } : {}),
    };

    const created = await dbCreateAsset(doc);

    await logActivity("NOTE_ADDED", `Asset added: ${name}`, {
      assetId: created.id,
      depreciationMethod: input.depreciationMethod,
    }).catch(() => {});

    revalidatePath("/admin/reports/tax");

    return { success: true, data: { id: created.id } };
  } catch (err) {
    console.error("createAssetAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create asset.",
    };
  }
}

export async function updateAssetAction(
  id: string,
  patch: Partial<AssetInput>
): Promise<ActionResult> {
  await requireAdmin();

  try {
    const cleaned: Partial<AssetDoc> = {};
    if (patch.name !== undefined) cleaned.name = patch.name.trim();
    if (patch.description !== undefined) cleaned.description = patch.description;
    if (patch.purchaseDate)
      cleaned.purchaseDate = parseIsoDateToTimestamp(patch.purchaseDate);
    if (typeof patch.purchasePrice === "number")
      cleaned.purchasePriceCents = dollarsToCents(patch.purchasePrice);
    if (patch.depreciationMethod) cleaned.depreciationMethod = patch.depreciationMethod;
    if (patch.placedInServiceDate)
      cleaned.placedInServiceDate = parseIsoDateToTimestamp(patch.placedInServiceDate);
    if (typeof patch.section179Amount === "number")
      cleaned.section179Cents = dollarsToCents(patch.section179Amount);
    if (typeof patch.salvageValue === "number")
      cleaned.salvageValueCents = dollarsToCents(patch.salvageValue);
    if (patch.photoR2Key !== undefined) cleaned.photoR2Key = patch.photoR2Key;

    await dbUpdateAsset(id, cleaned);

    revalidatePath("/admin/reports/tax");

    return { success: true };
  } catch (err) {
    console.error("updateAssetAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update asset.",
    };
  }
}
