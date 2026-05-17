// app/admin/lead-magnets/[id]/page.tsx
// Edit a single lead magnet + view its download log.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { getLeadMagnet } from "@/lib/db/lead-magnets";
import { listDownloadsForMagnet } from "@/lib/db/lead-magnet-downloads";
import { listSequences } from "@/lib/db/sequences";
import { formatDateTime } from "@/lib/date";
import {
  LeadMagnetDetailClient,
  type SerializedLeadMagnet,
  type SerializedDownloadRow,
  type SequenceOption,
} from "./LeadMagnetDetailClient";

export const metadata: Metadata = { title: "Lead Magnet | Admin" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminLeadMagnetDetailPage({ params }: PageProps) {
  await requireAdmin();
  const { id } = await params;

  const magnet = await getLeadMagnet(id);
  if (!magnet) notFound();

  const [downloads, sequences] = await Promise.all([
    listDownloadsForMagnet(id, 50).catch(() => []),
    listSequences().catch(() => []),
  ]);

  const serialized: SerializedLeadMagnet = {
    id: magnet.id,
    slug: magnet.slug,
    title: magnet.title,
    description: magnet.description,
    status: magnet.status,
    downloadCount: magnet.downloadCount ?? 0,
    followUpSequenceId: magnet.followUpSequenceId ?? null,
    coverImageId: magnet.coverImageId ?? null,
    downloadFileName: magnet.downloadFileName,
    r2Key: magnet.r2Key,
    createdAt: magnet.createdAt.toDate().toISOString(),
    updatedAt: magnet.updatedAt.toDate().toISOString(),
  };

  const rows: SerializedDownloadRow[] = downloads.map((d) => ({
    id: d.id,
    email: d.email,
    firstName: d.firstName ?? null,
    firstTouchSource: d.firstTouchSource ?? null,
    firstTouchMedium: d.firstTouchMedium ?? null,
    firstTouchCampaign: d.firstTouchCampaign ?? null,
    createdAt: formatDateTime(d.createdAt) ?? d.createdAt.toDate().toISOString(),
  }));

  const sequenceOptions: SequenceOption[] = sequences.map((s) => ({
    id: s.id,
    name: s.name,
    active: s.active,
  }));

  return (
    <div className="page-fade-in" style={{ padding: "2rem 2rem 6rem" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <Link
          href="/admin/lead-magnets"
          style={{
            fontSize: "0.72rem",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--charcoal-muted)",
            textDecoration: "none",
          }}
        >
          ← Lead magnets
        </Link>
      </div>
      <LeadMagnetDetailClient
        magnet={serialized}
        downloads={rows}
        sequenceOptions={sequenceOptions}
      />
    </div>
  );
}
