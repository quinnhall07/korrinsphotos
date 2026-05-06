// app/admin/events/[id]/page.tsx
// Admin event detail — upload photos, manage client access, review the gallery.
// Includes Google Calendar "Add to Calendar" integration.

import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { adminDb } from "@/lib/firebase-admin";
import { buildCdnUrl } from "@/lib/cloudflare";
import { UploadZone } from "./UploadZone";
import { InvitePanel } from "./InvitePanel";
import { PhotoGrid } from "./PhotoGrid";
import { AddToCalendarButton } from "./AddToCalendarButton";
import { TitleEditor } from "./TitleEditor";
import { ShootDateEditor } from "./ShootDateEditor";
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
    adminDb.collection("events").doc(eventId).collection("photos").orderBy("uploadedAt", "asc").get(),
    adminDb.collection("eventAccess").where("eventId", "==", eventId).get(),
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

  const clients: ClientAccess[] = await Promise.all(
    accessSnap.docs.map(async (doc) => {
      const data = doc.data();
      const userDoc = await adminDb.collection("users").doc(data.userId).get();
      return {
        userId: data.userId as string,
        email: (userDoc.data()?.email as string) ?? "unknown",
        invitedAt: data.createdAt?.toDate
          ? data.createdAt.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
          : "—",
      };
    })
  );

  const eventData = eventDoc.data()!;

  // Parse shoot dates
  const shootDate = eventData.shootDate?.toDate?.() ?? null;
  const shootEndDate = eventData.shootEndDate?.toDate?.() ?? null;
  const calendarDate = shootDate ?? eventData.createdAt?.toDate?.() ?? new Date();

  return {
    event: {
      id: eventId,
      title: eventData.title as string,
      createdAt: eventData.createdAt?.toDate?.() ?? new Date(),
      createdAtFormatted: eventData.createdAt?.toDate?.()?.toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric",
      }) ?? "—",
      shootDate: shootDate ? shootDate.toISOString().slice(0, 10) : "",
      shootEndDate: shootEndDate ? shootEndDate.toISOString().slice(0, 10) : "",
      calendarDate: calendarDate.toISOString(),
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
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "2.5rem", gap: "2rem", flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.78rem", color: "var(--charcoal-muted)", marginBottom: "0.75rem" }}>
            <Link href="/admin/events" style={{ color: "var(--charcoal-muted)", textDecoration: "none" }}>
              Events
            </Link>
            <span>/</span>
            <span style={{ color: "var(--charcoal)" }}>{event.title}</span>
          </div>
          <TitleEditor eventId={event.id} initialTitle={event.title} />
          <ShootDateEditor
            eventId={event.id}
            initialShootDate={event.shootDate}
            initialShootEndDate={event.shootEndDate}
          />
          <p style={{ fontSize: "0.8rem", color: "var(--charcoal-muted)", marginTop: "0.5rem" }}>
            {photos.length} photo{photos.length !== 1 ? "s" : ""} · {clients.length} client{clients.length !== 1 ? "s" : ""} · Created {event.createdAtFormatted}
          </p>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: "0.75rem", flexShrink: 0, flexWrap: "wrap" }}>
          {/* Google Calendar button — client component */}
          <AddToCalendarButton eventTitle={event.title} eventDate={event.calendarDate} />

          <Link
            href={`/admin/events/${event.id}/gallery`}
            style={{
              display: "inline-block",
              padding: "0.6rem 1.4rem",
              fontSize: "0.68rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--charcoal)",
              border: "0.5px solid var(--border-strong)",
              textDecoration: "none",
            }}
          >
            Gallery Upload
          </Link>

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
      <div style={{ border: "0.5px solid var(--border)", background: "var(--white)", marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.2rem 1.5rem", borderBottom: "0.5px solid var(--border)" }}>
          <span style={{ fontSize: "0.72rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--charcoal)", fontWeight: 500 }}>
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
        <div style={{ border: "0.5px solid var(--border)", background: "var(--white)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.2rem 1.5rem", borderBottom: "0.5px solid var(--border)" }}>
            <span style={{ fontSize: "0.72rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--charcoal)", fontWeight: 500 }}>
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