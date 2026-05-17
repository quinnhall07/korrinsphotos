// app/api/exports/sales-tax-filings/route.ts
// Wave 11 — CSV export of every sales-tax filing row (Phase 3.11 ledger).

import { requireAdmin } from "@/lib/session";
import { listSalesTaxFilings } from "@/lib/db/sales-tax-filings";
import { rowsToCsv, csvFilename } from "@/lib/csv";
import { toDate } from "@/lib/date";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = [
  "id",
  "stateCode",
  "periodStart",
  "periodEnd",
  "dueBy",
  "taxableSalesCents",
  "taxOwedCents",
  "status",
  "filedAt",
  "paidAt",
  "notes",
  "createdAt",
];

function iso(value: unknown): string {
  const d = toDate(value);
  return d ? d.toISOString() : "";
}

export async function GET(): Promise<Response> {
  await requireAdmin();

  try {
    const filings = await listSalesTaxFilings();

    const rows = filings.map((f) => [
      f.id,
      f.stateCode ?? "",
      iso(f.periodStart),
      iso(f.periodEnd),
      iso(f.dueBy),
      typeof f.taxableSalesCents === "number" ? f.taxableSalesCents : 0,
      typeof f.taxOwedCents === "number" ? f.taxOwedCents : 0,
      f.status ?? "",
      iso(f.filedAt),
      iso(f.paidAt),
      f.notes ?? "",
      iso(f.createdAt),
    ]);

    const body = rowsToCsv(HEADERS, rows);

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${csvFilename("sales-tax-filings")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[exports/sales-tax-filings] read failed:", err);
    return new Response("Failed to read sales-tax filings.", { status: 500 });
  }
}
