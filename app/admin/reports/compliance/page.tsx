// app/admin/reports/compliance/page.tsx
// Phase 3.10 — Compliance dashboard. Server Component aggregates the
// compliance snapshot and hands a serializable payload to the client.

import { requireAdmin } from "@/lib/session";
import { buildComplianceSnapshot, type ComplianceSnapshot } from "@/lib/domain/compliance";
import { ComplianceDashboardClient } from "./ComplianceDashboardClient";
import type { Metadata } from "next";
import type { DataRequestDoc } from "@/lib/db/data-requests";

export const metadata: Metadata = { title: "Compliance | Reports" };
export const dynamic = "force-dynamic";

export interface SerializedDataRequest {
  id: string;
  type: DataRequestDoc["type"];
  status: DataRequestDoc["status"];
  subjectEmail: string;
  subjectClientId: string | null;
  submittedAt: string; // ISO
  dueBy: string; // ISO
  fulfilledAt: string | null;
  notes: string | null;
}

export interface SerializedComplianceSnapshot {
  contracts: ComplianceSnapshot["contracts"];
  coi: ComplianceSnapshot["coi"];
  dataRequests: {
    open: number;
    overdueCount: number;
    overdueRequests: SerializedDataRequest[];
    totalThisYear: number;
  };
  salesTax: ComplianceSnapshot["salesTax"];
}

function serializeDataRequest(d: DataRequestDoc): SerializedDataRequest {
  return {
    id: d.id,
    type: d.type,
    status: d.status,
    subjectEmail: d.subjectEmail,
    subjectClientId: d.subjectClientId ?? null,
    submittedAt: d.submittedAt.toDate().toISOString(),
    dueBy: d.dueBy.toDate().toISOString(),
    fulfilledAt: d.fulfilledAt ? d.fulfilledAt.toDate().toISOString() : null,
    notes: d.notes ?? null,
  };
}

export default async function ComplianceReportPage() {
  await requireAdmin();

  const snapshot = await buildComplianceSnapshot(new Date());

  const serialized: SerializedComplianceSnapshot = {
    contracts: snapshot.contracts,
    coi: snapshot.coi,
    dataRequests: {
      open: snapshot.dataRequests.open,
      overdueCount: snapshot.dataRequests.overdueCount,
      overdueRequests: snapshot.dataRequests.overdueRequests.map(serializeDataRequest),
      totalThisYear: snapshot.dataRequests.totalThisYear,
    },
    salesTax: snapshot.salesTax,
  };

  return <ComplianceDashboardClient snapshot={serialized} />;
}
