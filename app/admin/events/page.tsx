// app/admin/events/page.tsx
// Lists all events. Queries Firestore instead of Prisma.

import { adminDb }    from "@/lib/firebase-admin";
import { createEvent } from "./actions";
import Link           from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Events | Admin" };
export const dynamic = "force-dynamic";

type EventRow = {
  id:         string;
  title:      string;
  createdAt:  Date;
  photoCount: number;
  clientCount: number;
};

async function getEvents(): Promise<EventRow[]> {
  const snapshot = await adminDb
    .collection("events")
    .orderBy("createdAt", "desc")
    .get();

  return Promise.all(
    snapshot.docs.map(async (doc) => {
      const data = doc.data();

      // Count subcollection sizes (Firestore doesn't have a built-in count per doc,
      // but for small galleries a snapshot count is fine. For large scale,
      // store counters on the event document itself.)
      const [photosSnap, accessSnap] = await Promise.all([
        adminDb.collection("events").doc(doc.id).collection("photos").count().get(),
        adminDb.collection("eventAccess").where("eventId", "==", doc.id).count().get(),
      ]);

      return {
        id:          doc.id,
        title:       data.title as string,
        createdAt:   data.createdAt?.toDate() ?? new Date(),
        photoCount:  photosSnap.data().count,
        clientCount: accessSnap.data().count,
      };
    })
  );
}

export default async function EventsPage() {
  let events: EventRow[] = [];
  try {
    events = await getEvents();
  } catch (err) {
    console.error("Firestore error:", err);
  }

  return (
    <div className="page-fade-in">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem" }}>
        <div>
          <p style={{ fontSize: "0.65rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--olive)", marginBottom: "0.3rem" }}>Content</p>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "2rem", fontWeight: 300 }}>All Events</h2>
        </div>

        <form action={createEvent}>
          <input type="hidden" name="title" value="New Event" />
          <button type="submit" style={btnOlive}>+ Create Event</button>
        </form>
      </div>

      <div style={{ border: "0.5px solid var(--border)", background: "var(--white)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr>
              {["Event", "Photos", "Clients", "Status", "Created", ""].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && (
              <tr>
                <td colSpan={6} style={{ ...tdStyle, textAlign: "center", color: "var(--charcoal-muted)" }}>
                  No events yet. Create your first one above.
                </td>
              </tr>
            )}
            {events.map((ev) => (
              <tr key={ev.id}>
                <td style={tdStyle}><strong style={{ fontWeight: 500 }}>{ev.title}</strong></td>
                <td style={tdStyle}>{ev.photoCount}</td>
                <td style={tdStyle}>{ev.clientCount}</td>
                <td style={tdStyle}>
                  <span style={{ display: "inline-block", padding: "0.25rem 0.65rem", fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", background: "#D1FAE5", color: "#065F46" }}>
                    Active
                  </span>
                </td>
                <td style={tdStyle}>
                  {ev.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </td>
                <td style={tdStyle}>
                  <Link href={`/admin/events/${ev.id}`} style={btnOutlineDark}>Manage</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left", padding: "0.75rem 1rem",
  fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase",
  color: "var(--charcoal-muted)", borderBottom: "0.5px solid var(--border-strong)", fontWeight: 400,
};
const tdStyle: React.CSSProperties = {
  padding: "0.9rem 1rem", borderBottom: "0.5px solid var(--border)",
  color: "var(--charcoal-light)", verticalAlign: "middle",
};
const btnOlive: React.CSSProperties = {
  padding: "0.85rem 2.2rem", fontSize: "0.72rem", letterSpacing: "0.14em",
  textTransform: "uppercase", background: "var(--olive)", color: "var(--white)",
  border: "none", cursor: "pointer", fontFamily: "'Jost', sans-serif",
};
const btnOutlineDark: React.CSSProperties = {
  display: "inline-block", padding: "0.6rem 1.4rem", fontSize: "0.68rem",
  letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--charcoal)",
  border: "0.5px solid var(--border-strong)", textDecoration: "none",
};