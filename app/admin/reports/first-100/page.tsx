// app/admin/reports/first-100/page.tsx
// Phase 13.15 — First 100 Clients dashboard.
//
// Read-only celebratory + analytical view of Korrin's earliest clients.
// Server Component:
//   1. requireAdmin() guard.
//   2. Reads all `clients` ordered by createdAt asc, caps at the first 100.
//   3. Reads all `projects` (so we can compute per-client pipeline progress
//      AND surface attrition — LOST / ARCHIVED projects are still counted in
//      the cohort grid, but excluded from LTV math).
//   4. Reads all PAID `invoices` for LTV (sum of amountCents grouped by
//      project → client). Excludes invoices belonging to LOST/ARCHIVED
//      projects so a refunded-then-archived booking doesn't inflate LTV.
//   5. Computes the four sections on the server, hands a serialisable
//      payload to the client component for layout + interactive sort.

import { requireAdmin } from "@/lib/session";
import { clientsCol, type ClientDoc } from "@/lib/db/clients";
import {
  projectsCol,
  type ProjectDoc,
  type ProjectStatus,
} from "@/lib/db/projects";
import { invoicesCol, type InvoiceDoc } from "@/lib/db/invoices";
import { toDate } from "@/lib/date";
import { First100ClientPage, type CohortRow, type LtvBucket, type TopReferrer } from "./First100ClientPage";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "First 100 | Reports" };
export const dynamic = "force-dynamic";

const COHORT_CAP = 100;

// Statuses excluded from LTV math but still counted in the cohort grid as "Lost".
const ATTRITION_STATUSES: ReadonlySet<ProjectStatus> = new Set<ProjectStatus>([
  "LOST",
  "ARCHIVED",
]);

// Statuses considered "past BOOKED" — i.e. the deposit cleared and we're locked in.
const PAST_BOOKED_STATUSES: ReadonlySet<ProjectStatus> = new Set<ProjectStatus>([
  "BOOKED",
  "SHOOT_READY",
  "IN_EDITING",
  "GALLERY_DELIVERED",
  "REFERRAL_SENT",
  "COMPLETED",
]);

// Statuses considered "delivered or beyond".
const DELIVERED_OR_BEYOND: ReadonlySet<ProjectStatus> = new Set<ProjectStatus>([
  "GALLERY_DELIVERED",
  "REFERRAL_SENT",
  "COMPLETED",
]);

/**
 * LTV histogram buckets (USD). Last entry is the open-ended `25k+` bin.
 */
const LTV_BUCKETS: ReadonlyArray<{ label: string; minUsd: number; maxUsd: number | null }> = [
  { label: "$0–500", minUsd: 0, maxUsd: 500 },
  { label: "$500–1k", minUsd: 500, maxUsd: 1000 },
  { label: "$1k–2k", minUsd: 1000, maxUsd: 2000 },
  { label: "$2k–3.5k", minUsd: 2000, maxUsd: 3500 },
  { label: "$3.5k–5k", minUsd: 3500, maxUsd: 5000 },
  { label: "$5k–7.5k", minUsd: 5000, maxUsd: 7500 },
  { label: "$7.5k–10k", minUsd: 7500, maxUsd: 10000 },
  { label: "$10k–15k", minUsd: 10000, maxUsd: 15000 },
  { label: "$15k–25k", minUsd: 15000, maxUsd: 25000 },
  { label: "$25k+", minUsd: 25000, maxUsd: null },
];

function bucketIndexForUsd(usd: number): number {
  for (let i = 0; i < LTV_BUCKETS.length; i++) {
    const b = LTV_BUCKETS[i];
    if (b.maxUsd === null) {
      if (usd >= b.minUsd) return i;
    } else if (usd >= b.minUsd && usd < b.maxUsd) {
      return i;
    }
  }
  return LTV_BUCKETS.length - 1;
}

export default async function First100Page() {
  await requireAdmin();

  // ─── 1. Cohort: first N clients by createdAt asc ──────────────────────────
  const clientsSnap = await clientsCol()
    .orderBy("createdAt", "asc")
    .limit(COHORT_CAP)
    .get();
  const cohortClients: ClientDoc[] = clientsSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as ClientDoc)
  );
  const cohortIds = new Set(cohortClients.map((c) => c.id));

  // ─── 2. Projects (all — filtered in-memory by cohort membership) ──────────
  // The cohort is bounded at 100 clients, but we still need every project
  // belonging to those clients, so a single sweep is the cheapest read.
  const projectsSnap = await projectsCol().get();
  const allProjects: ProjectDoc[] = projectsSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as ProjectDoc)
  );
  const cohortProjects = allProjects.filter((p) => cohortIds.has(p.clientId));

  // Group projects by client.
  const projectsByClient = new Map<string, ProjectDoc[]>();
  for (const p of cohortProjects) {
    const arr = projectsByClient.get(p.clientId) ?? [];
    arr.push(p);
    projectsByClient.set(p.clientId, arr);
  }

  // ─── 3. PAID invoices → revenue per client ────────────────────────────────
  // Restrict the LTV math to invoices whose project is NOT lost/archived.
  const projectStatusById = new Map<string, ProjectStatus>(
    cohortProjects.map((p) => [p.id, p.status])
  );

  const invoicesSnap = await invoicesCol().where("status", "==", "PAID").get();
  const allPaidInvoices: InvoiceDoc[] = invoicesSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as InvoiceDoc)
  );

  const revenueCentsByClient = new Map<string, number>();
  for (const inv of allPaidInvoices) {
    if (!cohortIds.has(inv.clientId)) continue;
    const projStatus = projectStatusById.get(inv.projectId);
    if (projStatus && ATTRITION_STATUSES.has(projStatus)) continue;
    const prev = revenueCentsByClient.get(inv.clientId) ?? 0;
    revenueCentsByClient.set(inv.clientId, prev + (inv.amountCents ?? 0));
  }

  // ─── 4. Cohort grid rows ──────────────────────────────────────────────────
  const today = new Date();
  const rows: CohortRow[] = cohortClients.map((c, idx) => {
    const projects = projectsByClient.get(c.id) ?? [];
    const projectCount = projects.length;
    const liveProjects = projects.filter((p) => !ATTRITION_STATUSES.has(p.status));
    const allLost = projectCount > 0 && liveProjects.length === 0;

    const booked = projects.some((p) => PAST_BOOKED_STATUSES.has(p.status));
    const shot = projects.some((p) => {
      const sd = toDate(p.shootDate);
      return sd !== null && sd.getTime() <= today.getTime();
    });
    const delivered = projects.some((p) => DELIVERED_OR_BEYOND.has(p.status));
    // REVIEWED — defensively just `clientNps` per the spec.
    const reviewed = projects.some((p) => typeof p.clientNps === "number");

    const lifetimeValueCents = revenueCentsByClient.get(c.id) ?? 0;
    const cohortDateMs = toDate(c.createdAt)?.getTime() ?? 0;
    const fullName = `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "(no name)";

    return {
      cohortNumber: idx + 1,
      clientId: c.id,
      fullName,
      email: c.email,
      firstTouchSource: c.firstTouchSource,
      cohortDateMs,
      projectCount,
      pillBooked: booked,
      pillShot: shot,
      pillDelivered: delivered,
      pillReviewed: reviewed,
      allLost,
      lifetimeValueCents,
    };
  });

  // ─── 5. Header tile metrics ───────────────────────────────────────────────
  const cohortSize = cohortClients.length;
  const totalRevenueCents = rows.reduce((sum, r) => sum + r.lifetimeValueCents, 0);
  const referralsWithinCohort = cohortClients.filter(
    (c) => c.referredBy != null && cohortIds.has(c.referredBy)
  ).length;
  const avgLtvCents = cohortSize > 0 ? Math.round(totalRevenueCents / cohortSize) : 0;

  // ─── 6. Top referrers in cohort ───────────────────────────────────────────
  // Prefer the stored `referralCount` field (maintained by the referral
  // engine). Fall back to counting cohort clients whose `referredBy`
  // points at this client when the field is missing.
  const referredByCount = new Map<string, number>();
  for (const c of cohortClients) {
    if (c.referredBy && cohortIds.has(c.referredBy)) {
      referredByCount.set(c.referredBy, (referredByCount.get(c.referredBy) ?? 0) + 1);
    }
  }
  const cohortReferrersWithReferral = new Set<string>();
  for (const c of cohortClients) {
    const stored = typeof c.referralCount === "number" ? c.referralCount : 0;
    const counted = referredByCount.get(c.id) ?? 0;
    if (stored > 0 || counted > 0) cohortReferrersWithReferral.add(c.id);
  }

  const topReferrers: TopReferrer[] = cohortClients
    .map((c) => {
      const stored = typeof c.referralCount === "number" ? c.referralCount : 0;
      const counted = referredByCount.get(c.id) ?? 0;
      const count = Math.max(stored, counted);
      return {
        clientId: c.id,
        fullName: `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || c.email,
        referralCount: count,
      };
    })
    .filter((r) => r.referralCount > 0)
    .sort((a, b) => b.referralCount - a.referralCount)
    .slice(0, 5);

  const referrersFromCohort = cohortReferrersWithReferral.size;

  // ─── 7. LTV histogram ─────────────────────────────────────────────────────
  const buckets: LtvBucket[] = LTV_BUCKETS.map((b) => ({ label: b.label, count: 0 }));
  for (const row of rows) {
    const usd = row.lifetimeValueCents / 100;
    const i = bucketIndexForUsd(usd);
    buckets[i].count += 1;
  }

  return (
    <First100ClientPage
      cohortSize={cohortSize}
      cohortCap={COHORT_CAP}
      totalRevenueCents={totalRevenueCents}
      referralsWithinCohort={referralsWithinCohort}
      avgLtvCents={avgLtvCents}
      rows={rows}
      referrersFromCohort={referrersFromCohort}
      topReferrers={topReferrers}
      ltvBuckets={buckets}
    />
  );
}
