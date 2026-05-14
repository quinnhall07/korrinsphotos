// app/admin/campaigns/page.tsx
// Lists every campaign in the CMS. Server Component fetches via lib/db,
// serialises Timestamps, and delegates to the client list page.

import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { listCampaigns } from "@/lib/db/campaigns";
import {
  CampaignsListClientPage,
  type SerializedCampaignRow,
} from "./CampaignsListClientPage";

export const metadata: Metadata = { title: "Campaigns | Admin" };
export const dynamic = "force-dynamic";

/**
 * Best-effort: compute a lifetime ROAS map keyed by `campaignId` so each row
 * can render a small chip. Pulls a single snapshot covering the entire
 * window from the earliest campaign's `createdAt` through `now`. If the
 * Phase 13.18 ROAS module is unavailable or throws for any reason, we
 * swallow and return an empty map — the chips simply don't render.
 */
async function buildLifetimeRoasMap(
  earliest: Date | null
): Promise<Map<string, number | null>> {
  if (!earliest) return new Map();
  try {
    // Dynamic import keeps this additive: if `lib/domain/roas` is missing or
    // throws at import time we still render the page.
    const mod = await import("@/lib/domain/roas").catch(() => null);
    if (!mod) return new Map();
    const snapshot = await mod.computeRoasSnapshot({
      periodStart: earliest,
      periodEnd: new Date(),
    });
    const map = new Map<string, number | null>();
    for (const row of snapshot.byCampaign) {
      if (row.campaignId) map.set(row.campaignId, row.roas);
    }
    return map;
  } catch (err) {
    console.error("[campaigns] lifetime ROAS lookup failed (non-fatal):", err);
    return new Map();
  }
}

export default async function AdminCampaignsPage() {
  await requireAdmin();

  let rows: SerializedCampaignRow[] = [];
  let error: string | null = null;

  try {
    const docs = await listCampaigns();

    // Earliest campaign createdAt → period start for the lifetime ROAS roll-up.
    let earliest: Date | null = null;
    for (const c of docs) {
      const d = c.createdAt.toDate();
      if (!earliest || d.getTime() < earliest.getTime()) earliest = d;
    }
    const lifetimeRoas = await buildLifetimeRoasMap(earliest);

    rows = docs.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      status: c.status,
      visitCount: c.visitCount ?? 0,
      inquiryCount: c.inquiryCount ?? 0,
      defaultUtm: c.defaultUtm,
      createdAt: c.createdAt.toDate().toISOString(),
      updatedAt: c.updatedAt.toDate().toISOString(),
      lifetimeRoas: lifetimeRoas.has(c.id) ? lifetimeRoas.get(c.id) ?? null : null,
    }));
  } catch (err) {
    console.error("Failed to list campaigns:", err);
    error = err instanceof Error ? err.message : "Failed to load campaigns.";
  }

  if (error) {
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
          <strong>Error loading campaigns</strong>
          <br />
          {error}
        </div>
      </div>
    );
  }

  return <CampaignsListClientPage rows={rows} />;
}
