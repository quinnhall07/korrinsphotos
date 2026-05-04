// app/page.tsx
// Home page — fetches curated portfolio photos from Firestore.

import Link               from "next/link";
import { adminDb }        from "@/lib/firebase-admin";
import { MasonryGrid, type MasonryPhoto } from "@/components/MasonryGrid";
import { HeroSlideshow }  from "@/components/HeroSlideshow";
import { Footer }         from "@/components/Footer";
import { buildCdnUrl }    from "@/lib/cloudflare";

export const revalidate = 3600;

async function getCuratedPhotos(): Promise<MasonryPhoto[]> {
  // Query all events' photos where category is set (public portfolio photos)
  // In Firestore, portfolio photos are stored as subcollections.
  // For a simple home feed, we query a flat /portfolioPhotos collection
  // that mirrors the subcollection (maintained by the upload confirm route).
  // Alternatively, use a collectionGroup query:
  const snapshot = await adminDb
    .collectionGroup("photos")
    .where("category", "!=", null)
    .orderBy("category") // required before a second orderBy when using != filter
    .orderBy("uploadedAt", "desc")
    .limit(9)
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

// Dev placeholders — shown before any photos are uploaded
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
];

export default async function HomePage() {
  let photos = DEV_PHOTOS;
  try {
    const dbPhotos = await getCuratedPhotos();
    if (dbPhotos.length > 0) photos = dbPhotos;
  } catch {
    // Firestore not yet configured — use dev placeholders
  }

  return (
    <div style={{ paddingTop: "72px" }} className="page-fade-in">
      <HeroSlideshow />

      <section style={{ padding: "6rem 4rem" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "1.5rem", marginBottom: "3rem" }}>
          <span style={{ fontSize: "0.65rem", letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--olive)", fontWeight: 400, whiteSpace: "nowrap" }}>
            Selected Work
          </span>
          <div style={{ flex: 1, height: "0.5px", background: "var(--border)" }} />
        </div>

        <div style={{ maxWidth: "44rem", marginBottom: "4rem" }}>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(2.2rem, 4vw, 3.2rem)", fontWeight: 300, lineHeight: 1.2, letterSpacing: "-0.01em" }}>
            Stories told in<br /><em>light &amp; shadow</em>
          </h2>
          <p style={{ marginTop: "1.5rem", fontSize: "1.05rem", fontWeight: 300, lineHeight: 1.85, color: "var(--charcoal-light)" }}>
            A curated selection from recent sessions — each image a small universe, a moment suspended between the ordinary and the transcendent.
          </p>
        </div>

        <MasonryGrid photos={photos} columns={3} />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderTop: "0.5px solid var(--border)", borderBottom: "0.5px solid var(--border)", margin: "5rem 0" }}>
          {[
            { number: "340+", label: "Sessions Completed" },
            { number: "12",   label: "Years of Experience" },
            { number: "98%",  label: "Client Satisfaction" },
          ].map(({ number, label }, i) => (
            <div key={label} style={{ padding: "3rem 2rem", borderRight: i < 2 ? "0.5px solid var(--border)" : undefined }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "3.5rem", fontWeight: 300, lineHeight: 1, marginBottom: "0.5rem" }}>{number}</div>
              <div style={{ fontSize: "0.7rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--charcoal-muted)" }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: "var(--charcoal)", padding: "6rem 4rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "3rem" }}>
        <div>
          <p style={{ fontSize: "0.65rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--olive-light)", marginBottom: "1rem" }}>Ready to begin?</p>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 300, color: "var(--white)", lineHeight: 1.2 }}>
            Let&apos;s create something<br /><em>unforgettable together</em>
          </h2>
        </div>
        <div style={{ display: "flex", gap: "1rem", flexShrink: 0 }}>
          <Link href="/booking" style={{ display: "inline-block", padding: "0.85rem 2.2rem", fontSize: "0.72rem", letterSpacing: "0.14em", textTransform: "uppercase", background: "var(--olive)", color: "var(--white)", textDecoration: "none" }}>Book a Session</Link>
          <Link href="/portfolio" style={{ display: "inline-block", padding: "0.85rem 2.2rem", fontSize: "0.72rem", letterSpacing: "0.14em", textTransform: "uppercase", background: "transparent", color: "var(--white)", border: "0.5px solid rgba(250,249,246,0.4)", textDecoration: "none" }}>View Portfolio</Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}