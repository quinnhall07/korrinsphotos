// app/admin/events/page.tsx
// Lists all events with photo/client counts. The "+ Create Event" button
// triggers a server action that creates the event and redirects to its detail page.

import { prisma } from "@/lib/prisma";
import { createEvent } from "./actions";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Events | Admin" };
export const dynamic = "force-dynamic";

const MOCK_EVENTS = [
  { id: "evt1", title: "Carter Wedding", createdAt: new Date("2025-04-15"), _count: { photos: 312, access: 2 } },
  { id: "evt2", title: "Johnson Portrait Session", createdAt: new Date("2025-04-02"), _count: { photos: 84, access: 1 } },
  { id: "evt3", title: "Williams Editorial", createdAt: new Date("2025-03-28"), _count: { photos: 156, access: 3 } },
  { id: "evt4", title: "Hendricks Engagement", createdAt: new Date("2025-03-10"), _count: { photos: 98, access: 1 } },
  { id: "evt5", title: "Kim & Park Wedding", createdAt: new Date("2025-02-14"), _count: { photos: 488, access: 4 } },
];

export default async function EventsPage() {
  let events = MOCK_EVENTS;
  try {
    events = await prisma.event.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        createdAt: true,
        _count: { select: { photos: true, access: true } },
      },
    }) as typeof MOCK_EVENTS;
  } catch { /* use mock */ }

  return (
    <div className="page-fade-in">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem" }}>
        <div>
          <p style={{ fontSize: "0.65rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--olive)", marginBottom: "0.3rem" }}>
            Content
          </p>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "2rem", fontWeight: 300 }}>
            All Events
          </h2>
        </div>

        {/* Create Event — server action via a hidden form */}
        <form action={createEvent}>
          <input type="hidden" name="title" value="New Event" />
          <button
            type="submit"
            style={{
              padding: "0.85rem 2.2rem",
              fontSize: "0.72rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              background: "var(--olive)",
              color: "var(--white)",
              border: "none",
              cursor: "pointer",
              fontFamily: "'Jost', sans-serif",
            }}
          >
            + Create Event
          </button>
        </form>
      </div>

      <div style={{ border: "0.5px solid var(--border)", background: "var(--white)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr>
              {["Event", "Photos", "Clients", "Status", "Created", ""].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "0.75rem 1rem", fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--charcoal-muted)", borderBottom: "0.5px solid var(--border-strong)", fontWeight: 400 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => (
              <tr key={ev.id}>
                <td style={tdStyle}><strong style={{ fontWeight: 500 }}>{ev.title}</strong></td>
                <td style={tdStyle}>{ev._count.photos}</td>
                <td style={tdStyle}>{ev._count.access}</td>
                <td style={tdStyle}>
                  <span style={{ display: "inline-block", padding: "0.25rem 0.65rem", fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", background: "#D1FAE5", color: "#065F46" }}>
                    Active
                  </span>
                </td>
                <td style={tdStyle}>{new Date(ev.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                <td style={tdStyle}>
                  <Link
                    href={`/admin/events/${ev.id}`}
                    style={{ display: "inline-block", padding: "0.6rem 1.4rem", fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--charcoal)", border: "0.5px solid var(--border-strong)", textDecoration: "none" }}
                  >
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const tdStyle: React.CSSProperties = {
  padding: "0.9rem 1rem",
  borderBottom: "0.5px solid var(--border)",
  color: "var(--charcoal-light)",
  verticalAlign: "middle",
};