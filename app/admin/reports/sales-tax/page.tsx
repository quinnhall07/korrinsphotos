// app/admin/reports/sales-tax/page.tsx
// Phase 3.11 — Sales-tax dashboard. Reads ledger + filings, hands off to
// `SalesTaxClient` for the interactive surfaces.

import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import {
  listUpcomingFilings,
  listOverdueFilings,
  type SalesTaxFilingDoc,
} from "@/lib/db/sales-tax-filings";
import { computeSalesTaxLedger } from "@/lib/domain/sales-tax-reports";
import { SalesTaxClient } from "./SalesTaxClient";

export const metadata: Metadata = { title: "Sales Tax | Admin" };
export const dynamic = "force-dynamic";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function startOfYearIso(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-01-01`;
}

function parseIsoDate(iso: string | undefined, fallback: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return fallback;
  return iso;
}

function isoToDateUtc(iso: string, endOfDay = false): Date {
  const [y, m, d] = iso.split("-").map(Number);
  if (endOfDay) return new Date(Date.UTC(y, m - 1, d, 23, 59, 59));
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
}

function serializeFiling(f: SalesTaxFilingDoc) {
  return {
    id: f.id,
    stateCode: f.stateCode,
    periodStartIso: f.periodStart.toDate().toISOString(),
    periodEndIso: f.periodEnd.toDate().toISOString(),
    dueByIso: f.dueBy.toDate().toISOString(),
    taxableSalesCents: f.taxableSalesCents,
    taxOwedCents: f.taxOwedCents,
    status: f.status,
  };
}

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

export default async function SalesTaxPage({ searchParams }: PageProps) {
  await requireAdmin();
  const sp = await searchParams;

  const fromIso = parseIsoDate(sp.from, startOfYearIso());
  const toIso = parseIsoDate(sp.to, todayIso());
  const fromDate = isoToDateUtc(fromIso, false);
  const toDate = isoToDateUtc(toIso, true);
  const now = new Date();

  // Run the three reads in parallel — each is independent.
  const [ledger, upcoming, overdue] = await Promise.all([
    computeSalesTaxLedger({ fromDate, toDate }).catch((err) => {
      console.error("[sales-tax page] ledger failed", err);
      return { rows: [], totalsByState: {} };
    }),
    listUpcomingFilings(now, 90).catch((err) => {
      console.error("[sales-tax page] upcoming filings failed", err);
      return [] as SalesTaxFilingDoc[];
    }),
    listOverdueFilings(now).catch((err) => {
      console.error("[sales-tax page] overdue filings failed", err);
      return [] as SalesTaxFilingDoc[];
    }),
  ]);

  return (
    <SalesTaxClient
      fromIso={fromIso}
      toIso={toIso}
      rows={ledger.rows}
      totalsByState={ledger.totalsByState}
      upcoming={upcoming.map(serializeFiling)}
      overdue={overdue.map(serializeFiling)}
    />
  );
}
