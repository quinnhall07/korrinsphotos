// lib/domain/analytics.ts
// Phase 3.1 / 4.5 — Cross-collection aggregation for the Finance dashboard.
//
// `computeFinanceSnapshot(now)` pulls a bounded slice of `invoices` +
// `projects` (last 18 months, hard-capped at 200 docs apiece), joins to
// `clients` for `firstTouchSource` attribution, and folds the result into
// the `AnalyticsSnapshotDoc` shape. All money is USD cents.
//
// The cron writer (`/api/cron/run-tasks`) and the Finance page (on cache
// miss) both call this function. It is idempotent — same inputs produce
// identical outputs, so overwriting a stale snapshot is safe.
//
// Server-only — imports `adminDb`. Never import from a "use client" file.

import { adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import type { InvoiceDoc } from "@/lib/db/invoices";
import type { ProjectDoc, ProjectStatus } from "@/lib/db/projects";
import type {
  AnalyticsSnapshotDoc,
  FunnelAggregate,
  RevenueAggregate,
  SessionTypeAggregate,
} from "@/lib/db/analytics-cache";
import { setSnapshot, financeKey } from "@/lib/db/analytics-cache";

const WINDOW_DAYS = 540; // ≈ 18 months
const MAX_DOCS = 200;    // safety cap per query (avoid composite-index surprises)

type SnapshotPayload = Omit<AnalyticsSnapshotDoc, "id" | "computedAt">;

function tsToDate(t: unknown): Date | null {
  if (!t) return null;
  if (t instanceof Date) return t;
  if (typeof t === "object" && t !== null && "toDate" in t && typeof (t as { toDate: () => Date }).toDate === "function") {
    try {
      return (t as { toDate: () => Date }).toDate();
    } catch {
      return null;
    }
  }
  return null;
}

function isWithinDays(when: Date | null, now: Date, days: number): boolean {
  if (!when) return false;
  const ms = days * 86_400_000;
  return now.getTime() - when.getTime() <= ms && when.getTime() <= now.getTime();
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

function isSameYear(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear();
}

function bucketStatus(status: ProjectStatus): keyof FunnelAggregate {
  switch (status) {
    case "INQUIRY":
    case "QUALIFYING":
    case "SITE_VISIT":
      return "leads";
    case "PROPOSAL_SENT":
    case "NEGOTIATING":
      return "proposals";
    case "CONTRACT_SENT":
      return "contracts";
    case "DEPOSIT_PENDING":
      return "deposits";
    case "BOOKED":
    case "SHOOT_READY":
    case "IN_EDITING":
      return "booked";
    case "GALLERY_DELIVERED":
    case "REFERRAL_SENT":
    case "COMPLETED":
      return "delivered";
    case "LOST":
    case "ARCHIVED":
      return "lost";
    default:
      return "lost";
  }
}

/**
 * Aggregate `invoices` + `projects` + `clients` into a finance snapshot.
 * Pure: takes `now`, reads from Firestore, returns the data shape. Does not
 * persist. The cron drain calls `persistFinanceSnapshot(now)` which wraps
 * this and writes through `setSnapshot`.
 */
export async function computeFinanceSnapshot(now: Date): Promise<SnapshotPayload> {
  // ---- 1) Pull bounded slices of invoices + projects.
  const windowStart = new Date(now.getTime() - WINDOW_DAYS * 86_400_000);
  const windowStartTs = Timestamp.fromDate(windowStart);

  // Invoices: order by `createdAt` desc, capped. Composite-free.
  const invoicesSnap = await adminDb
    .collection("invoices")
    .where("createdAt", ">=", windowStartTs)
    .orderBy("createdAt", "desc")
    .limit(MAX_DOCS)
    .get();
  const invoices: InvoiceDoc[] = invoicesSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as InvoiceDoc)
  );

  // Projects: pull every project (cap 200). Funnel walks every doc; revenue
  // joins need clientId + sessionType.
  const projectsSnap = await adminDb
    .collection("projects")
    .orderBy("createdAt", "desc")
    .limit(MAX_DOCS)
    .get();
  const projects: ProjectDoc[] = projectsSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as ProjectDoc)
  );

  const projectsById = new Map<string, ProjectDoc>();
  for (const p of projects) projectsById.set(p.id, p);

  // ---- 2) Resolve clients for firstTouchSource attribution.
  const clientIds = Array.from(
    new Set(projects.map((p) => p.clientId).filter((id): id is string => Boolean(id)))
  );
  const clientSourceById = new Map<string, string>();
  // Firestore `in` queries cap at 30 ids per call.
  const CHUNK = 30;
  for (let i = 0; i < clientIds.length; i += CHUNK) {
    const chunk = clientIds.slice(i, i + CHUNK);
    if (chunk.length === 0) continue;
    try {
      const snap = await adminDb
        .collection("clients")
        .where("__name__", "in", chunk)
        .get();
      for (const d of snap.docs) {
        const data = d.data() as { firstTouchSource?: string };
        clientSourceById.set(d.id, data.firstTouchSource ?? "DIRECT");
      }
    } catch (err) {
      console.error("[analytics] client lookup chunk failed:", err);
    }
  }

  // ---- 3) Accumulators.
  const revenue: RevenueAggregate = {
    mtd: 0,
    ytd: 0,
    last30: 0,
    gross: 0,
    refunded: 0,
    deposits: 0,
    balance: 0,
  };
  const funnel: FunnelAggregate = {
    leads: 0,
    proposals: 0,
    contracts: 0,
    deposits: 0,
    booked: 0,
    delivered: 0,
    lost: 0,
  };
  const sources: Record<string, number> = {};
  const byType: Record<string, SessionTypeAggregate> = {};
  let depositLiability = 0;

  // ---- 4) Fold invoices into revenue + sources + byType + depositLiability.
  for (const inv of invoices) {
    const paidAt = tsToDate(inv.paidAt as unknown);
    const refundedAt = tsToDate(inv.refundedAt as unknown);
    const amount = Number(inv.amountCents) || 0;
    const refundCents = Number(inv.refundCents) || 0;

    if (inv.status === "PAID" && paidAt) {
      revenue.gross += amount;
      if (isWithinDays(paidAt, now, 30)) revenue.last30 += amount;
      if (isSameMonth(paidAt, now)) revenue.mtd += amount;
      if (isSameYear(paidAt, now)) revenue.ytd += amount;
      if (inv.type === "DEPOSIT") revenue.deposits += amount;
      if (inv.type === "BALANCE") revenue.balance += amount;

      // Project / client joins for sources + byType.
      const project = projectsById.get(inv.projectId);
      if (project) {
        const sessionType = project.sessionType ?? "Unknown";
        const bucket =
          byType[sessionType] ?? ({ count: 0, revenueCents: 0 } as SessionTypeAggregate);
        bucket.revenueCents += amount;
        // Count distinct projects per type — use a Set keyed by projectId,
        // but we lazily realise it as count via marker map below.
        byType[sessionType] = bucket;

        const source = clientSourceById.get(project.clientId) ?? "DIRECT";
        sources[source] = (sources[source] ?? 0) + amount;
      }

      // Deposit liability = paid DEPOSIT invoices whose project is still in
      // DEPOSIT_PENDING (deposit collected but balance not yet earned).
      if (inv.type === "DEPOSIT" && project && project.status === "DEPOSIT_PENDING") {
        depositLiability += amount;
      }
    }

    if (refundCents > 0 && refundedAt && isWithinDays(refundedAt, now, 30)) {
      revenue.refunded += refundCents;
    }
  }

  // ---- 5) byType count = distinct projectIds that contributed any revenue.
  const projectsByTypeSeen = new Map<string, Set<string>>();
  for (const inv of invoices) {
    if (inv.status !== "PAID") continue;
    const project = projectsById.get(inv.projectId);
    if (!project) continue;
    const t = project.sessionType ?? "Unknown";
    const set = projectsByTypeSeen.get(t) ?? new Set<string>();
    set.add(project.id);
    projectsByTypeSeen.set(t, set);
  }
  for (const [t, set] of projectsByTypeSeen) {
    if (byType[t]) byType[t].count = set.size;
  }

  // ---- 6) Funnel — every project counts once in its current bucket.
  for (const p of projects) {
    funnel[bucketStatus(p.status)] += 1;
  }

  return {
    revenue,
    funnel,
    sources,
    byType,
    depositLiability,
  };
}

/**
 * Compute + persist a finance snapshot under `finance:YYYY-MM-DD`. Idempotent:
 * a same-day overwrite produces the same row. Returns the persisted payload
 * so the caller (cron, on-demand page render) can use it without a re-read.
 */
export async function persistFinanceSnapshot(now: Date): Promise<SnapshotPayload> {
  const payload = await computeFinanceSnapshot(now);
  await setSnapshot(financeKey(now), payload);
  return payload;
}

/**
 * Cron-friendly wrapper. Catches its own errors so a finance computation
 * failure cannot poison the rest of `/api/cron/run-tasks`. Returns true on
 * success, false on failure.
 */
export async function recomputeFinanceCache(now: Date): Promise<boolean> {
  try {
    await persistFinanceSnapshot(now);
    return true;
  } catch (err) {
    console.error("[analytics] recomputeFinanceCache failed:", err);
    return false;
  }
}
