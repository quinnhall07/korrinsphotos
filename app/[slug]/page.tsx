// app/[slug]/page.tsx
// Catch-all renderer for admin-created pages (Phase 2 — site editor).
//
// Resolution order:
//   1. Bail to notFound() if `slug` is in the reserved list — every existing
//      top-level route must keep working.
//   2. Bail to notFound() if `slug` is a built-in editable page (home,
//      investment, portfolio, about, footer) — those are rendered by their
//      own routes.
//   3. Read `siteContent/{slug}.publishedSections`; render via renderSections.
//      No published doc → notFound(). Draft-only docs are NEVER rendered on
//      the public site.
//
// The reserved-name guard is the single source of truth for "what slugs can
// the admin create." Keep it in sync with the top-level directories under
// app/ — anything that already maps to a route must stay off-limits.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { loadPublishedSections, loadDraftSections } from "@/lib/db/site-content";
import { isReservedSlug } from "@/lib/site-content/slugs";
import { getSessionOrNull } from "@/lib/session";
import { listSiteAssets, listProjectPhotos } from "@/lib/db/site-assets";
import { SectionsCanvas } from "@/components/site-editor/SectionsCanvas";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ edit?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (isReservedSlug(slug)) return {};
  const published = await loadPublishedSections(slug);
  if (!published) return {};
  return { title: slug.charAt(0).toUpperCase() + slug.slice(1) };
}

export default async function CustomPage({ params, searchParams }: Props) {
  const { slug } = await params;
  if (isReservedSlug(slug)) notFound();
  const sp = (await searchParams) ?? {};
  const editParam = sp.edit === "1";

  const session = await getSessionOrNull();
  const isAdmin = session?.role === "ADMIN";

  // Admins in edit mode see the draft (so unpublished sections are editable
  // before they go live). Otherwise the public catch-all only renders
  // published docs — draft-only pages stay invisible to visitors.
  const draft = isAdmin && editParam ? await loadDraftSections(slug).catch(() => null) : null;
  const published = await loadPublishedSections(slug).catch(() => null);
  const sections = draft ?? published;
  if (!sections && !(isAdmin && editParam)) notFound();

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
        pageId={slug}
        pageLabel={slug.charAt(0).toUpperCase() + slug.slice(1)}
        initialSections={sections ?? []}
        isAdmin={isAdmin}
        editParam={editParam}
        pickerData={pickerData}
      />
      <Footer />
    </div>
  );
}
