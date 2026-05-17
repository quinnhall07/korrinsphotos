// lib/db/analytics-cache.ts
// Phase 3.1 / 4.5 — Pre-aggregated analytics snapshots, keyed by a period
// identifier (e.g. `finance:2026-05-14`). Daily cron computes a fresh snapshot
// in `lib/domain/analytics.ts > computeFinanceSnapshot` and writes it here so
// the Finance dashboard loads in <300ms regardless of project count.
//
// Schema is intentionally permissive (open shape on every nested field) so
// future analytics surfaces can reuse the same collection — append a new
// top-level field (e.g. `cohorts`, `forecast`) and a new `periodKey` prefix
// (e.g. `cohorts:YYYY-Wxx`) without migrating existing rows.
//
// Server-only: imports `adminDb`. Never import from a "use client" file.

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

/**
 * Revenue tile aggregates. All monetary values are USD **cents** at rest in
 * the snapshot; the render layer converts to dollars at the edge.
 *
 *  mtd       — gross revenue this calendar month-to-date
 *  ytd       — gross revenue this calendar year-to-date
 *  last30    — gross revenue in the trailing 30 days
 *  gross     — gross revenue across the 18-month aggregation window
 *  refunded  — total refunded amount in the trailing 30 days
 *  deposits  — total deposit-invoice revenue across the window
 *  balance   — total balance-invoice revenue across the window
 */
export interface RevenueAggregate {
  mtd: number;
  ytd: number;
  last30: number;
  gross: number;
  refunded: number;
  deposits: number;
  balance: number;
}

/**
 * Funnel counts by ProjectStatus bucket. Counts are *current* (one project
 * counts once, in its current stage), not cumulative through-stages. Names
 * collapse the full ProjectStatus union into the seven canonical CRM stages.
 */
export interface FunnelAggregate {
  leads: number;       // INQUIRY + QUALIFYING + SITE_VISIT
  proposals: number;   // PROPOSAL_SENT + NEGOTIATING
  contracts: number;   // CONTRACT_SENT
  deposits: number;    // DEPOSIT_PENDING
  booked: number;      // BOOKED + SHOOT_READY + IN_EDITING
  delivered: number;   // GALLERY_DELIVERED + REFERRAL_SENT + COMPLETED
  lost: number;        // LOST + ARCHIVED
}

/**
 * Per-sessionType revenue + count bucket.
 *
 *  count        — distinct projects of that type that contributed revenue
 *  revenueCents — sum of paid invoice cents for those projects
 */
export interface SessionTypeAggregate {
  count: number;
  revenueCents: number;
}

/**
 * Snapshot document. Stored at `analyticsCache/{periodKey}`.
 *
 * - `id` matches `periodKey` (e.g. `finance:2026-05-14`).
 * - `computedAt` is the server-time the row was written.
 * - `revenue` / `funnel` / `sources` / `byType` / `depositLiability` are the
 *   five top-level analytics groups currently consumed by the dashboard;
 *   future analytics may add sibling top-level fields without migration.
 *
 *  sources           — Record<firstTouchSource, revenueCents>
 *  byType            — Record<sessionType, { count, revenueCents }>
 *  depositLiability  — sum of paid DEPOSIT invoice cents for projects still in
 *                      DEPOSIT_PENDING (deposits collected but not yet earned).
 */
export interface AnalyticsSnapshotDoc {
  id: string;
  computedAt: Timestamp;
  revenue: RevenueAggregate;
  funnel: FunnelAggregate;
  sources: Record<string, number>;
  byType: Record<string, SessionTypeAggregate>;
  depositLiability: number;
}

export const analyticsCacheCol = () => adminDb.collection("analyticsCache");

/** Read one snapshot by period key. Returns null if no row exists. */
export async function getSnapshot(
  periodKey: string
): Promise<AnalyticsSnapshotDoc | null> {
  const snap = await analyticsCacheCol().doc(periodKey).get();
  return snap.exists
    ? ({ id: snap.id, ...snap.data() } as AnalyticsSnapshotDoc)
    : null;
}

/**
 * Persist a snapshot. `set` (no merge) so a stale partial snapshot from a
 * crashed cron run cannot leak into a later read. Same-day re-computes are
 * a no-op overwrite, by design.
 */
export async function setSnapshot(
  periodKey: string,
  data: Omit<AnalyticsSnapshotDoc, "id" | "computedAt">
): Promise<void> {
  await analyticsCacheCol()
    .doc(periodKey)
    .set({
      ...data,
      computedAt: FieldValue.serverTimestamp(),
    });
}

/**
 * Helper — canonical `YYYY-MM-DD` for use in periodKeys like
 * `finance:YYYY-MM-DD`. UTC date, matching the cron schedule's timezone.
 */
export function periodDay(now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Canonical finance periodKey for `now`. */
export function financeKey(now: Date): string {
  return `finance:${periodDay(now)}`;
}
