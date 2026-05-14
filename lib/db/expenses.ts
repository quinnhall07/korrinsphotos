// lib/db/expenses.ts
// Persistence layer for the expense ledger.
// One row per business expense, with manual Schedule C categorisation.
// Server-only — imports the admin SDK.

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * IRS Schedule C (Form 1040) expense lines, abridged to the categories that
 * apply to a solo photographer studio. Maps roughly 1:1 to Schedule C Part II
 * lines 8–27 plus a catch-all `OTHER` bucket for Part V.
 */
export type ScheduleCLine =
  | "ADVERTISING"
  | "CAR_TRUCK"
  | "COMMISSIONS"
  | "CONTRACT_LABOR"
  | "DEPRECIATION"
  | "INSURANCE"
  | "LEGAL_PROF"
  | "OFFICE"
  | "RENT_LEASE"
  | "REPAIRS"
  | "SUPPLIES"
  | "TAXES_LICENSES"
  | "TRAVEL"
  | "MEALS"
  | "UTILITIES"
  | "OTHER";

export const SCHEDULE_C_LABELS: Record<ScheduleCLine, string> = {
  ADVERTISING: "Advertising",
  CAR_TRUCK: "Car & truck",
  COMMISSIONS: "Commissions & fees",
  CONTRACT_LABOR: "Contract labor",
  DEPRECIATION: "Depreciation",
  INSURANCE: "Insurance",
  LEGAL_PROF: "Legal & professional",
  OFFICE: "Office expense",
  RENT_LEASE: "Rent or lease",
  REPAIRS: "Repairs & maintenance",
  SUPPLIES: "Supplies",
  TAXES_LICENSES: "Taxes & licenses",
  TRAVEL: "Travel",
  MEALS: "Meals (50% deductible)",
  UTILITIES: "Utilities",
  OTHER: "Other",
};

export interface ExpenseDoc {
  id: string;
  date: Timestamp;
  vendor?: string;
  description: string;
  amountCents: number;
  scheduleCLine: ScheduleCLine;
  projectId?: string;
  /** Tracked separately for the mileage section. Used with `MILEAGE_RATE_2025_CENTS_PER_MILE`. */
  mileageMiles?: number;
  /** True when the expense was paid out-of-pocket and should be reimbursed by the studio. */
  isReimbursable?: boolean;
  /** R2 key for the uploaded receipt. Receipt upload UI is a TODO follow-up. */
  receiptR2Key?: string;
  /** Default true; set false for personal/non-deductible draws. */
  taxDeductible: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 2025 IRS standard business mileage rate, in cents per mile.
// https://www.irs.gov/tax-professionals/standard-mileage-rates
export const MILEAGE_RATE_2025_CENTS_PER_MILE = 70;

// ─── Collection handle ────────────────────────────────────────────────────────

export const expensesCol = () => adminDb.collection("expenses");

// ─── Helpers ──────────────────────────────────────────────────────────────────

export async function getExpense(id: string): Promise<ExpenseDoc | null> {
  const snap = await expensesCol().doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as ExpenseDoc) : null;
}

export async function createExpense(
  data: Omit<ExpenseDoc, "id" | "createdAt" | "updatedAt">
): Promise<ExpenseDoc> {
  const ref = expensesCol().doc();
  const now = Timestamp.now();
  const fullData = { ...data, createdAt: now, updatedAt: now };
  await ref.set(fullData);
  return { id: ref.id, ...fullData } as ExpenseDoc;
}

export async function updateExpense(
  id: string,
  data: Partial<Omit<ExpenseDoc, "id" | "createdAt">>
): Promise<void> {
  await expensesCol()
    .doc(id)
    .update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

export async function deleteExpense(id: string): Promise<void> {
  await expensesCol().doc(id).delete();
}

function yearRange(year: number): { start: Timestamp; end: Timestamp } {
  const start = Timestamp.fromDate(new Date(Date.UTC(year, 0, 1, 0, 0, 0)));
  const end = Timestamp.fromDate(new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0)));
  return { start, end };
}

function monthRange(year: number, monthZeroIndexed: number): { start: Timestamp; end: Timestamp } {
  const start = Timestamp.fromDate(new Date(Date.UTC(year, monthZeroIndexed, 1, 0, 0, 0)));
  const end = Timestamp.fromDate(new Date(Date.UTC(year, monthZeroIndexed + 1, 1, 0, 0, 0)));
  return { start, end };
}

export async function listExpensesForYear(year: number): Promise<ExpenseDoc[]> {
  const { start, end } = yearRange(year);
  const snap = await expensesCol()
    .where("date", ">=", start)
    .where("date", "<", end)
    .orderBy("date", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ExpenseDoc));
}

/**
 * @param year Calendar year.
 * @param month 1-indexed (1 = January, 12 = December) — matches how a human
 *              would say "May 2026", not JS Date semantics.
 */
export async function listExpensesForMonth(
  year: number,
  month: number
): Promise<ExpenseDoc[]> {
  const { start, end } = monthRange(year, month - 1);
  const snap = await expensesCol()
    .where("date", ">=", start)
    .where("date", "<", end)
    .orderBy("date", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ExpenseDoc));
}
