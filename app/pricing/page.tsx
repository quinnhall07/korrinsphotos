// app/pricing/page.tsx
// Public Pricing page. Reads sections from `siteContent/pricing` once an
// admin has published a draft via /admin/site/pricing.
//
// Single-path render: always renders <SectionsCanvas pageId="pricing"> with
// sections ?? []. No hand-coded fallback JSX — the seed script guarantees
// published sections exist at runtime (Slice 1A).
//
// JSON-LD: one Service schema per package + a BreadcrumbList are emitted
// unconditionally (outside the SectionsCanvas branch) so crawlers always
// receive structured data regardless of whether Firestore has sections.

import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import {
  buildBreadcrumbSchema,
  buildServiceSchema,
} from "@/lib/seo/schema";
import { INVESTMENT_PACKAGES } from "./packages";
import { loadPublishedSections, loadDraftSections } from "@/lib/db/site-content";
import { getSessionOrNull } from "@/lib/session";
import { listSiteAssets, listProjectPhotos } from "@/lib/db/site-assets";
import { SectionsCanvas } from "@/components/site-editor/SectionsCanvas";
import { INVESTMENT_DEFAULTS } from "@/lib/site-content/defaults/investment";

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

  // JSON-LD: one Service per package + a breadcrumb for the page itself.
  // Rendered unconditionally so structured data is present even if Firestore
  // sections are empty. buildServiceSchema accepts a category slug that maps
  // onto the recognised labelMap in lib/seo/schema.ts.
  const jsonLd = [
    buildBreadcrumbSchema([
      { name: "Home",    url: "/" },
      { name: "Pricing", url: "/pricing" },
    ]),
    ...INVESTMENT_PACKAGES.map((p) =>
      buildServiceSchema(p.sessionType.toLowerCase()),
    ),
  ];

  return (
    <div style={{ paddingTop: "72px" }} className="page-fade-in">
      {/* JsonLd's `data` is typed against a generic recursive JSON shape;
          the schema builders return narrowly-typed schema.org objects, so
          we widen at the boundary rather than complicate the helpers. */}
      <JsonLd data={jsonLd as unknown as Parameters<typeof JsonLd>[0]["data"]} />
      <SectionsCanvas
        pageId="pricing"
        pageLabel="Pricing"
        initialSections={sections ?? INVESTMENT_DEFAULTS}
        isAdmin={isAdmin}
        editParam={editParam}
        pickerData={pickerData}
      />
      <Footer />
    </div>
  );
}
