// app/api/expenses/export/route.ts
// Streams the expense ledger for a given year as CSV.
// Format is QuickBooks Self-Employed compatible:
//   Date,Vendor,Category,Amount,Description,Project
//
// Admin-only — guarded by `requireAdmin()`.

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { listExpensesForYear, SCHEDULE_C_LABELS } from "@/lib/db/expenses";

export const dynamic = "force-dynamic";

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatYmd(iso: Date): string {
  // mm/dd/yyyy — QuickBooks Self-Employed defaults to U.S. format.
  const mm = String(iso.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(iso.getUTCDate()).padStart(2, "0");
  const yyyy = iso.getUTCFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

export async function GET(request: Request) {
  await requireAdmin();

  const url = new URL(request.url);
  const yearStr = url.searchParams.get("year");
  const requestedYear = yearStr ? Number(yearStr) : NaN;
  const year =
    Number.isFinite(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100
      ? requestedYear
      : new Date().getFullYear();

  let expenses;
  try {
    expenses = await listExpensesForYear(year);
  } catch (err) {
    console.error("expenses export error:", err);
    return NextResponse.json(
      { error: "Failed to load expenses." },
      { status: 500 }
    );
  }

  const header = "Date,Vendor,Category,Amount,Description,Project";
  const rows = expenses.map((e) => {
    const date = e.date.toDate();
    const amount = (e.amountCents / 100).toFixed(2);
    return [
      csvEscape(formatYmd(date)),
      csvEscape(e.vendor ?? ""),
      csvEscape(SCHEDULE_C_LABELS[e.scheduleCLine]),
      csvEscape(amount),
      csvEscape(e.description),
      csvEscape(e.projectId ?? ""),
    ].join(",");
  });

  const body = [header, ...rows].join("\n") + "\n";

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="expenses-${year}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
