// app/api/exports/clients/route.ts
// Wave 11 — CSV export of every Client record.
//
// One row per client. Field set is intentionally stable so spreadsheet
// consumers (Numbers, Sheets, QBO import) can map columns by header.

import { requireAdmin } from "@/lib/session";
import { clientsCol, type ClientDoc } from "@/lib/db/clients";
import { rowsToCsv, csvFilename } from "@/lib/csv";
import { toDate } from "@/lib/date";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = [
  "id",
  "email",
  "firstName",
  "lastName",
  "phone",
  "referralCode",
  "referredBy",
  "totalSessionsBooked",
  "firstTouchSource",
  "firstTouchMedium",
  "firstTouchCampaign",
  "firstTouchAt",
  "recurringCadence",
  "createdAt",
];

function iso(value: unknown): string {
  const d = toDate(value);
  return d ? d.toISOString() : "";
}

export async function GET(): Promise<Response> {
  await requireAdmin();

  let clients: ClientDoc[];
  try {
    const snap = await clientsCol().orderBy("createdAt", "desc").get();
    clients = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClientDoc));
  } catch (err) {
    console.error("[exports/clients] read failed:", err);
    return new Response("Failed to read clients.", { status: 500 });
  }

  const rows = clients.map((c) => [
    c.id,
    c.email ?? "",
    c.firstName ?? "",
    c.lastName ?? "",
    c.phone ?? "",
    c.referralCode ?? "",
    c.referredBy ?? "",
    typeof c.totalSessionsBooked === "number" ? c.totalSessionsBooked : 0,
    c.firstTouchSource ?? "",
    c.firstTouchMedium ?? "",
    c.firstTouchCampaign ?? "",
    iso(c.firstTouchAt),
    c.recurringCadence ?? "",
    iso(c.createdAt),
  ]);

  const body = rowsToCsv(HEADERS, rows);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename("clients")}"`,
      "Cache-Control": "no-store",
    },
  });
}
