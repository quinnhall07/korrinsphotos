// app/admin/events/[id]/gallery/page.tsx
// Admin-side gallery preparation page.
// Allows admins to view all photos, toggle "gallery-ready" status,
// and select photos for client-facing gallery delivery.

import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { adminDb } from "@/lib/firebase-admin";
import { buildCdnUrl } from "@/lib/cloudflare";
import { GalleryEditor } from "./GalleryEditor";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const doc = await adminDb.collection("events").doc(id).get();
  const title = doc.exists ? (doc.data()!.title as string) : "Event";
  return { title: `Gallery | ${title} | Admin` };
}

type GalleryPhoto = {
  id: string;
  thumbnailSrc: string;
  gallerySrc: string;
  label: string | null;
  cloudflareImageId: string;
  galleryReady: boolean;
};

async function getGalleryData(eventId: string) {
  const [eventDoc, photosSnap] = await Promise.all([
    adminDb.collection("events").doc(eventId).get(),
    adminDb.collection("events").doc(eventId).collection("photos").orderBy("uploadedAt", "asc").get(),
  ]);

  if (!eventDoc.exists) return null;

  const photos: GalleryPhoto[] = photosSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      thumbnailSrc: buildCdnUrl(data.cloudflareImageId, "thumbnail"),
      gallerySrc: buildCdnUrl(data.cloudflareImageId, "gallery"),
      label: data.label ?? null,
      cloudflareImageId: data.cloudflareImageId as string,
      galleryReady: data.galleryReady === true,
    };
  });

  return {
    title: eventDoc.data()!.title as string,
    photos,
  };
}

export default async function GalleryPage({ params }: Props) {
  const { id } = await params;
  await requireAdmin();

  const data = await getGalleryData(id);
  if (!data) notFound();

  const readyCount = data.photos.filter((p) => p.galleryReady).length;

  return (
    <div className="page-fade-in">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "2rem", gap: "2rem", flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.78rem", color: "var(--charcoal-muted)", marginBottom: "0.75rem" }}>
            <Link href="/admin/events" style={{ color: "var(--charcoal-muted)", textDecoration: "none" }}>Events</Link>
            <span>/</span>
            <Link href={`/admin/events/${id}`} style={{ color: "var(--charcoal-muted)", textDecoration: "none" }}>{data.title}</Link>
            <span>/</span>
            <span style={{ color: "var(--charcoal)" }}>Gallery</span>
          </div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "2rem", fontWeight: 300 }}>
            Gallery Upload
          </h2>
          <p style={{ fontSize: "0.8rem", color: "var(--charcoal-muted)", marginTop: "0.25rem" }}>
            {data.photos.length} photo{data.photos.length !== 1 ? "s" : ""} · {readyCount} gallery-ready
          </p>
        </div>
      </div>

      {data.photos.length === 0 ? (
        <div
          style={{
            padding: "3rem",
            textAlign: "center",
            border: "0.5px solid var(--border)",
            background: "var(--white)",
            color: "var(--charcoal-muted)",
            fontSize: "0.88rem",
          }}
        >
          No photos uploaded yet. <Link href={`/admin/events/${id}`} style={{ color: "var(--olive)" }}>Upload photos first →</Link>
        </div>
      ) : (
        <GalleryEditor eventId={id} photos={data.photos} />
      )}
    </div>
  );
}
