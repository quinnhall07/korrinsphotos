// app/admin/campaigns/page.tsx
// Lists every campaign in the CMS. Server Component fetches via lib/db,
// serialises Timestamps, and delegates to the client list page.

import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { listCampaigns } from "@/lib/db/campaigns";
import {
  CampaignsListClientPage,
  type SerializedCampaignRow,
} from "./CampaignsListClientPage";

export const metadata: Metadata = { title: "Campaigns | Admin" };
export const dynamic = "force-dynamic";

export default async function AdminCampaignsPage() {
  await requireAdmin();

  let rows: SerializedCampaignRow[] = [];
  let error: string | null = null;

  try {
    const docs = await listCampaigns();
    rows = docs.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      status: c.status,
      visitCount: c.visitCount ?? 0,
      inquiryCount: c.inquiryCount ?? 0,
      defaultUtm: c.defaultUtm,
      createdAt: c.createdAt.toDate().toISOString(),
      updatedAt: c.updatedAt.toDate().toISOString(),
    }));
  } catch (err) {
    console.error("Failed to list campaigns:", err);
    error = err instanceof Error ? err.message : "Failed to load campaigns.";
  }

  if (error) {
    return (
      <div className="page-fade-in">
        <div
          style={{
            padding: "2rem",
            border: "0.5px solid #FCA5A5",
            background: "#FEF2F2",
            color: "#991B1B",
            fontSize: "0.88rem",
            lineHeight: 1.7,
          }}
        >
          <strong>Error loading campaigns</strong>
          <br />
          {error}
        </div>
      </div>
    );
  }

  return <CampaignsListClientPage rows={rows} />;
}
