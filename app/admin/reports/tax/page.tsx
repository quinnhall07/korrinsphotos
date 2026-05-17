// app/admin/reports/tax/page.tsx
// Tax + expense dashboard. Server Component fetches the year's expenses,
// assets, and PAID invoices, then delegates the interactive bits to the
// TaxDashboardClient.

import { requireAdmin } from "@/lib/session";
import { adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import {
  listExpensesForYear,
  SCHEDULE_C_LABELS,
  MILEAGE_RATE_2025_CENTS_PER_MILE,
  type ExpenseDoc,
  type ScheduleCLine,
} from "@/lib/db/expenses";
import {
  listAssets,
  currentYearDepreciationCents,
  DEPRECIATION_METHOD_LABELS,
  type AssetDoc,
} from "@/lib/db/assets";
import type { InvoiceDoc } from "@/lib/db/invoices";
import {
  TaxDashboardClient,
  type SerializedExpense,
  type SerializedAsset,
  type CategoryBreakdown,
} from "./TaxDashboardClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Tax & Expenses | Admin" };
export const dynamic = "force-dynamic";

interface DashboardData {
  year: number;
  ytdIncomeCents: number;
  ytdRefundsCents: number;
  ytdExpensesCents: number;
  ytdNetCents: number;
  taxRatePct: number;
  taxReserveCents: number;
  categoryBreakdown: CategoryBreakdown[];
  mileageTotalMiles: number;
  mileageDeductionCents: number;
  expenses: SerializedExpense[];
  assets: SerializedAsset[];
  totalDepreciationCents: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function serialiseExpense(doc: ExpenseDoc): SerializedExpense {
  return {
    id: doc.id,
    date: doc.date.toDate().toISOString(),
    vendor: doc.vendor ?? null,
    description: doc.description,
    amountCents: doc.amountCents,
    scheduleCLine: doc.scheduleCLine,
    projectId: doc.projectId ?? null,
    mileageMiles: typeof doc.mileageMiles === "number" ? doc.mileageMiles : null,
    isReimbursable: doc.isReimbursable ?? false,
    receiptR2Key: doc.receiptR2Key ?? null,
    taxDeductible: doc.taxDeductible,
  };
}

function serialiseAsset(doc: AssetDoc, year: number): SerializedAsset {
  return {
    id: doc.id,
    name: doc.name,
    description: doc.description ?? null,
    purchaseDate: doc.purchaseDate.toDate().toISOString(),
    purchasePriceCents: doc.purchasePriceCents,
    depreciationMethod: doc.depreciationMethod,
    placedInServiceDate: doc.placedInServiceDate.toDate().toISOString(),
    section179Cents: typeof doc.section179Cents === "number" ? doc.section179Cents : null,
    salvageValueCents: typeof doc.salvageValueCents === "number" ? doc.salvageValueCents : null,
    retiredAt: doc.retiredAt ? doc.retiredAt.toDate().toISOString() : null,
    photoR2Key: doc.photoR2Key ?? null,
    currentYearDepreciationCents: currentYearDepreciationCents(doc, year),
  };
}

async function getYtdIncomeAndRefunds(year: number): Promise<{
  incomeCents: number;
  refundsCents: number;
}> {
  // Pull every PAID invoice whose `paidAt` falls in the requested year.
  // We aggregate in-process: the volume is small (a single studio) and this
  // avoids the composite-index requirement of a `paidAt`-range query that
  // also filters by status.
  const start = Timestamp.fromDate(new Date(Date.UTC(year, 0, 1, 0, 0, 0)));
  const end = Timestamp.fromDate(new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0)));

  const snap = await adminDb
    .collection("invoices")
    .where("status", "==", "PAID")
    .get();

  let incomeCents = 0;
  let refundsCents = 0;
  for (const docSnap of snap.docs) {
    const data = docSnap.data() as InvoiceDoc;
    if (!data.paidAt) continue;
    const paidAtMs = data.paidAt.toMillis();
    if (paidAtMs < start.toMillis() || paidAtMs >= end.toMillis()) continue;
    incomeCents += data.amountCents ?? 0;
    if (typeof data.refundCents === "number") {
      refundsCents += data.refundCents;
    }
  }

  return { incomeCents, refundsCents };
}

async function getDashboardData(uid: string, year: number): Promise<DashboardData> {
  const [expensesRaw, assetsRaw, income, userSnap] = await Promise.all([
    listExpensesForYear(year).catch(() => [] as ExpenseDoc[]),
    listAssets().catch(() => [] as AssetDoc[]),
    getYtdIncomeAndRefunds(year).catch(() => ({ incomeCents: 0, refundsCents: 0 })),
    adminDb.collection("users").doc(uid).get().catch(() => null),
  ]);

  const expenses = expensesRaw.map(serialiseExpense);
  const assets = assetsRaw.map((a) => serialiseAsset(a, year));

  // Per-category breakdown for the donut chart.
  const breakdownMap = new Map<ScheduleCLine, number>();
  let mileageTotalMiles = 0;
  let totalExpensesCents = 0;
  for (const e of expenses) {
    if (!e.taxDeductible) continue;
    totalExpensesCents += e.amountCents;
    breakdownMap.set(
      e.scheduleCLine,
      (breakdownMap.get(e.scheduleCLine) ?? 0) + e.amountCents
    );
    if (typeof e.mileageMiles === "number") {
      mileageTotalMiles += e.mileageMiles;
    }
  }

  const mileageDeductionCents = mileageTotalMiles * MILEAGE_RATE_2025_CENTS_PER_MILE;

  const totalDepreciationCents = assets.reduce(
    (sum, a) => sum + a.currentYearDepreciationCents,
    0
  );

  // Treat mileage + depreciation as deductible add-ons on top of explicit
  // CAR_TRUCK + DEPRECIATION expense rows. Korrin chooses one method per
  // category in real practice, but for the YTD net we show the sum so the
  // reserve recommendation is conservative (high).
  const fullExpensesCents =
    totalExpensesCents + mileageDeductionCents + totalDepreciationCents;

  const netCents = income.incomeCents - income.refundsCents - fullExpensesCents;

  // Tax rate: read `users/{uid}.taxRate` if present (decimal, e.g. 0.30),
  // otherwise default to 30% — the simple self-employed rule of thumb that
  // covers ~15.3% SE + a low marginal income bracket.
  const userTaxRate = userSnap?.exists
    ? ((userSnap.data() as Record<string, unknown>).taxRate as number | undefined)
    : undefined;
  const taxRatePct =
    typeof userTaxRate === "number" && userTaxRate > 0 && userTaxRate < 1
      ? userTaxRate
      : 0.3;
  const taxReserveCents = Math.max(0, Math.round(netCents * taxRatePct));

  const categoryBreakdown: CategoryBreakdown[] = Array.from(breakdownMap.entries())
    .map(([category, amountCents]) => ({
      category,
      label: SCHEDULE_C_LABELS[category],
      amountCents,
    }))
    .sort((a, b) => b.amountCents - a.amountCents);

  return {
    year,
    ytdIncomeCents: income.incomeCents,
    ytdRefundsCents: income.refundsCents,
    ytdExpensesCents: fullExpensesCents,
    ytdNetCents: netCents,
    taxRatePct,
    taxReserveCents,
    categoryBreakdown,
    mileageTotalMiles,
    mileageDeductionCents,
    expenses,
    assets,
    totalDepreciationCents,
  };
}

// ─── Page ────────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<{ year?: string }>;
}

export default async function TaxDashboardPage({ searchParams }: PageProps) {
  const session = await requireAdmin();
  const sp = await searchParams;

  const requestedYear = Number(sp.year);
  const currentYear = new Date().getFullYear();
  const year =
    Number.isFinite(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100
      ? requestedYear
      : currentYear;

  let data: DashboardData | null = null;
  let error: string | null = null;

  try {
    data = await getDashboardData(session.uid, year);
  } catch (err) {
    console.error("getDashboardData error:", err);
    error = err instanceof Error ? err.message : "Failed to load tax dashboard.";
  }

  if (error || !data) {
    return (
      <div className="page-fade-in">
        <div
          style={{
            padding: "2rem",
            border: "0.5px solid #FCA5A5",
            background: "#FEF2F2",
            color: "#991B1B",
            fontSize: "0.88rem",
            lineHeight: 1.7,
          }}
        >
          <strong>Error loading tax dashboard</strong>
          <br />
          {error ?? "Unknown error."}
        </div>
      </div>
    );
  }

  return (
    <TaxDashboardClient
      data={data}
      depreciationMethodLabels={DEPRECIATION_METHOD_LABELS}
    />
  );
}
