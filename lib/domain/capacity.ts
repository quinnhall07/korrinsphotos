// lib/domain/capacity.ts
//
// Phase 3.14 — weekly capacity heatmap.
//
// Aggregates upcoming + recent project shoots into ISO-week buckets so the
// `/admin/calendar` page can render a "how booked is each week" overview.
//
// Why this lives in `lib/domain/`: it spans `projects` (read) only, but it
// is the only orchestrator that does cross-status aggregation purely for a
// UI surface. Single-collection ad-hoc reads usually belong in `lib/db/*`,
// but this query needs date-bucketing logic that doesn't fit the per-doc
// `db/projects.ts` shape.
//
// Server-only — uses `adminDb`.

import { adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import type { ProjectStatus } from "@/lib/db/projects";

/** Default weekly shoot cap. Configurable later via `users/{uid}.capacityWeeklyCap`. */
export const WEEKLY_CAP = 3;

/** Statuses that do NOT contribute to capacity (terminal off-ramps). */
const EXCLUDED_STATUSES: ProjectStatus[] = ["LOST", "ARCHIVED"];

/** How many weeks back from now to include. */
const WEEKS_BACK = 12;
/** How many weeks forward from now to include. */
const WEEKS_FORWARD = 52;

export interface BucketProject {
  id: string;
  title: string;
  sessionType: string;
  /** ISO timestamp for the shoot. */
  shootDate: string;
  /** Client display name (firstName lastName), best-effort. May be empty. */
  clientName: string;
  /** Pipeline status — useful so the side panel can show booked vs proposal. */
  status: string;
  /** Phase 13.16 — far-future-risk inputs surfaced for the client renderer. */
  depositPaidAt: string | null;
  lastContactedAt: string | null;
  lastRespondedAt: string | null;
}

export interface WeekBucket {
  /** ISO date (YYYY-MM-DD) for the Monday of this ISO week (UTC). */
  weekStart: string;
  /** Total shoots booked in this week. */
  shootCount: number;
  /** The project rows that contributed, ordered by `shootDate` asc. */
  projects: BucketProject[];
}

/**
 * Returns the Monday-anchored start-of-week for `d`, in UTC, with the time
 * zeroed. We anchor on UTC + Monday so the buckets are stable regardless of
 * the admin's local TZ — the public-facing labels can re-localise as needed.
 */
function toWeekStartUtc(d: Date): Date {
  const u = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // getUTCDay: Sun=0, Mon=1, ..., Sat=6. We want Mon=0.
  const dow = u.getUTCDay();
  const mondayOffset = (dow + 6) % 7; // Mon→0, Tue→1, ..., Sun→6
  u.setUTCDate(u.getUTCDate() - mondayOffset);
  return u;
}

/** Formats a Date as YYYY-MM-DD using UTC components. */
function isoDateUtc(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Builds 12 weeks back + 52 weeks forward of empty buckets, keyed by their
 * Monday-UTC ISO date. Returns the ordered list and a Map for O(1) writes.
 */
function seedBuckets(now: Date): { ordered: WeekBucket[]; index: Map<string, WeekBucket> } {
  const weekStart = toWeekStartUtc(now);
  const earliest = new Date(weekStart);
  earliest.setUTCDate(earliest.getUTCDate() - WEEKS_BACK * 7);

  const ordered: WeekBucket[] = [];
  const index = new Map<string, WeekBucket>();
  for (let i = 0; i < WEEKS_BACK + WEEKS_FORWARD; i++) {
    const d = new Date(earliest);
    d.setUTCDate(d.getUTCDate() + i * 7);
    const key = isoDateUtc(d);
    const bucket: WeekBucket = { weekStart: key, shootCount: 0, projects: [] };
    ordered.push(bucket);
    index.set(key, bucket);
  }
  return { ordered, index };
}

/**
 * Builds the heatmap buckets for the current admin's `/admin/calendar` view.
 *
 * Query strategy:
 *   1. Pull all projects whose `shootDate` falls inside the [now-12w, now+52w]
 *      window (single inequality on `shootDate`).
 *   2. Drop rows in excluded statuses (LOST / ARCHIVED) in-memory — Firestore
 *      doesn't allow combining an inequality on one field with a `not-in` on
 *      another without a composite index, and the row count is small enough
 *      that filtering in JS is fine.
 *   3. Hydrate client display names via a single batched read of all referenced
 *      clients.
 */
export async function buildCapacityHeatmap(now: Date = new Date()): Promise<WeekBucket[]> {
  const { ordered, index } = seedBuckets(now);

  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - WEEKS_BACK * 7);
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + WEEKS_FORWARD * 7);

  const snap = await adminDb
    .collection("projects")
    .where("shootDate", ">=", Timestamp.fromDate(start))
    .where("shootDate", "<=", Timestamp.fromDate(end))
    .orderBy("shootDate", "asc")
    .get();

  // Collect distinct clientIds so we can batch-hydrate display names.
  const rows: Array<{
    id: string;
    title: string;
    sessionType: string;
    clientId: string;
    status: string;
    shootDate: Date;
    depositPaidAt: Date | null;
    lastContactedAt: Date | null;
    lastRespondedAt: Date | null;
  }> = [];
  const clientIds = new Set<string>();
  for (const doc of snap.docs) {
    const data = doc.data();
    const status = String(data.status ?? "");
    if (EXCLUDED_STATUSES.includes(status as ProjectStatus)) continue;
    const ts = data.shootDate as Timestamp | undefined;
    if (!ts) continue;
    const d = ts.toDate();
    const dp = data.depositPaidAt as Timestamp | undefined;
    const lc = data.lastContactedAt as Timestamp | undefined;
    const lr = data.lastRespondedAt as Timestamp | undefined;
    rows.push({
      id: doc.id,
      title: String(data.title ?? "Untitled"),
      sessionType: String(data.sessionType ?? ""),
      clientId: String(data.clientId ?? ""),
      status,
      shootDate: d,
      depositPaidAt: dp ? dp.toDate() : null,
      lastContactedAt: lc ? lc.toDate() : null,
      lastRespondedAt: lr ? lr.toDate() : null,
    });
    if (data.clientId) clientIds.add(String(data.clientId));
  }

  // Batched client hydration. `getAll` accepts variadic DocumentReferences.
  const clientNames = new Map<string, string>();
  if (clientIds.size > 0) {
    const refs = Array.from(clientIds).map((id) => adminDb.collection("clients").doc(id));
    const docs = await adminDb.getAll(...refs);
    for (const c of docs) {
      if (!c.exists) continue;
      const d = c.data() ?? {};
      const name = `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim();
      clientNames.set(c.id, name);
    }
  }

  for (const r of rows) {
    const key = isoDateUtc(toWeekStartUtc(r.shootDate));
    const bucket = index.get(key);
    if (!bucket) continue;
    bucket.shootCount += 1;
    bucket.projects.push({
      id: r.id,
      title: r.title,
      sessionType: r.sessionType,
      shootDate: r.shootDate.toISOString(),
      clientName: clientNames.get(r.clientId) ?? "",
      status: r.status,
      depositPaidAt: r.depositPaidAt ? r.depositPaidAt.toISOString() : null,
      lastContactedAt: r.lastContactedAt ? r.lastContactedAt.toISOString() : null,
      lastRespondedAt: r.lastRespondedAt ? r.lastRespondedAt.toISOString() : null,
    });
  }

  // Ensure project lists in each bucket stay in shoot-date order.
  for (const b of ordered) {
    b.projects.sort((a, b2) => a.shootDate.localeCompare(b2.shootDate));
  }

  return ordered;
}
