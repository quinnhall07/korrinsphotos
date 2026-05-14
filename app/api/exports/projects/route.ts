// app/api/exports/projects/route.ts
// Wave 11 — CSV export of every Project record, joined with the parent
// Client doc to surface `clientEmail`.
//
// Strategy: fetch all clients once into a Map (cheap at studio scale —
// realistically <10k rows), then iterate projects. This avoids a per-project
// Firestore round-trip while still giving callers a stable, denormalised
// `clientEmail` column.

import { requireAdmin } from "@/lib/session";
import { listProjects } from "@/lib/db/projects";
import { clientsCol, type ClientDoc } from "@/lib/db/clients";
import { rowsToCsv, csvFilename } from "@/lib/csv";
import { toDate } from "@/lib/date";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = [
  "id",
  "clientId",
  "clientEmail",
  "status",
  "sessionType",
  "title",
  "shootDate",
  "shootLocationName",
  "packageName",
  "packagePriceUsd",
  "leadScore",
  "leadSource",
  "tags",
  "depositPaidAt",
  "balancePaidAt",
  "contractSignedAt",
  "deliveredAt",
  "createdAt",
];

function iso(value: unknown): string {
  const d = toDate(value);
  return d ? d.toISOString() : "";
}

export async function GET(): Promise<Response> {
  await requireAdmin();

  try {
    const [projects, clientSnap] = await Promise.all([
      listProjects(),
      clientsCol().get(),
    ]);

    const clientEmailById = new Map<string, string>();
    for (const d of clientSnap.docs) {
      const c = d.data() as Omit<ClientDoc, "id">;
      if (c?.email) clientEmailById.set(d.id, c.email);
    }

    const rows = projects.map((p) => [
      p.id,
      p.clientId ?? "",
      clientEmailById.get(p.clientId) ?? "",
      p.status ?? "",
      p.sessionType ?? "",
      p.title ?? "",
      iso(p.shootDate),
      p.shootLocation?.label ?? "",
      p.packageName ?? "",
      typeof p.packagePriceUsd === "number" ? p.packagePriceUsd : "",
      typeof p.leadScore === "number" ? p.leadScore : 0,
      p.leadSource ?? "",
      Array.isArray(p.tags) ? p.tags.join(";") : "",
      iso(p.depositPaidAt),
      iso(p.balancePaidAt),
      iso(p.contractSignedAt),
      iso(p.deliveredAt),
      iso(p.createdAt),
    ]);

    const body = rowsToCsv(HEADERS, rows);

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${csvFilename("projects")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[exports/projects] read failed:", err);
    return new Response("Failed to read projects.", { status: 500 });
  }
}
