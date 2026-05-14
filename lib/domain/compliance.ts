// lib/domain/compliance.ts
// Phase 3.10 — Compliance snapshot aggregator. Reads contracts, projects
// (COI fields written by sibling agent B1), data-requests, and best-effort
// the sales-tax module (sibling agent B3). Returns zero buckets when an
// upstream dependency is missing — never throws.
//
// Server-only.

import { adminDb } from "@/lib/firebase-admin";
import type { ProjectDoc, ProjectStatus } from "@/lib/db/projects";
import {
  listDataRequests,
  listOverdueDataRequests,
  type DataRequestDoc,
} from "@/lib/db/data-requests";

export interface ComplianceContractsBucket {
  totalSigned: number;
  pendingSignature: number;
  bookedWithoutSignedContract: number;
  bookedWithoutSignedContractProjects: {
    id: string;
    title: string;
    shootDate: string | null;
  }[];
}

export interface ComplianceCoiBucket {
  required: number;
  received: number;
  outstanding: number;
  outstandingProjects: {
    id: string;
    title: string;
    shootDate: string | null;
    coiStatus: string;
  }[];
}

export interface ComplianceDataRequestsBucket {
  open: number;
  overdueCount: number;
  overdueRequests: DataRequestDoc[];
  totalThisYear: number;
}

export interface ComplianceSalesTaxBucket {
  filingsDueThisQuarter: number;
  filingsOverdue: number;
  nextFilingDueAt: string | null;
}

export interface ComplianceSnapshot {
  contracts: ComplianceContractsBucket;
  coi: ComplianceCoiBucket;
  dataRequests: ComplianceDataRequestsBucket;
  salesTax: ComplianceSalesTaxBucket;
}

// ─── Contracts ────────────────────────────────────────────────────────────────

async function buildContractsBucket(): Promise<ComplianceContractsBucket> {
  let totalSigned = 0;
  let pendingSignature = 0;
  try {
    const signedSnap = await adminDb.collection("contracts").where("status", "==", "SIGNED").count().get();
    totalSigned = signedSnap.data().count;
  } catch (err) {
    console.error("[compliance] count SIGNED contracts failed:", err);
  }
  try {
    const sentSnap = await adminDb.collection("contracts").where("status", "==", "SENT").count().get();
    pendingSignature = sentSnap.data().count;
  } catch (err) {
    console.error("[compliance] count SENT contracts failed:", err);
  }

  // Booked-but-unsigned: pull projects in shoot-ready statuses, check for a
  // SIGNED contract per project.
  const STATUSES: ProjectStatus[] = ["BOOKED", "SHOOT_READY", "IN_EDITING"];
  const candidates: ProjectDoc[] = [];
  for (const status of STATUSES) {
    try {
      const snap = await adminDb.collection("projects").where("status", "==", status).limit(200).get();
      for (const d of snap.docs) {
        candidates.push({ id: d.id, ...d.data() } as ProjectDoc);
      }
    } catch (err) {
      console.error(`[compliance] projects ${status} lookup failed:`, err);
    }
  }

  // For each candidate, look up the latest contract; surface those without a
  // SIGNED contract. Best-effort — failures count as "unsigned" defensively
  // (admin should see them).
  const unsigned: ComplianceContractsBucket["bookedWithoutSignedContractProjects"] = [];
  await Promise.all(
    candidates.map(async (p) => {
      try {
        const cSnap = await adminDb
          .collection("contracts")
          .where("projectId", "==", p.id)
          .where("status", "==", "SIGNED")
          .limit(1)
          .get();
        if (cSnap.empty) {
          unsigned.push({
            id: p.id,
            title: p.title ?? "(untitled project)",
            shootDate: p.shootDate ? p.shootDate.toDate().toISOString() : null,
          });
        }
      } catch (err) {
        console.error(`[compliance] contract lookup for project ${p.id} failed:`, err);
        unsigned.push({
          id: p.id,
          title: p.title ?? "(untitled project)",
          shootDate: p.shootDate ? p.shootDate.toDate().toISOString() : null,
        });
      }
    })
  );

  // Sort by shootDate ascending (soonest first; nulls last).
  unsigned.sort((a, b) => {
    if (a.shootDate && b.shootDate) return a.shootDate.localeCompare(b.shootDate);
    if (a.shootDate) return -1;
    if (b.shootDate) return 1;
    return 0;
  });

  return {
    totalSigned,
    pendingSignature,
    bookedWithoutSignedContract: unsigned.length,
    bookedWithoutSignedContractProjects: unsigned.slice(0, 25),
  };
}

// ─── COI ──────────────────────────────────────────────────────────────────────
// Defensive: sibling agent B1 owns the COI schema (fields `coiRequired: bool`
// and `coiStatus: "RECEIVED" | "REQUESTED" | "EXPIRED" | "NONE"` on
// `projects`). If those fields are absent the query returns nothing and we
// render zeros, no crash.

const COI_RECEIVED_VALUES = new Set(["RECEIVED", "RECEIVED_VALID", "OK"]);

async function buildCoiBucket(): Promise<ComplianceCoiBucket> {
  let required = 0;
  let received = 0;
  const outstandingProjects: ComplianceCoiBucket["outstandingProjects"] = [];

  try {
    const snap = await adminDb.collection("projects").where("coiRequired", "==", true).limit(500).get();
    required = snap.size;
    for (const d of snap.docs) {
      const data = d.data() as ProjectDoc & { coiRequired?: boolean; coiStatus?: string };
      const status = typeof data.coiStatus === "string" ? data.coiStatus.toUpperCase() : "NONE";
      if (COI_RECEIVED_VALUES.has(status)) {
        received += 1;
      } else {
        outstandingProjects.push({
          id: d.id,
          title: data.title ?? "(untitled project)",
          shootDate: data.shootDate ? data.shootDate.toDate().toISOString() : null,
          coiStatus: status,
        });
      }
    }
  } catch (err) {
    console.error("[compliance] COI query failed (sibling agent B1 may not have shipped):", err);
    // Soft-fail to zeros — the dashboard will still render.
  }

  outstandingProjects.sort((a, b) => {
    if (a.shootDate && b.shootDate) return a.shootDate.localeCompare(b.shootDate);
    if (a.shootDate) return -1;
    if (b.shootDate) return 1;
    return 0;
  });

  return {
    required,
    received,
    outstanding: outstandingProjects.length,
    outstandingProjects: outstandingProjects.slice(0, 25),
  };
}

// ─── Data Requests ────────────────────────────────────────────────────────────

async function buildDataRequestsBucket(now: Date): Promise<ComplianceDataRequestsBucket> {
  let all: DataRequestDoc[] = [];
  try {
    all = await listDataRequests();
  } catch (err) {
    console.error("[compliance] listDataRequests failed:", err);
  }

  let overdue: DataRequestDoc[] = [];
  try {
    overdue = await listOverdueDataRequests(now);
  } catch (err) {
    console.error("[compliance] listOverdueDataRequests failed:", err);
  }

  const open = all.filter((r) => r.status === "OPEN" || r.status === "IN_PROGRESS").length;
  const yearStartMs = new Date(now.getFullYear(), 0, 1).getTime();
  const totalThisYear = all.filter((r) => r.submittedAt.toMillis() >= yearStartMs).length;

  return {
    open,
    overdueCount: overdue.length,
    overdueRequests: overdue.slice(0, 25),
    totalThisYear,
  };
}

// ─── Sales Tax (defensive dynamic import) ─────────────────────────────────────

interface SalesTaxFilingShape {
  id?: string;
  status?: string;
  dueDate?: { toMillis?: () => number; toDate?: () => Date } | null;
  dueAt?: { toMillis?: () => number; toDate?: () => Date } | null;
}

function readDueMs(row: SalesTaxFilingShape): number | null {
  const candidate = row.dueDate ?? row.dueAt ?? null;
  if (!candidate) return null;
  try {
    if (typeof candidate.toMillis === "function") return candidate.toMillis();
    if (typeof candidate.toDate === "function") return candidate.toDate().getTime();
  } catch {
    return null;
  }
  return null;
}

async function buildSalesTaxBucket(now: Date): Promise<ComplianceSalesTaxBucket> {
  // Try a dynamic import of the sales-tax-filings module sibling agent B3
  // is expected to ship. If the module does not exist, the import throws —
  // catch it and return zeros.
  let rows: SalesTaxFilingShape[] = [];
  try {
    const mod = (await import("@/lib/db/sales-tax-filings").catch(() => null)) as
      | Record<string, unknown>
      | null;
    const listFn =
      mod && typeof mod.listSalesTaxFilings === "function"
        ? (mod.listSalesTaxFilings as () => Promise<unknown>)
        : mod && typeof mod.listFilings === "function"
        ? (mod.listFilings as () => Promise<unknown>)
        : null;
    if (listFn) {
      const result = await listFn();
      if (Array.isArray(result)) rows = result as SalesTaxFilingShape[];
    }
  } catch (err) {
    console.error("[compliance] sales-tax module not available (sibling agent B3):", err);
  }

  if (rows.length === 0) {
    // Last resort: direct read of the `salesTaxFilings` collection if it
    // happens to exist. Still tolerate failure.
    try {
      const snap = await adminDb.collection("salesTaxFilings").limit(200).get();
      rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) } as SalesTaxFilingShape));
    } catch {
      rows = [];
    }
  }

  const nowMs = now.getTime();
  const quarterEnd = (() => {
    const q = Math.floor(now.getMonth() / 3); // 0..3
    const endMonth = q * 3 + 3; // first day of next quarter
    return new Date(now.getFullYear(), endMonth, 1).getTime();
  })();

  let filingsDueThisQuarter = 0;
  let filingsOverdue = 0;
  let nextFilingDueAt: string | null = null;
  let earliestUpcomingMs: number | null = null;

  for (const row of rows) {
    const status = (row.status ?? "").toUpperCase();
    const isOutstanding = status !== "FILED" && status !== "PAID" && status !== "COMPLETED";
    if (!isOutstanding) continue;

    const dueMs = readDueMs(row);
    if (dueMs == null) continue;

    if (dueMs < nowMs) {
      filingsOverdue += 1;
    } else {
      if (dueMs < quarterEnd) filingsDueThisQuarter += 1;
      if (earliestUpcomingMs == null || dueMs < earliestUpcomingMs) {
        earliestUpcomingMs = dueMs;
      }
    }
  }

  if (earliestUpcomingMs != null) {
    nextFilingDueAt = new Date(earliestUpcomingMs).toISOString();
  }

  return { filingsDueThisQuarter, filingsOverdue, nextFilingDueAt };
}

// ─── Top-level ────────────────────────────────────────────────────────────────

export async function buildComplianceSnapshot(now: Date = new Date()): Promise<ComplianceSnapshot> {
  const [contracts, coi, dataRequests, salesTax] = await Promise.all([
    buildContractsBucket().catch((err) => {
      console.error("[compliance] contracts bucket failed:", err);
      return {
        totalSigned: 0,
        pendingSignature: 0,
        bookedWithoutSignedContract: 0,
        bookedWithoutSignedContractProjects: [],
      } satisfies ComplianceContractsBucket;
    }),
    buildCoiBucket().catch((err) => {
      console.error("[compliance] COI bucket failed:", err);
      return {
        required: 0,
        received: 0,
        outstanding: 0,
        outstandingProjects: [],
      } satisfies ComplianceCoiBucket;
    }),
    buildDataRequestsBucket(now).catch((err) => {
      console.error("[compliance] data requests bucket failed:", err);
      return {
        open: 0,
        overdueCount: 0,
        overdueRequests: [],
        totalThisYear: 0,
      } satisfies ComplianceDataRequestsBucket;
    }),
    buildSalesTaxBucket(now).catch((err) => {
      console.error("[compliance] sales-tax bucket failed:", err);
      return {
        filingsDueThisQuarter: 0,
        filingsOverdue: 0,
        nextFilingDueAt: null,
      } satisfies ComplianceSalesTaxBucket;
    }),
  ]);

  return { contracts, coi, dataRequests, salesTax };
}
