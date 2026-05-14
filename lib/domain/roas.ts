// lib/domain/roas.ts
// Phase 13.18 — Cross-collection ROAS aggregator.
//
// Joins `adSpendEntries` (Wave 8) × `campaigns` (Wave 7) × `clients` ×
// `projects` to compute:
//
//   - Per-campaign rows: spend, inquiries, booked, revenue, ROAS, CPA.
//   - Per-channel rows:  spend, attributed clients, revenue, ROAS.
//   - Overall totals.
//
// Attribution rules (kept narrow and explicit):
//   - A client is "attributed to a campaign" when
//     `firstTouchCampaign === campaign.defaultUtm.campaign` AND
//     `firstTouchAt` falls in `[periodStart, periodEnd]`.
//   - A client is "attributed to a channel" when its `firstTouchMedium`
//     matches the channel via `channelToMedium(channel)` AND
//     `firstTouchAt` falls in the period.
//   - "Booked" projects are those owned by attributed clients whose status
//     is NOT in {LOST, ARCHIVED}.
//   - Revenue is the sum of `packagePriceUsd` across those projects,
//     expressed in cents.
//
// All counters defensively swallow Firestore failures and return zeros so
// the page renders even when a sibling collection is empty / unindexed.
//
// Server-only — imports `adminDb`. Never import from a `"use client"` file.

import { adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import {
  listAdSpendInPeriod,
  type AdChannel,
  type AdSpendEntryDoc,
} from "@/lib/db/ad-spend";
import { getCampaign, type CampaignDoc } from "@/lib/db/campaigns";
import type { ClientDoc } from "@/lib/db/clients";
import type { ProjectDoc } from "@/lib/db/projects";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface RoasRow {
  campaignId: string | null;
  campaignSlug: string | null;
  campaignTitle: string | null;
  spendCents: number;
  inquiriesCount: number;
  bookedProjectsCount: number;
  revenueCents: number;
  /** revenueCents / spendCents — null when spend == 0 (avoid div/0). */
  roas: number | null;
  /** spendCents / inquiriesCount — null when no inquiries. */
  cpaCents: number | null;
}

export interface ChannelRoasRow {
  channel: AdChannel;
  spendCents: number;
  attributedClientsCount: number;
  revenueCents: number;
  roas: number | null;
}

export interface RoasSnapshot {
  periodStart: Date;
  periodEnd: Date;
  byCampaign: RoasRow[];
  byChannel: ChannelRoasRow[];
  totals: {
    spendCents: number;
    revenueCents: number;
    roas: number | null;
    inquiriesCount: number;
    bookedProjectsCount: number;
  };
}

// ─── Channel ↔ medium heuristic ────────────────────────────────────────────

/**
 * Maps an `AdChannel` to the `firstTouchMedium` values we expect to see on
 * `clients/{id}`. These are deliberately permissive — `firstTouchMedium` is
 * free-form (set from `utm_medium` or a campaign's `defaultUtm.medium`), so
 * we match a small set of common synonyms case-insensitively.
 *
 * Returning an empty array opts the channel out of attribution (currently
 * only `OTHER` does this — its spend is summed but no clients are joined).
 */
export function channelToMedium(channel: AdChannel): string[] {
  switch (channel) {
    case "GOOGLE_ADS":
      return ["cpc", "ppc", "paidsearch", "paid_search"];
    case "INSTAGRAM_ADS":
    case "META_ADS":
      return ["social", "paidsocial", "paid_social", "instagram", "facebook", "meta"];
    case "PINTEREST_ADS":
      return ["pinterest", "social_pinterest"];
    case "VENUE_PARTNERSHIP":
      return ["partnership", "venue", "referral_partner"];
    case "OTHER":
      return [];
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function safeDiv(num: number, den: number): number | null {
  if (!den) return null;
  return num / den;
}

/**
 * Best-effort list of all clients whose `firstTouchAt` falls in the window.
 * Pulls a bounded slice (cap 500) — the studio's lead volume keeps this
 * well within range. Composite-free single-`where` + `orderBy`.
 *
 * Returns `[]` on failure so the page renders.
 */
async function listClientsInPeriod(start: Date, end: Date): Promise<ClientDoc[]> {
  try {
    const startTs = Timestamp.fromDate(start);
    const endTs = Timestamp.fromDate(end);
    const snap = await adminDb
      .collection("clients")
      .where("firstTouchAt", ">=", startTs)
      .where("firstTouchAt", "<=", endTs)
      .orderBy("firstTouchAt", "desc")
      .limit(500)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClientDoc));
  } catch (err) {
    console.error("[roas] listClientsInPeriod failed:", err);
    return [];
  }
}

/**
 * Best-effort load of projects for a set of clientIds. Firestore caps `in`
 * queries at 30 IDs per call, so we batch. Skips on any failure.
 */
async function listProjectsForClientIds(clientIds: string[]): Promise<ProjectDoc[]> {
  if (clientIds.length === 0) return [];
  const out: ProjectDoc[] = [];
  const seen = new Set<string>();
  const CHUNK = 30;
  for (let i = 0; i < clientIds.length; i += CHUNK) {
    const slice = clientIds.slice(i, i + CHUNK);
    try {
      const snap = await adminDb
        .collection("projects")
        .where("clientId", "in", slice)
        .limit(500)
        .get();
      for (const d of snap.docs) {
        if (seen.has(d.id)) continue;
        seen.add(d.id);
        out.push({ id: d.id, ...d.data() } as ProjectDoc);
      }
    } catch (err) {
      console.error("[roas] listProjectsForClientIds chunk failed:", err);
    }
  }
  return out;
}

// ─── Main ──────────────────────────────────────────────────────────────────

export async function computeRoasSnapshot(opts: {
  periodStart: Date;
  periodEnd: Date;
}): Promise<RoasSnapshot> {
  const { periodStart, periodEnd } = opts;

  // 1) Pull all ad-spend rows in the window. Defensive: empty on failure.
  let spendRows: AdSpendEntryDoc[] = [];
  try {
    spendRows = await listAdSpendInPeriod(periodStart, periodEnd);
  } catch (err) {
    console.error("[roas] listAdSpendInPeriod failed:", err);
    spendRows = [];
  }

  // 2) Pull all clients whose first-touch is in the window. Pull projects
  //    for those clients in one batched read.
  const clientsInPeriod = await listClientsInPeriod(periodStart, periodEnd);
  const clientIds = clientsInPeriod.map((c) => c.id);
  const projectsForClients = await listProjectsForClientIds(clientIds);

  // Index projects by clientId for the joins below.
  const projectsByClient = new Map<string, ProjectDoc[]>();
  for (const p of projectsForClients) {
    const list = projectsByClient.get(p.clientId) ?? [];
    list.push(p);
    projectsByClient.set(p.clientId, list);
  }

  // ─── 3) Per-campaign rows ────────────────────────────────────────────────
  // Group spend by campaignId. Unattributed (null) spend is collected as a
  // single "(no campaign)" row at the bottom of the byCampaign list so it
  // never disappears from view.
  const spendByCampaign = new Map<string | null, number>();
  for (const row of spendRows) {
    const key = row.campaignId ?? null;
    spendByCampaign.set(key, (spendByCampaign.get(key) ?? 0) + (row.amountCents ?? 0));
  }

  const byCampaign: RoasRow[] = [];

  for (const [campaignId, spendCents] of spendByCampaign.entries()) {
    let campaign: CampaignDoc | null = null;
    if (campaignId) {
      try {
        campaign = await getCampaign(campaignId);
      } catch (err) {
        console.error(`[roas] getCampaign(${campaignId}) failed:`, err);
        campaign = null;
      }
    }

    // Attributed clients for this campaign — match by
    // `firstTouchCampaign == campaign.defaultUtm.campaign`.
    const utmCampaignKey = campaign?.defaultUtm?.campaign ?? null;
    const attributedClients = utmCampaignKey
      ? clientsInPeriod.filter(
          (c) =>
            typeof c.firstTouchCampaign === "string" &&
            c.firstTouchCampaign === utmCampaignKey
        )
      : [];

    const inquiriesCount = attributedClients.length;

    // Projects owned by attributed clients, excluding terminal off-ramps.
    let bookedProjectsCount = 0;
    let revenueCents = 0;
    for (const c of attributedClients) {
      const projects = projectsByClient.get(c.id) ?? [];
      for (const p of projects) {
        if (p.status === "LOST" || p.status === "ARCHIVED") continue;
        bookedProjectsCount += 1;
        const priceUsd = typeof p.packagePriceUsd === "number" ? p.packagePriceUsd : 0;
        revenueCents += Math.round(priceUsd * 100);
      }
    }

    byCampaign.push({
      campaignId,
      campaignSlug: campaign?.slug ?? null,
      campaignTitle: campaign?.title ?? null,
      spendCents,
      inquiriesCount,
      bookedProjectsCount,
      revenueCents,
      roas: safeDiv(revenueCents, spendCents),
      cpaCents: safeDiv(spendCents, inquiriesCount),
    });
  }

  // Sort: real campaigns first by spend desc, then "(no campaign)" last.
  byCampaign.sort((a, b) => {
    if (a.campaignId === null && b.campaignId !== null) return 1;
    if (b.campaignId === null && a.campaignId !== null) return -1;
    return b.spendCents - a.spendCents;
  });

  // ─── 4) Per-channel rows ─────────────────────────────────────────────────
  const spendByChannel = new Map<AdChannel, number>();
  for (const row of spendRows) {
    spendByChannel.set(row.channel, (spendByChannel.get(row.channel) ?? 0) + (row.amountCents ?? 0));
  }

  const byChannel: ChannelRoasRow[] = [];
  for (const [channel, spendCents] of spendByChannel.entries()) {
    const mediumMatches = new Set(channelToMedium(channel).map((m) => m.toLowerCase()));

    const attributedClients = clientsInPeriod.filter((c) => {
      const m = typeof c.firstTouchMedium === "string" ? c.firstTouchMedium.toLowerCase() : null;
      return !!m && mediumMatches.has(m);
    });

    let revenueCents = 0;
    for (const c of attributedClients) {
      const projects = projectsByClient.get(c.id) ?? [];
      for (const p of projects) {
        if (p.status === "LOST" || p.status === "ARCHIVED") continue;
        const priceUsd = typeof p.packagePriceUsd === "number" ? p.packagePriceUsd : 0;
        revenueCents += Math.round(priceUsd * 100);
      }
    }

    byChannel.push({
      channel,
      spendCents,
      attributedClientsCount: attributedClients.length,
      revenueCents,
      roas: safeDiv(revenueCents, spendCents),
    });
  }

  byChannel.sort((a, b) => b.spendCents - a.spendCents);

  // ─── 5) Totals ────────────────────────────────────────────────────────────
  const totalSpend = byCampaign.reduce((s, r) => s + r.spendCents, 0);
  // Revenue total: sum across per-campaign rows. Per-channel revenue can
  // double-count when a single client matches both a campaign and a channel,
  // so we trust per-campaign as the canonical total. Unattributed-campaign
  // spend rows carry 0 revenue in `byCampaign`, so the totals stay honest.
  const totalRevenue = byCampaign.reduce((s, r) => s + r.revenueCents, 0);
  const totalInquiries = byCampaign.reduce((s, r) => s + r.inquiriesCount, 0);
  const totalBooked = byCampaign.reduce((s, r) => s + r.bookedProjectsCount, 0);

  return {
    periodStart,
    periodEnd,
    byCampaign,
    byChannel,
    totals: {
      spendCents: totalSpend,
      revenueCents: totalRevenue,
      roas: safeDiv(totalRevenue, totalSpend),
      inquiriesCount: totalInquiries,
      bookedProjectsCount: totalBooked,
    },
  };
}

// Re-export the channel union so the page + actions can pull a single
// canonical type from this module if they prefer.
export type { AdChannel };
