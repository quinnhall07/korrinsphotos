// app/gallery/[id]/page.tsx
// Private event gallery. Enforces two layers of auth:
//   1. requireSession() — must be logged in
//   2. eventAccess lookup — must have been explicitly invited to this event
// Both checks happen server-side before any content is rendered.

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { adminDb } from "@/lib/firebase-admin";
import { buildCdnUrl } from "@/lib/cloudflare";
import { GalleryViewer } from "./GalleryViewer";
import type { MasonryPhoto } from "@/components/MasonryGrid";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const eventDoc = await adminDb.collection("events").doc(id).get();
  const title = eventDoc.exists ? (eventDoc.data()!.title as string) : "Gallery";
  return { title, description: `Private photo gallery — ${title}` };
}

async function getEventPhotos(eventId: string): Promise<MasonryPhoto[]> {
  const snap = await adminDb
    .collection("events")
    .doc(eventId)
    .collection("photos")
    .orderBy("uploadedAt", "asc")
    .get();

  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      src: buildCdnUrl(data.cloudflareImageId, "gallery"),
      thumbnailSrc: buildCdnUrl(data.cloudflareImageId, "thumbnail"),
      label: data.label ?? undefined,
      category: data.category ?? undefined,
    };
  });
}

export default async function GalleryEventPage({ params }: Props) {
  const { id } = await params;
  const session = await requireSession();

  // Verify this user has been invited to this event
  const accessId = `${session.uid}_${id}`;
  const accessDoc = await adminDb.collection("eventAccess").doc(accessId).get();

  // Admins always have access; clients need an explicit grant
  if (!accessDoc.exists && session.role !== "ADMIN") {
    notFound();
  }

  const eventDoc = await adminDb.collection("events").doc(id).get();
  if (!eventDoc.exists) notFound();

  const eventData = eventDoc.data()!;
  const photos = await getEventPhotos(id);

  return (
    <GalleryViewer
      eventId={id}
      eventTitle={eventData.title as string}
      eventDate={eventData.createdAt?.toDate()?.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }) ?? ""}
      photos={photos}
    />
  );
}