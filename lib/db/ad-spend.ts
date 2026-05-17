// lib/db/ad-spend.ts
// Phase 13.18 — Manual ad-spend ledger (Wave 8).
//
// One row per ad-spend slice: a single channel × campaign × period (week or
// month) entry that Korrin types in by hand. Joined to `campaigns/{id}`
// (Wave 7) on `campaignId` so we can compute per-campaign ROAS, and to
// `clients/{id}.firstTouchMedium` on `channel` so we can compute per-channel
// ROAS even when no specific campaign is attached.
//
// Server-only: imports the Admin SDK. Never import from a `"use client"` file.
// One file per Firestore collection per `lib/db/CLAUDE.md` — no aggregator.

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

/**
 * Free-ish closed union of ad channels. Maps onto `firstTouchMedium` on
 * `clients/{id}` via the heuristic in `lib/domain/roas.ts > channelToMedium`.
 * `VENUE_PARTNERSHIP` covers in-kind / co-marketing spend that does not run
 * on an ad network but still has a dollar value attached.
 */
export type AdChannel =
  | "GOOGLE_ADS"
  | "INSTAGRAM_ADS"
  | "META_ADS"
  | "PINTEREST_ADS"
  | "VENUE_PARTNERSHIP"
  | "OTHER";

export const AD_CHANNELS: AdChannel[] = [
  "GOOGLE_ADS",
  "INSTAGRAM_ADS",
  "META_ADS",
  "PINTEREST_ADS",
  "VENUE_PARTNERSHIP",
  "OTHER",
];

export const AD_CHANNEL_LABELS: Record<AdChannel, string> = {
  GOOGLE_ADS: "Google Ads",
  INSTAGRAM_ADS: "Instagram Ads",
  META_ADS: "Meta Ads",
  PINTEREST_ADS: "Pinterest Ads",
  VENUE_PARTNERSHIP: "Venue partnership",
  OTHER: "Other",
};

export interface AdSpendEntryDoc {
  id: string;
  /**
   * FK to `campaigns/{id}` (Wave 7). `null` for unattributed channel-level
   * spend (e.g. brand awareness IG spend that does not map to a single
   * landing page).
   */
  campaignId?: string | null;
  /** Denormalised — matches `campaigns/{id}.slug`. Speeds up roll-up reads. */
  campaignSlug?: string | null;
  channel: AdChannel;
  periodStart: Timestamp; // first day of period (week or month), UTC midnight
  periodEnd: Timestamp;   // last day of period (inclusive), UTC midnight
  amountCents: number;    // gross spend, positive integer
  impressions?: number;
  clicks?: number;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const adSpendEntriesCol = () => adminDb.collection("adSpendEntries");

// ─── Reads ─────────────────────────────────────────────────────────────────

export async function getAdSpendEntry(id: string): Promise<AdSpendEntryDoc | null> {
  const snap = await adSpendEntriesCol().doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as AdSpendEntryDoc) : null;
}

export async function listAdSpendEntries(): Promise<AdSpendEntryDoc[]> {
  const snap = await adSpendEntriesCol().orderBy("periodStart", "desc").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdSpendEntryDoc));
}

/**
 * All ad-spend rows whose `campaignId` matches. Composite-free — single
 * `where` plus `orderBy` on the same field is allowed by Firestore without
 * an index.
 */
export async function listAdSpendByCampaign(campaignId: string): Promise<AdSpendEntryDoc[]> {
  if (!campaignId) return [];
  const snap = await adSpendEntriesCol()
    .where("campaignId", "==", campaignId)
    .orderBy("periodStart", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdSpendEntryDoc));
}

/**
 * Every ad-spend row whose `periodStart` falls inside the requested window.
 * Pulls the row even if its `periodEnd` extends past `periodEnd` — callers
 * that want a strict-overlap semantic must filter further. We deliberately
 * key on `periodStart` to keep the query composite-free.
 */
export async function listAdSpendInPeriod(
  periodStart: Date,
  periodEnd: Date
): Promise<AdSpendEntryDoc[]> {
  const startTs = Timestamp.fromDate(periodStart);
  const endTs = Timestamp.fromDate(periodEnd);
  const snap = await adSpendEntriesCol()
    .where("periodStart", ">=", startTs)
    .where("periodStart", "<=", endTs)
    .orderBy("periodStart", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdSpendEntryDoc));
}

/**
 * Sum of `amountCents` across rows whose `periodStart` falls in the window.
 * Pass `channel` to filter further (in-memory; avoids a composite index).
 */
export async function sumAdSpendInPeriod(
  periodStart: Date,
  periodEnd: Date,
  channel?: AdChannel
): Promise<number> {
  const rows = await listAdSpendInPeriod(periodStart, periodEnd);
  let total = 0;
  for (const r of rows) {
    if (channel && r.channel !== channel) continue;
    total += r.amountCents ?? 0;
  }
  return total;
}

// ─── Writes ────────────────────────────────────────────────────────────────

export async function createAdSpendEntry(
  data: Omit<AdSpendEntryDoc, "id" | "createdAt" | "updatedAt">
): Promise<AdSpendEntryDoc> {
  const ref = adSpendEntriesCol().doc();
  const now = Timestamp.now();
  const fullData = { ...data, createdAt: now, updatedAt: now };
  await ref.set(fullData);
  return { id: ref.id, ...fullData } as AdSpendEntryDoc;
}

export async function updateAdSpendEntry(
  id: string,
  data: Partial<Omit<AdSpendEntryDoc, "id" | "createdAt">>
): Promise<void> {
  await adSpendEntriesCol()
    .doc(id)
    .update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

export async function deleteAdSpendEntry(id: string): Promise<void> {
  await adSpendEntriesCol().doc(id).delete();
}
