// app/api/exports/invoices/route.ts
// Wave 11 — CSV export of every Invoice record.
//
// Money is exported in cents (integers) so spreadsheet consumers can divide
// by 100 themselves and avoid float-rounding drift.

import { requireAdmin } from "@/lib/session";
import { invoicesCol, type InvoiceDoc } from "@/lib/db/invoices";
import { rowsToCsv, csvFilename } from "@/lib/csv";
import { toDate } from "@/lib/date";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = [
  "id",
  "projectId",
  "clientId",
  "type",
  "status",
  "amountCents",
  "subtotalCents",
  "taxCents",
  "taxStateCode",
  "refundCents",
  "dueDate",
  "sentAt",
  "paidAt",
  "stripePaymentIntentId",
  "createdAt",
];

function iso(value: unknown): string {
  const d = toDate(value);
  return d ? d.toISOString() : "";
}

export async function GET(): Promise<Response> {
  await requireAdmin();

  try {
    const snap = await invoicesCol().orderBy("createdAt", "desc").get();
    const invoices: InvoiceDoc[] = snap.docs.map(
      (d) => ({ id: d.id, ...d.data() } as InvoiceDoc),
    );

    const rows = invoices.map((inv) => [
      inv.id,
      inv.projectId ?? "",
      inv.clientId ?? "",
      inv.type ?? "",
      inv.status ?? "",
      typeof inv.amountCents === "number" ? inv.amountCents : 0,
      typeof inv.subtotalCents === "number" ? inv.subtotalCents : "",
      typeof inv.taxCents === "number" ? inv.taxCents : "",
      inv.taxStateCode ?? "",
      typeof inv.refundCents === "number" ? inv.refundCents : "",
      iso(inv.dueDate),
      iso(inv.sentAt),
      iso(inv.paidAt),
      inv.stripePaymentIntentId ?? "",
      iso(inv.createdAt),
    ]);

    const body = rowsToCsv(HEADERS, rows);

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${csvFilename("invoices")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[exports/invoices] read failed:", err);
    return new Response("Failed to read invoices.", { status: 500 });
  }
}
