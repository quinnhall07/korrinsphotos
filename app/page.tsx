// app/page.tsx
// Home page — single-path render: always renders <SectionsCanvas pageId="home">.
// No hand-coded fallback — the seed script guarantees published sections exist
// at runtime (Slice 1A). Admins use ?edit=1 to enter the on-page editor.

import { Footer } from "@/components/Footer";
import { loadPublishedSections, loadDraftSections } from "@/lib/db/site-content";
import { getSessionOrNull } from "@/lib/session";
import { listSiteAssets, listProjectPhotos } from "@/lib/db/site-assets";
import { SectionsCanvas } from "@/components/site-editor/SectionsCanvas";

// Admins use ?edit=1 to enter the on-page editor, so the home page must be
// dynamic. (The page used to ISR at 1h; we trade that for live admin editing.)
export const dynamic = "force-dynamic";

type Props = { searchParams?: Promise<{ edit?: string }> };

export default async function HomePage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const editParam = sp.edit === "1";

  const session = await getSessionOrNull();
  const isAdmin = session?.role === "ADMIN";

  // In edit mode, prefer the draft so unsaved-but-saved sections are shown.
  // Otherwise show whatever is published.
  const draft = isAdmin && editParam ? await loadDraftSections("home").catch(() => null) : null;
  const published = await loadPublishedSections("home").catch(() => null);
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
        pageId="home"
        pageLabel="Home"
        initialSections={sections ?? []}
        isAdmin={isAdmin}
        editParam={editParam}
        pickerData={pickerData}
      />
      <Footer />
    </div>
  );
}
