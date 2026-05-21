// app/portfolio/page.tsx
// Public portfolio — fetches all portfolio photos from Firestore.
// The page header (eyebrow + heading + intro) is editable via the site
// editor at `/admin/site/portfolio` — once a draft is published, those
// sections render above the photo grid in place of the static header.

import { adminDb }         from "@/lib/firebase-admin";
import { buildCdnUrl }     from "@/lib/cloudflare";
import { PortfolioClient } from "./PortfolioClient";
import { Footer }          from "@/components/Footer";
import type { MasonryPhoto } from "@/components/MasonryGrid";
import type { Metadata }     from "next";
import { loadPublishedSections, loadDraftSections } from "@/lib/db/site-content";
import { getSessionOrNull } from "@/lib/session";
import { listSiteAssets, listProjectPhotos } from "@/lib/db/site-assets";
import { SectionsCanvas } from "@/components/site-editor/SectionsCanvas";
import { FloatingEditPill } from "@/components/site-editor/FloatingEditPill";

export const metadata: Metadata = {
  title:       "Portfolio",
  description: "The full collection — weddings, portraits, editorial, and landscape work by Korrin.",
};

export const dynamic = "force-dynamic";

type Props = { searchParams?: Promise<{ edit?: string }> };

async function getAllPortfolioPhotos(): Promise<MasonryPhoto[]> {
  const snapshot = await adminDb
    .collectionGroup("photos")
    .where("category", "!=", null)
    .orderBy("category")
    .orderBy("uploadedAt", "desc")
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id:           doc.id,
      src:          buildCdnUrl(data.cloudflareImageId, "gallery"),
      thumbnailSrc: buildCdnUrl(data.cloudflareImageId, "thumbnail"),
      label:        data.label ?? data.category ?? "",
      category:     data.category ?? undefined,
    };
  });
}

const DEV_PHOTOS: MasonryPhoto[] = [
  { id: "1",  src: "https://picsum.photos/seed/photo11/600/280", label: "Golden Hour", category: "wedding" },
  { id: "2",  src: "https://picsum.photos/seed/photo22/600/340", label: "Portrait",    category: "portrait" },
  { id: "3",  src: "https://picsum.photos/seed/photo33/600/260", label: "Editorial",   category: "editorial" },
  { id: "4",  src: "https://picsum.photos/seed/photo44/600/420", label: "Landscape",   category: "landscape" },
  { id: "5",  src: "https://picsum.photos/seed/photo55/600/300", label: "Wedding",     category: "wedding" },
  { id: "6",  src: "https://picsum.photos/seed/photo66/600/380", label: "Portrait",    category: "portrait" },
  { id: "7",  src: "https://picsum.photos/seed/photo77/600/250", label: "Editorial",   category: "editorial" },
  { id: "8",  src: "https://picsum.photos/seed/photo88/600/350", label: "Landscape",   category: "landscape" },
  { id: "9",  src: "https://picsum.photos/seed/photo99/600/290", label: "Wedding",     category: "wedding" },
  { id: "10", src: "https://picsum.photos/seed/nature1/600/270", label: "Nature",      category: "landscape" },
  { id: "11", src: "https://picsum.photos/seed/nature2/600/360", label: "Forest",      category: "landscape" },
  { id: "12", src: "https://picsum.photos/seed/portrait1/600/230", label: "Studio",    category: "portrait" },
  { id: "13", src: "https://picsum.photos/seed/wedding1/600/390", label: "Ceremony",   category: "wedding" },
  { id: "14", src: "https://picsum.photos/seed/edit1/600/310",   label: "Fashion",     category: "editorial" },
  { id: "15", src: "https://picsum.photos/seed/edit2/600/440",   label: "Concept",     category: "editorial" },
  { id: "16", src: "https://picsum.photos/seed/land1/600/280",   label: "Golden",      category: "landscape" },
  { id: "17", src: "https://picsum.photos/seed/wed2/600/320",    label: "Reception",   category: "wedding" },
  { id: "18", src: "https://picsum.photos/seed/photo10/600/290", label: "Portrait",    category: "portrait" },
];

export default async function PortfolioPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const editParam = sp.edit === "1";
  const session = await getSessionOrNull();
  const isAdmin = session?.role === "ADMIN";

  let photos = DEV_PHOTOS;
  try {
    const dbPhotos = await getAllPortfolioPhotos();
    if (dbPhotos.length > 0) photos = dbPhotos;
  } catch {
    // Firestore not yet configured — use dev placeholders
  }

  const draft = isAdmin && editParam ? await loadDraftSections("portfolio").catch(() => null) : null;
  const published = await loadPublishedSections("portfolio").catch(() => null);
  const sections = draft ?? published;

  const renderCanvas = (sections && sections.length > 0) || (isAdmin && editParam);
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
      {renderCanvas ? (
        <SectionsCanvas
          pageId="portfolio"
          pageLabel="Portfolio"
          initialSections={sections && sections.length > 0 ? sections : []}
          isAdmin={isAdmin}
          editParam={editParam}
          pickerData={pickerData}
        />
      ) : (
        <div style={{ padding: "4rem 4rem 3rem", borderBottom: "0.5px solid var(--border)", marginBottom: "3rem" }}>
          <p style={{ fontSize: "0.65rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--olive)", marginBottom: "1rem" }}>
            Korrin&apos;s Portfolio
          </p>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(2.5rem, 5vw, 4rem)", fontWeight: 300, letterSpacing: "-0.01em" }}>
            The full <em>collection</em>
          </h1>
        </div>
      )}

      <PortfolioClient photos={photos} />
      <Footer />
      {isAdmin && !editParam && <FloatingEditPill pageLabel="Portfolio" />}
    </div>
  );
}