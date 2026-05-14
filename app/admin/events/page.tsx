// app/admin/events/page.tsx
// Lists all events. Server component fetches from Firestore, delegates
// rendering + client-side filtering to the EventsTable client component.

import { adminDb } from "@/lib/firebase-admin";
import { createEvent } from "./actions";
import { EventsTable, type SerializedEventRow } from "./EventsTable";
import type { EventStatus } from "@/lib/db/events";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Events | Admin" };
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

async function getEvents(): Promise<SerializedEventRow[]> {
  const snapshot = await adminDb
    .collection("events")
    .orderBy("createdAt", "desc")
    .get();

  return Promise.all(
    snapshot.docs.map(async (doc) => {
      const data = doc.data();

      const [photosSnap, accessSnap] = await Promise.all([
        adminDb.collection("events").doc(doc.id).collection("photos").count().get(),
        adminDb.collection("eventAccess").where("eventId", "==", doc.id).count().get(),
      ]);

      const createdAt = data.createdAt?.toDate() ?? new Date();

      return {
        id: doc.id,
        title: data.title as string,
        status: coerceEventStatus(data.status),
        createdAt: createdAt.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        shootDate: data.startDate || null,
        photoCount: photosSnap.data().count,
        clientCount: accessSnap.data().count,
      };
    })
  );
}

export default async function EventsPage() {
  let events: SerializedEventRow[] = [];
  let error: string | null = null;

  try {
    events = await getEvents();
  } catch (err) {
    console.error("Firestore error:", err);
    error = err instanceof Error ? err.message : "Failed to load events.";
  }

  return (
    <div className="page-fade-in">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "2rem",
        }}
      >
        <div>
          <p
            style={{
              fontSize: "0.65rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--olive)",
              marginBottom: "0.3rem",
            }}
          >
            Content
          </p>
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "2rem",
              fontWeight: 300,
            }}
          >
            All Events
          </h2>
        </div>

        <form action={createEvent}>
          <input type="hidden" name="title" value="New Event" />
          <button type="submit" style={btnOlive}>
            + Create Event
          </button>
        </form>
      </div>

      {error ? (
        <div
          style={{
            padding: "2rem",
            border: "0.5px solid #FCA5A5",
            background: "#FEF2F2",
            color: "#991B1B",
            fontSize: "0.88rem",
            lineHeight: 1.7,
          }}
        >
          <strong>Error loading events</strong>
          <br />
          {error}
        </div>
      ) : (
        <EventsTable events={events} />
      )}
    </div>
  );
}

const btnOlive: React.CSSProperties = {
  padding: "0.85rem 2.2rem",
  fontSize: "0.72rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  background: "var(--olive)",
  color: "var(--white)",
  border: "none",
  cursor: "pointer",
  fontFamily: "'Jost', sans-serif",
};
