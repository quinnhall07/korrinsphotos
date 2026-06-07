// app/booking/page.tsx
// Booking inquiry page — single-path render via <SectionsCanvas pageId="booking">.
// The BOOKING_FORM section block (rendered inside lib/site-content/render.tsx)
// contains the <BookingFormSteps> component with its own Suspense wrapper.
// No hand-coded fallback — the seed script guarantees published sections exist
// at runtime (Slice 1A).

import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { loadPublishedSections, loadDraftSections } from "@/lib/db/site-content";
import { getSessionOrNull } from "@/lib/session";
import { listSiteAssets, listProjectPhotos } from "@/lib/db/site-assets";
import { SectionsCanvas } from "@/components/site-editor/SectionsCanvas";

export const metadata: Metadata = {
  title: "Booking",
  description:
    "Book a photography session — weddings, portraits, editorial, and more.",
};

export const dynamic = "force-dynamic";

type Props = { searchParams?: Promise<{ edit?: string }> };

export default async function BookingPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const editParam = sp.edit === "1";
  const session = await getSessionOrNull();
  const isAdmin = session?.role === "ADMIN";

  const draft = isAdmin && editParam ? await loadDraftSections("booking").catch(() => null) : null;
  const published = await loadPublishedSections("booking").catch(() => null);
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
        pageId="booking"
        pageLabel="Booking"
        initialSections={sections ?? []}
        isAdmin={isAdmin}
        editParam={editParam}
        pickerData={pickerData}
      />
      <Footer />
    </div>
  );
}
