// app/admin/lead-magnets/page.tsx
// Lists every lead magnet. Server Component fetches via lib/db, serialises
// Timestamps, and hands off to the client list page.

import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { listLeadMagnets } from "@/lib/db/lead-magnets";
import { listSequences } from "@/lib/db/sequences";
import {
  LeadMagnetsListClientPage,
  type SerializedLeadMagnetRow,
  type SequenceOption,
} from "./LeadMagnetsListClientPage";

export const metadata: Metadata = { title: "Lead Magnets | Admin" };
export const dynamic = "force-dynamic";

export default async function AdminLeadMagnetsPage() {
  await requireAdmin();

  const [magnets, sequences] = await Promise.all([
    listLeadMagnets().catch((err) => {
      console.error("listLeadMagnets failed", err);
      return [];
    }),
    listSequences().catch(() => []),
  ]);

  const rows: SerializedLeadMagnetRow[] = magnets.map((m) => ({
    id: m.id,
    slug: m.slug,
    title: m.title,
    description: m.description,
    status: m.status,
    downloadCount: m.downloadCount ?? 0,
    followUpSequenceId: m.followUpSequenceId ?? null,
    downloadFileName: m.downloadFileName,
    createdAt: m.createdAt.toDate().toISOString(),
    updatedAt: m.updatedAt.toDate().toISOString(),
  }));

  const sequenceOptions: SequenceOption[] = sequences.map((s) => ({
    id: s.id,
    name: s.name,
    active: s.active,
  }));

  return (
    <LeadMagnetsListClientPage rows={rows} sequenceOptions={sequenceOptions} />
  );
}
