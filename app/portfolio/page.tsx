// app/portfolio/page.tsx
// Public portfolio — fetches all portfolio photos from Firestore.

import { adminDb }         from "@/lib/firebase-admin";
import { buildCdnUrl }     from "@/lib/cloudflare";
import { PortfolioClient } from "./PortfolioClient";
import { Footer }          from "@/components/Footer";
import type { MasonryPhoto } from "@/components/MasonryGrid";
import type { Metadata }     from "next";

export const metadata: Metadata = {
  title:       "Portfolio",
  description: "The full collection — weddings, portraits, editorial, and landscape work by Korrin.",
};

export const revalidate = 3600;

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

export default async function PortfolioPage() {
  let photos = DEV_PHOTOS;
  try {
    const dbPhotos = await getAllPortfolioPhotos();
    if (dbPhotos.length > 0) photos = dbPhotos;
  } catch {
    // Firestore not yet configured — use dev placeholders
  }

  return (
    <div style={{ paddingTop: "72px" }} className="page-fade-in">
      <div style={{ padding: "4rem 4rem 3rem", borderBottom: "0.5px solid var(--border)", marginBottom: "3rem" }}>
        <p style={{ fontSize: "0.65rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--olive)", marginBottom: "1rem" }}>
          Korrin&apos;s Portfolio
        </p>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(2.5rem, 5vw, 4rem)", fontWeight: 300, letterSpacing: "-0.01em" }}>
          The full <em>collection</em>
        </h1>
      </div>

      <PortfolioClient photos={photos} />
      <Footer />
    </div>
  );
}