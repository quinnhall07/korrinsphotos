// app/gallery/[id]/page.tsx
// Private event gallery. Enforces two layers of auth:
//   1. requireSession() — must be logged in
//   2. eventAccess lookup — must have been explicitly invited to this event
// Both checks happen server-side before any content is rendered.

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { adminDb } from "@/lib/firebase-admin";
import { buildCdnUrl } from "@/lib/cloudflare";
import { getClientByEmail } from "@/lib/db/clients";
import { GalleryViewer, type GalleryPhoto } from "./GalleryViewer";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const eventDoc = await adminDb.collection("events").doc(id).get();
  const title = eventDoc.exists ? (eventDoc.data()!.title as string) : "Gallery";
  return { title, description: `Private photo gallery — ${title}` };
}

async function getEventPhotos(eventId: string): Promise<GalleryPhoto[]> {
  const snap = await adminDb
    .collection("events")
    .doc(eventId)
    .collection("photos")
    .where("galleryReady", "==", true)
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
      favoritedBy: (data.favoritedBy as string[] | undefined) ?? [],
      tags: (data.tags as string[] | undefined) ?? [],
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

  // Phase 2.5 — resolve session.email → clientId so the viewer can mark
  // hearts as active for the signed-in client. Admins share an "admin:<uid>"
  // namespace so admin-preview favorites don't pollute a real client's list.
  let viewerClientId: string | null = null;
  if (session.role === "ADMIN") {
    viewerClientId = `admin:${session.uid}`;
  } else if (session.email) {
    const client = await getClientByEmail(session.email);
    viewerClientId = client?.id ?? null;
  }

  // Phase 2.11 NPS surface: only ADMIN previews and the actual project
  // owner should see the rating widget. We pull the existing rating (if
  // any) here so the viewer can decide whether to render or hide the UI.
  const eventStatus = (eventData.status as string | undefined) ?? null;
  const projectId = (eventData.projectId as string | undefined) ?? null;
  let existingNps: 1 | 2 | 3 | 4 | 5 | null = null;
  let canSubmitNps = false;
  if (projectId) {
    const projectSnap = await adminDb.collection("projects").doc(projectId).get();
    if (projectSnap.exists) {
      const p = projectSnap.data()!;
      const raw = p.clientNps as number | undefined;
      if (raw && raw >= 1 && raw <= 5) {
        existingNps = raw as 1 | 2 | 3 | 4 | 5;
      }
      // Owner check: signed-in email matches the project's client email.
      if (session.role === "ADMIN") {
        canSubmitNps = true;
      } else {
        const clientId = p.clientId as string | undefined;
        if (clientId) {
          const clientSnap = await adminDb.collection("clients").doc(clientId).get();
          const clientEmail = (clientSnap.data()?.email as string | undefined) ?? "";
          if (
            session.email &&
            clientEmail.toLowerCase() === session.email.toLowerCase()
          ) {
            canSubmitNps = true;
          }
        }
      }
    }
  }

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
      eventStatus={eventStatus}
      existingNps={existingNps}
      canSubmitNps={canSubmitNps}
      viewerClientId={viewerClientId}
    />
  );
}