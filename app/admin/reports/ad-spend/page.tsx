// app/admin/reports/ad-spend/page.tsx
// Phase 13.18 — Ad-spend / ROAS dashboard (Wave 8).
//
// Server Component:
//   1. Resolves the requested period (defaults to "this month" UTC).
//   2. Loads the full ad-spend ledger (so the entries table can render
//      everything Korrin has logged, not just the current period).
//   3. Computes a `RoasSnapshot` for the period via `computeRoasSnapshot`.
//   4. Loads the campaigns list to power the "add entry" dropdown.
//
// All math + Firestore reads stay on the server. The interactive table +
// modal live in `AdSpendDashboardClient.tsx`.

import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { listAdSpendEntries, AD_CHANNEL_LABELS, type AdSpendEntryDoc } from "@/lib/db/ad-spend";
import { listCampaigns, type CampaignDoc } from "@/lib/db/campaigns";
import { computeRoasSnapshot, type RoasSnapshot } from "@/lib/domain/roas";
import {
  AdSpendDashboardClient,
  type SerializedAdSpendEntry,
  type SerializedCampaignOption,
  type SerializedRoasSnapshot,
} from "./AdSpendDashboardClient";

export const metadata: Metadata = { title: "Ad Spend & ROAS | Reports" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ start?: string; end?: string }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function firstOfMonthUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0));
}

function lastOfMonthUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59));
}

function parseIsoDate(iso: string | undefined): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function serialiseEntry(e: AdSpendEntryDoc): SerializedAdSpendEntry {
  return {
    id: e.id,
    campaignId: e.campaignId ?? null,
    campaignSlug: e.campaignSlug ?? null,
    channel: e.channel,
    channelLabel: AD_CHANNEL_LABELS[e.channel],
    periodStart: e.periodStart.toDate().toISOString(),
    periodEnd: e.periodEnd.toDate().toISOString(),
    amountCents: e.amountCents,
    impressions: typeof e.impressions === "number" ? e.impressions : null,
    clicks: typeof e.clicks === "number" ? e.clicks : null,
    notes: e.notes ?? null,
  };
}

function serialiseCampaign(c: CampaignDoc): SerializedCampaignOption {
  return { id: c.id, slug: c.slug, title: c.title, status: c.status };
}

function serialiseSnapshot(s: RoasSnapshot): SerializedRoasSnapshot {
  return {
    periodStart: s.periodStart.toISOString(),
    periodEnd: s.periodEnd.toISOString(),
    byCampaign: s.byCampaign.map((r) => ({
      campaignId: r.campaignId,
      campaignSlug: r.campaignSlug,
      campaignTitle: r.campaignTitle,
      spendCents: r.spendCents,
      inquiriesCount: r.inquiriesCount,
      bookedProjectsCount: r.bookedProjectsCount,
      revenueCents: r.revenueCents,
      roas: r.roas,
      cpaCents: r.cpaCents,
    })),
    byChannel: s.byChannel.map((r) => ({
      channel: r.channel,
      channelLabel: AD_CHANNEL_LABELS[r.channel],
      spendCents: r.spendCents,
      attributedClientsCount: r.attributedClientsCount,
      revenueCents: r.revenueCents,
      roas: r.roas,
    })),
    totals: s.totals,
  };
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function AdSpendReportPage({ searchParams }: PageProps) {
  await requireAdmin();
  const sp = await searchParams;

  const now = new Date();
  const periodStart = parseIsoDate(sp.start) ?? firstOfMonthUtc(now);
  const periodEnd = parseIsoDate(sp.end) ?? lastOfMonthUtc(now);

  // Load everything we can in parallel. Each is defensively wrapped — a
  // single failed read shouldn't blank the entire page.
  const [entriesRaw, campaignsRaw, snapshotRaw] = await Promise.all([
    listAdSpendEntries().catch((err) => {
      console.error("[ad-spend] listAdSpendEntries failed:", err);
      return [] as AdSpendEntryDoc[];
    }),
    listCampaigns().catch((err) => {
      console.error("[ad-spend] listCampaigns failed:", err);
      return [] as CampaignDoc[];
    }),
    computeRoasSnapshot({ periodStart, periodEnd }).catch((err) => {
      console.error("[ad-spend] computeRoasSnapshot failed:", err);
      return null;
    }),
  ]);

  const snapshot: RoasSnapshot = snapshotRaw ?? {
    periodStart,
    periodEnd,
    byCampaign: [],
    byChannel: [],
    totals: {
      spendCents: 0,
      revenueCents: 0,
      roas: null,
      inquiriesCount: 0,
      bookedProjectsCount: 0,
    },
  };

  return (
    <AdSpendDashboardClient
      periodStartIso={toIsoDate(periodStart)}
      periodEndIso={toIsoDate(periodEnd)}
      snapshot={serialiseSnapshot(snapshot)}
      entries={entriesRaw.map(serialiseEntry)}
      campaigns={campaignsRaw.map(serialiseCampaign)}
    />
  );
}
