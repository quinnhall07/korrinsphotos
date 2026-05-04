// app/admin/events/[id]/page.tsx
// Admin event detail — upload photos, manage client access, review the gallery.
// All data fetched server-side; interactive sections handed to Client Components.

import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { adminDb } from "@/lib/firebase-admin";
import { buildCdnUrl } from "@/lib/cloudflare";
import { UploadZone } from "./UploadZone";
import { InvitePanel } from "./InvitePanel";
import { PhotoGrid } from "./PhotoGrid";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const doc = await adminDb.collection("events").doc(id).get();
  const title = doc.exists ? (doc.data()!.title as string) : "Event";
  return { title: `${title} | Admin` };
}

type ClientAccess = {
  userId: string;
  email: string;
  invitedAt: string;
};

type Photo = {
  id: string;
  thumbnailSrc: string;
  label: string | null;
  cloudflareImageId: string;
  r2Key: string | null;
};

async function getEventData(eventId: string) {
  const [eventDoc, photosSnap, accessSnap] = await Promise.all([
    adminDb.collection("events").doc(eventId).get(),
    adminDb
      .collection("events")
      .doc(eventId)
      .collection("photos")
      .orderBy("uploadedAt", "asc")
      .get(),
    adminDb
      .collection("eventAccess")
      .where("eventId", "==", eventId)
      .orderBy("createdAt", "asc")
      .get(),
  ]);

  if (!eventDoc.exists) return null;

  const photos: Photo[] = photosSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      thumbnailSrc: buildCdnUrl(data.cloudflareImageId, "thumbnail"),
      label: data.label ?? null,
      cloudflareImageId: data.cloudflareImageId as string,
      r2Key: data.r2Key ?? null,
    };
  });

  // Fetch emails for each access entry
  const clients: ClientAccess[] = await Promise.all(
    accessSnap.docs.map(async (doc) => {
      const data = doc.data();
      const userDoc = await adminDb.collection("users").doc(data.userId).get();
      return {
        userId: data.userId as string,
        email: (userDoc.data()?.email as string) ?? "unknown",
        invitedAt: data.createdAt?.toDate
          ? data.createdAt.toDate().toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "—",
      };
    })
  );

  return {
    event: {
      id: eventId,
      title: eventDoc.data()!.title as string,
      createdAt: eventDoc.data()!.createdAt?.toDate?.()?.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }) ?? "—",
    },
    photos,
    clients,
  };
}

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params;
  await requireAdmin();

  const data = await getEventData(id);
  if (!data) notFound();

  const { event, photos, clients } = data;

  return (
    <div className="page-fade-in">
      {/* Breadcrumb + header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "2.5rem",
          gap: "2rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.78rem",
              color: "var(--charcoal-muted)",
              marginBottom: "0.75rem",
            }}
          >
            <Link
              href="/admin/events"
              style={{
                color: "var(--charcoal-muted)",
                textDecoration: "none",
                transition: "color 0.2s",
              }}
            >
              Events
            </Link>
            <span>/</span>
            <span style={{ color: "var(--charcoal)" }}>{event.title}</span>
          </div>
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "2rem",
              fontWeight: 300,
              marginBottom: "0.25rem",
            }}
          >
            {event.title}
          </h2>
          <p style={{ fontSize: "0.8rem", color: "var(--charcoal-muted)" }}>
            {photos.length} photo{photos.length !== 1 ? "s" : ""} · {clients.length} client
            {clients.length !== 1 ? "s" : ""} · Created {event.createdAt}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexShrink: 0 }}>
          <Link
            href={`/gallery/${event.id}`}
            target="_blank"
            style={{
              display: "inline-block",
              padding: "0.6rem 1.4rem",
              fontSize: "0.68rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              background: "var(--olive)",
              color: "var(--white)",
              textDecoration: "none",
            }}
          >
            Preview as Client
          </Link>
        </div>
      </div>

      {/* Upload zone */}
      <div
        style={{
          border: "0.5px solid var(--border)",
          background: "var(--white)",
          marginBottom: "2rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1.2rem 1.5rem",
            borderBottom: "0.5px solid var(--border)",
          }}
        >
          <span
            style={{
              fontSize: "0.72rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--charcoal)",
              fontWeight: 500,
            }}
          >
            Upload Photos
          </span>
          <span style={{ fontSize: "0.72rem", color: "var(--charcoal-muted)" }}>
            Cloudflare R2 · Direct upload pipeline
          </span>
        </div>
        <div style={{ padding: "1.5rem" }}>
          <UploadZone eventId={event.id} />
        </div>
      </div>

      {/* Client access panel */}
      <InvitePanel eventId={event.id} clients={clients} />

      {/* Photo grid */}
      {photos.length > 0 && (
        <div
          style={{
            border: "0.5px solid var(--border)",
            background: "var(--white)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "1.2rem 1.5rem",
              borderBottom: "0.5px solid var(--border)",
            }}
          >
            <span
              style={{
                fontSize: "0.72rem",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--charcoal)",
                fontWeight: 500,
              }}
            >
              Gallery Photos ({photos.length})
            </span>
          </div>
          <div style={{ padding: "1rem" }}>
            <PhotoGrid eventId={event.id} photos={photos} />
          </div>
        </div>
      )}
    </div>
  );
}