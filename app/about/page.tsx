// app/about/page.tsx
// Public About page. Edited via the on-page editor at /about?edit=1;
// falls back to ABOUT_DEFAULTS when no draft has been published.
//
// This route exists so /about is reserved in the catch-all and has a stable
// SEO surface. The body itself is 100% CMS-driven.

import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { loadPublishedSections, loadDraftSections } from "@/lib/db/site-content";
import { ABOUT_DEFAULTS } from "@/lib/site-content/defaults/about";
import { getSessionOrNull } from "@/lib/session";
import { listSiteAssets, listProjectPhotos } from "@/lib/db/site-assets";
import { SectionsCanvas } from "@/components/site-editor/SectionsCanvas";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About",
  description: "About Korrin — photographer based in Louisville, KY, relocating to Tuscaloosa, AL for Fall 2026.",
};

type Props = { searchParams?: Promise<{ edit?: string }> };

export default async function AboutPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const editParam = sp.edit === "1";
  const session = await getSessionOrNull();
  const isAdmin = session?.role === "ADMIN";

  const draft = isAdmin && editParam ? await loadDraftSections("about").catch(() => null) : null;
  const published = await loadPublishedSections("about").catch(() => null);
  const sections = draft ?? (published && published.length > 0 ? published : ABOUT_DEFAULTS);

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
        pageId="about"
        pageLabel="About"
        initialSections={sections}
        isAdmin={isAdmin}
        editParam={editParam}
        pickerData={pickerData}
      />
      <Footer />
    </div>
  );
}
