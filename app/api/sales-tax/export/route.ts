// app/api/sales-tax/export/route.ts
// Phase 3.11 — CSV export of the sales-tax ledger for a date range.
// Format: Paid,Client,State,Subtotal,Tax,InvoiceId,ProjectId
//
// Admin-only.

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { computeSalesTaxLedger } from "@/lib/domain/sales-tax-reports";

export const dynamic = "force-dynamic";

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function parseIsoOrDefault(iso: string | null, fallback: Date, endOfDay: boolean): Date {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return fallback;
  const [y, m, d] = iso.split("-").map(Number);
  if (endOfDay) return new Date(Date.UTC(y, m - 1, d, 23, 59, 59));
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${mm}/${dd}/${d.getUTCFullYear()}`;
  } catch {
    return iso;
  }
}

export async function GET(request: Request) {
  await requireAdmin();

  const url = new URL(request.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const stateCode = url.searchParams.get("state") ?? undefined;

  const now = new Date();
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0));
  const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59));

  const fromDate = parseIsoOrDefault(fromParam, yearStart, false);
  const toDate = parseIsoOrDefault(toParam, todayEnd, true);

  let ledger;
  try {
    ledger = await computeSalesTaxLedger({ fromDate, toDate, stateCode });
  } catch (err) {
    console.error("sales-tax export error:", err);
    return NextResponse.json({ error: "Failed to load ledger." }, { status: 500 });
  }

  const header = "Paid,Client,State,Subtotal,Tax,InvoiceId,ProjectId";
  const lines = ledger.rows.map((r) =>
    [
      csvEscape(fmtDate(r.paidAt)),
      csvEscape(r.clientName),
      csvEscape(r.stateCode),
      csvEscape((r.subtotalCents / 100).toFixed(2)),
      csvEscape((r.taxCents / 100).toFixed(2)),
      csvEscape(r.invoiceId),
      csvEscape(r.projectId),
    ].join(",")
  );

  const body = [header, ...lines].join("\n") + "\n";
  const fromTag = (fromParam ?? "ytd").replace(/[^0-9-]/g, "");
  const toTag = (toParam ?? "today").replace(/[^0-9-]/g, "");

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sales-tax-${fromTag}_${toTag}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
