// app/admin/events/[id]/page.tsx
// Admin event detail — upload photos, manage client access, review the gallery.
// Includes Google Calendar "Add to Calendar" integration.

import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { adminDb } from "@/lib/firebase-admin";
import { buildCdnUrl } from "@/lib/cloudflare";
import { getClient } from "@/lib/db/clients";
import { UploadZone } from "./UploadZone";
import { InvitePanel } from "./InvitePanel";
import { PhotoGrid } from "./PhotoGrid";
import { AddToCalendarButton } from "./AddToCalendarButton";
import { TitleEditor } from "./TitleEditor";
import { ShootDateEditor } from "./ShootDateEditor";
import { EventActions } from "./EventActions";
import { DownloadPinEditor } from "./DownloadPinEditor";
import { NotifyGalleryReadyButton } from "./NotifyGalleryReadyButton";
import { formatDisplayDate } from "@/lib/date";
import type { EventStatus } from "@/lib/db/events";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const VALID_EVENT_STATUSES: ReadonlySet<EventStatus> = new Set([
  "UPCOMING",
  "ACTIVE",
  "COMPLETED",
  "DELIVERED",
  "ARCHIVED",
]);

function coerceEventStatus(raw: unknown): EventStatus {
  return typeof raw === "string" && VALID_EVENT_STATUSES.has(raw as EventStatus)
    ? (raw as EventStatus)
    : "UPCOMING";
}

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
  favoritedBy: string[];
  tags: string[];
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
      favoritedBy: (data.favoritedBy as string[] | undefined) ?? [],
      tags: (data.tags as string[] | undefined) ?? [],
    };
  });

  const clients: ClientAccess[] = await Promise.all(
    accessSnap.docs.map(async (doc) => {
      const data = doc.data();
      const userDoc = await adminDb.collection("users").doc(data.userId).get();
      return {
        userId: data.userId as string,
        email: (userDoc.data()?.email as string) ?? "unknown",
        invitedAt: formatDisplayDate(data.createdAt) ?? "—",
      };
    })
  );

  // Phase 2.5 — resolve every clientId surfaced by `photos[].favoritedBy`
  // into a display label so the favorites modal can render real names. The
  // `admin:<uid>` namespace (used when an admin previews-as-client) falls
  // back to a generic label so we don't hit Firestore for non-existent docs.
  const allClientIds = new Set<string>();
  for (const p of photos) {
    for (const cid of p.favoritedBy) allClientIds.add(cid);
  }
  const clientLabels: Record<string, string> = {};
  await Promise.all(
    Array.from(allClientIds).map(async (cid) => {
      if (cid.startsWith("admin:")) {
        clientLabels[cid] = "Admin preview";
        return;
      }
      try {
        const snap = await adminDb.collection("clients").doc(cid).get();
        if (snap.exists) {
          const d = snap.data()!;
          const name = `${(d.firstName as string) ?? ""} ${(d.lastName as string) ?? ""}`.trim();
          clientLabels[cid] = name || (d.email as string) || cid;
        } else {
          clientLabels[cid] = cid;
        }
      } catch {
        clientLabels[cid] = cid;
      }
    })
  );

  const eventData = eventDoc.data()!;

  // Parse shoot dates
  const calendarDate = eventData.startDate
    ? new Date(eventData.startDate + (eventData.startTime ? `T${eventData.startTime}` : "T12:00:00"))
    : (eventData.createdAt?.toDate?.() ?? new Date());

  // UX P0 (g) — Resolve linked Client display name for the header chip.
  // Only renders when the event has a clientId; the "View project" link
  // requires both clientId AND projectId.
  const linkedClientId = (eventData.clientId as string | undefined) ?? null;
  const linkedProjectId = (eventData.projectId as string | undefined) ?? null;
  let linkedClientFirstName: string | null = null;
  if (linkedClientId) {
    try {
      const linkedClient = await getClient(linkedClientId);
      if (linkedClient) {
        const fn = (linkedClient.firstName ?? "").trim();
        linkedClientFirstName = fn.length > 0
          ? fn
          : (linkedClient.email ?? null);
      }
    } catch {
      // Best-effort: leave linkedClientFirstName null on lookup failure.
    }
  }

  return {
    event: {
      id: eventId,
      title: eventData.title as string,
      status: coerceEventStatus(eventData.status),
      createdAt: eventData.createdAt?.toDate?.() ?? new Date(),
      createdAtFormatted: formatDisplayDate(eventData.createdAt) ?? "—",
      startDate: (eventData.startDate as string) || "",
      endDate: (eventData.endDate as string) || "",
      startTime: (eventData.startTime as string) || "",
      endTime: (eventData.endTime as string) || "",
      isMultiDay: (eventData.isMultiDay as boolean) || false,
      location: (eventData.location as string) || "",
      calendarDate: calendarDate.toISOString(),
      downloadPin: (eventData.downloadPin as string | undefined) ?? null,
      clientId: linkedClientId,
      projectId: linkedProjectId,
      clientFirstName: linkedClientFirstName,
    },
    photos,
    clients,
    clientLabels,
  };
}

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params;
  await requireAdmin();

  const data = await getEventData(id);
  if (!data) notFound();

  const { event, photos, clients, clientLabels } = data;

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
          {/* UX P0 (g) — Project linkage chip. Shown only when the event has
              been auto-created from a Project (clientId present). The "View
              project" link requires both clientId AND projectId. */}
          {event.clientId && event.clientFirstName ? (
            <p style={{ fontSize: "0.8rem", color: "var(--charcoal-muted)", marginTop: "0.5rem" }}>
              Linked to <span style={{ color: "var(--charcoal)" }}>{event.clientFirstName}</span>
              {event.projectId ? (
                <>
                  {" — "}
                  <Link
                    href={`/admin/projects/${event.projectId}`}
                    style={{ color: "var(--olive)", textDecoration: "none" }}
                  >
                    View project →
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
          <ShootDateEditor
            eventId={event.id}
            initialStartDate={event.startDate}
            initialEndDate={event.endDate}
            initialStartTime={event.startTime}
            initialEndTime={event.endTime}
            initialIsMultiDay={event.isMultiDay}
            initialLocation={event.location}
            initialStatus={event.status}
          />
          <p style={{ fontSize: "0.8rem", color: "var(--charcoal-muted)", marginTop: "0.5rem" }}>
            {photos.length} photo{photos.length !== 1 ? "s" : ""} · {clients.length} client{clients.length !== 1 ? "s" : ""} · Created {event.createdAtFormatted}
          </p>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: "0.75rem", flexShrink: 0, flexWrap: "wrap" }}>
          {/* UX P0 (c) — Notify client when gallery is marked DELIVERED. */}
          {event.status === "DELIVERED" && event.clientId && event.clientFirstName ? (
            <NotifyGalleryReadyButton
              eventId={event.id}
              clientFirstName={event.clientFirstName}
            />
          ) : null}

          {/* Google Calendar button — client component */}
          <AddToCalendarButton eventTitle={event.title} eventDate={event.calendarDate} />

          <Link
            href={`/admin/events/${event.id}/analytics`}
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
            View analytics
          </Link>

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

      {/* Phase 2.6 — Download PIN gate */}
      <DownloadPinEditor eventId={event.id} initialPin={event.downloadPin} />

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
            <PhotoGrid eventId={event.id} photos={photos} clientLabels={clientLabels} />
          </div>
        </div>
      )}

      {/* Danger zone — delete event / clear gallery */}
      <EventActions
        eventId={event.id}
        eventTitle={event.title}
        photoCount={photos.length}
        clientCount={clients.length}
      />
    </div>
  );
}