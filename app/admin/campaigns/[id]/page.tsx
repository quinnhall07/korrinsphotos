// app/admin/campaigns/[id]/page.tsx
// Detail view + full editor for a single campaign. Server Component loads
// the doc, serialises Timestamps, and delegates the UI to a client editor.

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { getCampaign, type CampaignDoc } from "@/lib/db/campaigns";
import {
  CampaignEditorClientPage,
  type SerializedCampaign,
} from "./CampaignEditorClientPage";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const c = await getCampaign(id).catch(() => null);
  return { title: c ? `${c.title} | Campaigns | Admin` : "Campaign | Admin" };
}

function serialise(doc: CampaignDoc): SerializedCampaign {
  return {
    id: doc.id,
    slug: doc.slug,
    status: doc.status,
    title: doc.title,
    heroTitle: doc.heroTitle,
    heroSubtitle: doc.heroSubtitle ?? null,
    heroPhotoCloudflareId: doc.heroPhotoCloudflareId ?? null,
    bodyHtml: doc.bodyHtml ?? "",
    ctaText: doc.ctaText,
    ctaHref: doc.ctaHref ?? null,
    galleryCategory: doc.galleryCategory ?? null,
    defaultUtm: doc.defaultUtm,
    inquiryPrefill: doc.inquiryPrefill ?? null,
    visitCount: doc.visitCount ?? 0,
    inquiryCount: doc.inquiryCount ?? 0,
    createdAt: doc.createdAt.toDate().toISOString(),
    updatedAt: doc.updatedAt.toDate().toISOString(),
  };
}

export default async function CampaignDetailPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  const campaign = await getCampaign(id);
  if (!campaign) notFound();

  return (
    <div className="page-fade-in" style={{ padding: "2.5rem 3rem" }}>
      <div style={{ marginBottom: "1.25rem" }}>
        <Link
          href="/admin/campaigns"
          style={{
            fontSize: "0.7rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--charcoal-muted)",
            textDecoration: "none",
          }}
        >
          ← All campaigns
        </Link>
      </div>

      <CampaignEditorClientPage campaign={serialise(campaign)} />
    </div>
  );
}
