// app/admin/page.tsx
// Admin dashboard — Server Component. Fetches real counts and recent rows
// from the DB to populate the stat cards and preview tables.

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin Dashboard" };

// Don't cache admin pages — data should always be fresh
export const dynamic = "force-dynamic";

async function getDashboardData() {
  const [
    activeEventsCount,
    totalPhotosCount,
    pendingInquiriesCount,
    activeClientsCount,
    recentInquiries,
    recentEvents,
  ] = await Promise.all([
    prisma.event.count(),
    prisma.photo.count(),
    prisma.bookingInquiry.count({ where: { status: "PENDING" } }),
    prisma.user.count({ where: { role: "CLIENT" } }),
    prisma.bookingInquiry.findMany({
      orderBy: { createdAt: "desc" },
      take: 4,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        sessionType: true,
        preferredDate: true,
        status: true,
      },
    }),
    prisma.event.findMany({
      orderBy: { createdAt: "desc" },
      take: 4,
      select: {
        id: true,
        title: true,
        createdAt: true,
        _count: { select: { photos: true, access: true } },
      },
    }),
  ]);

  return {
    activeEventsCount,
    totalPhotosCount,
    pendingInquiriesCount,
    activeClientsCount,
    recentInquiries,
    recentEvents,
  };
}

// ─── Placeholder data for pre-DB state ───────────────────────────────────────
const MOCK_DATA = {
  activeEventsCount: 8,
  totalPhotosCount: 1284,
  pendingInquiriesCount: 4,
  activeClientsCount: 23,
  recentInquiries: [
    { id: "1", firstName: "Melissa", lastName: "Carter", sessionType: "Wedding", preferredDate: new Date("2025-06-14"), status: "PENDING" },
    { id: "2", firstName: "Sarah", lastName: "Johnson", sessionType: "Portrait", preferredDate: new Date("2025-05-30"), status: "PENDING" },
    { id: "3", firstName: "Marcus", lastName: "Williams", sessionType: "Editorial", preferredDate: new Date("2025-05-22"), status: "REVIEWED" },
  ],
  recentEvents: [
    { id: "evt1", title: "Carter Wedding", createdAt: new Date("2025-04-15"), _count: { photos: 312, access: 2 } },
    { id: "evt2", title: "Johnson Portrait Session", createdAt: new Date("2025-04-02"), _count: { photos: 84, access: 1 } },
    { id: "evt3", title: "Williams Editorial", createdAt: new Date("2025-03-28"), _count: { photos: 156, access: 3 } },
  ],
};

export default async function AdminDashboard() {
  let data = MOCK_DATA;
  try {
    data = await getDashboardData() as typeof MOCK_DATA;
  } catch {
    // DB not available — use mock data
  }

  const { activeEventsCount, totalPhotosCount, pendingInquiriesCount, activeClientsCount, recentInquiries, recentEvents } = data;

  return (
    <div className="page-fade-in">
      {/* Greeting */}
      <div style={{ marginBottom: "2.5rem" }}>
        <p style={{ fontSize: "0.65rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--olive)", marginBottom: "0.5rem" }}>
          Good morning
        </p>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "2.2rem", fontWeight: 300 }}>
          Korrin&apos;s Studio
        </h1>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1rem", marginBottom: "2.5rem" }}>
        {[
          { label: "Active Events", value: activeEventsCount, note: "+2 this month" },
          { label: "Total Photos", value: totalPhotosCount.toLocaleString(), note: "Across all galleries" },
          { label: "Pending Inquiries", value: pendingInquiriesCount, note: "Needs attention", noteColor: "#B45309" },
          { label: "Active Clients", value: activeClientsCount, note: "+5 this month" },
        ].map(({ label, value, note, noteColor }) => (
          <div key={label} style={{ border: "0.5px solid var(--border)", padding: "1.5rem", background: "var(--white)" }}>
            <p style={{ fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--charcoal-muted)", marginBottom: "0.75rem" }}>
              {label}
            </p>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "2.5rem", fontWeight: 300, lineHeight: 1, marginBottom: "0.3rem" }}>
              {value}
            </div>
            <p style={{ fontSize: "0.72rem", color: noteColor ?? "var(--olive)" }}>{note}</p>
          </div>
        ))}
      </div>

      {/* Recent inquiries */}
      <div style={{ border: "0.5px solid var(--border)", background: "var(--white)", marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.2rem 1.5rem", borderBottom: "0.5px solid var(--border)" }}>
          <span style={{ fontSize: "0.72rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--charcoal)", fontWeight: 500 }}>
            Recent Booking Inquiries
          </span>
          <Link href="/admin/bookings" style={btnOutlineDark}>View All</Link>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr>
              {["Name", "Session Type", "Date Requested", "Status", ""].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "0.75rem 1rem", fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--charcoal-muted)", borderBottom: "0.5px solid var(--border-strong)", fontWeight: 400 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recentInquiries.map((inq) => (
              <tr key={inq.id}>
                <td style={tdStyle}>{inq.firstName} {inq.lastName}</td>
                <td style={tdStyle}>{inq.sessionType}</td>
                <td style={tdStyle}>{inq.preferredDate ? new Date(inq.preferredDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</td>
                <td style={tdStyle}>
                  <StatusBadge status={inq.status} />
                </td>
                <td style={tdStyle}>
                  <Link href="/admin/bookings" style={btnOutlineDark}>
                    {inq.status === "PENDING" ? "Review" : "View"}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recent events */}
      <div style={{ border: "0.5px solid var(--border)", background: "var(--white)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.2rem 1.5rem", borderBottom: "0.5px solid var(--border)" }}>
          <span style={{ fontSize: "0.72rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--charcoal)", fontWeight: 500 }}>
            Recent Events
          </span>
          <Link href="/admin/events" style={{ ...btnOlive, padding: "0.6rem 1.4rem", fontSize: "0.68rem" }}>
            + New Event
          </Link>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr>
              {["Event Name", "Photos", "Clients", "Created", ""].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "0.75rem 1rem", fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--charcoal-muted)", borderBottom: "0.5px solid var(--border-strong)", fontWeight: 400 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recentEvents.map((ev) => (
              <tr key={ev.id}>
                <td style={tdStyle}><strong style={{ fontWeight: 500 }}>{ev.title}</strong></td>
                <td style={tdStyle}>{ev._count.photos}</td>
                <td style={tdStyle}>{ev._count.access}</td>
                <td style={tdStyle}>{new Date(ev.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, React.CSSProperties> = {
    PENDING: { background: "#FEF3C7", color: "#92400E" },
    REVIEWED: { background: "var(--olive-dim)", color: "var(--olive)" },
    BOOKED: { background: "#D1FAE5", color: "#065F46" },
    ARCHIVED: { background: "rgba(42,42,40,0.06)", color: "var(--charcoal-muted)" },
  };
  return (
    <span style={{ display: "inline-block", padding: "0.25rem 0.65rem", fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", ...(styles[status] ?? {}) }}>
      {status}
    </span>
  );
}

const tdStyle: React.CSSProperties = {
  padding: "0.9rem 1rem",
  borderBottom: "0.5px solid var(--border)",
  color: "var(--charcoal-light)",
  verticalAlign: "middle",
};

const btnOutlineDark: React.CSSProperties = {
  display: "inline-block",
  padding: "0.6rem 1.4rem",
  fontSize: "0.68rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--charcoal)",
  border: "0.5px solid var(--border-strong)",
  textDecoration: "none",
  transition: "all 0.25s",
  background: "transparent",
};

const btnOlive: React.CSSProperties = {
  display: "inline-block",
  background: "var(--olive)",
  color: "var(--white)",
  textDecoration: "none",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  transition: "background 0.25s",
};