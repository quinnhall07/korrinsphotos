// app/pricing/page.tsx
// Public Pricing page. Reads sections from `siteContent/pricing` once an
// admin has published a draft via /admin/site/pricing.
//
// Single-path render: always renders <SectionsCanvas pageId="pricing"> with
// sections ?? []. No hand-coded fallback JSX — the seed script guarantees
// published sections exist at runtime (Slice 1A).

import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { loadPublishedSections, loadDraftSections } from "@/lib/db/site-content";
import { getSessionOrNull } from "@/lib/session";
import { listSiteAssets, listProjectPhotos } from "@/lib/db/site-assets";
import { SectionsCanvas } from "@/components/site-editor/SectionsCanvas";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pricing | Korrin's Photos",
  description:
    "Pricing guide for Korrin's Photography — portrait, engagement, and wedding packages. A long-term decision in light, intention, and craft.",
};

type Props = { searchParams?: Promise<{ edit?: string }> };

export default async function PricingPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const editParam = sp.edit === "1";
  const session = await getSessionOrNull();
  const isAdmin = session?.role === "ADMIN";

  const draft = isAdmin && editParam ? await loadDraftSections("pricing").catch(() => null) : null;
  const published = await loadPublishedSections("pricing").catch(() => null);
  const sections = draft ?? published;

  const pickerData = isAdmin
    ? {
        siteAssets: (await listSiteAssets()).map((a) => ({
          id: a.id,
          cloudflareImageId: a.cloudflareImageId,
          label: a.label,
          altText: a.altText,
        })),
        projectPhotos: (await listProjectPhotos()).map((p) => ({
          photoId: p.photoId,
          eventId: p.eventId,
          cloudflareImageId: p.cloudflareImageId,
          label: p.label,
          category: p.category,
        })),
      }
    : { siteAssets: [], projectPhotos: [] };

  return (
    <div style={{ paddingTop: "72px" }} className="page-fade-in">
      <SectionsCanvas
        pageId="pricing"
        pageLabel="Pricing"
        initialSections={sections ?? []}
        isAdmin={isAdmin}
        editParam={editParam}
        pickerData={pickerData}
      />
      <Footer />
    </div>
  );
}
