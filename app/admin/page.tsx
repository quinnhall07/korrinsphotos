// app/admin/page.tsx
// Admin dashboard — all stats and recent data pulled live from Firestore.

import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { adminDb } from "@/lib/firebase-admin";
import { listRecentActivity } from "@/lib/firestore";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard | Admin" };
export const dynamic = "force-dynamic";

type DashboardData = {
  activeEventsCount: number;
  totalPhotosCount: number;
  pendingInquiriesCount: number;
  activeClientsCount: number;
  recentInquiries: {
    id: string;
    name: string;
    sessionType: string;
    preferredDate: string | null;
    status: string;
  }[];
  recentEvents: {
    id: string;
    title: string;
    createdAt: string;
    photoCount: number;
    clientCount: number;
  }[];
};

async function getDashboardData(): Promise<DashboardData> {
  const [
    eventsCountSnap,
    photosCountSnap,
    pendingCountSnap,
    clientsCountSnap,
    recentInquiriesSnap,
    recentEventsSnap,
  ] = await Promise.all([
    adminDb.collection("events").count().get(),
    adminDb.collectionGroup("photos").count().get(),
    adminDb
      .collection("bookingInquiries")
      .where("status", "==", "PENDING")
      .count()
      .get(),
    adminDb.collection("users").where("role", "==", "CLIENT").count().get(),
    adminDb
      .collection("bookingInquiries")
      .orderBy("createdAt", "desc")
      .limit(5)
      .get(),
    adminDb.collection("events").orderBy("createdAt", "desc").limit(5).get(),
  ]);

  // Fetch photo + client counts for recent events
  const recentEvents = await Promise.all(
    recentEventsSnap.docs.map(async (doc) => {
      const data = doc.data();
      const [photoSnap, accessSnap] = await Promise.all([
        adminDb
          .collection("events")
          .doc(doc.id)
          .collection("photos")
          .count()
          .get(),
        adminDb
          .collection("eventAccess")
          .where("eventId", "==", doc.id)
          .count()
          .get(),
      ]);
      return {
        id: doc.id,
        title: data.title as string,
        createdAt: data.createdAt?.toDate
          ? data.createdAt.toDate().toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "—",
        photoCount: photoSnap.data().count,
        clientCount: accessSnap.data().count,
      };
    })
  );

  const recentInquiries = recentInquiriesSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: `${data.firstName} ${data.lastName}`,
      sessionType: data.sessionType as string,
      preferredDate: data.preferredDate
        ? data.preferredDate.toDate().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : null,
      status: data.status as string,
    };
  });

  return {
    activeEventsCount: eventsCountSnap.data().count,
    totalPhotosCount: photosCountSnap.data().count,
    pendingInquiriesCount: pendingCountSnap.data().count,
    activeClientsCount: clientsCountSnap.data().count,
    recentInquiries,
    recentEvents,
  };
}

const STATUS_STYLES: Record<string, React.CSSProperties> = {
  PENDING:       { background: "#FEF3C7", color: "#92400E" },
  QUALIFIED:     { background: "#E0E7FF", color: "#3730A3" },
  SENT_PROPOSAL: { background: "#DBEAFE", color: "#1D4ED8" },
  CONTRACT_SENT: { background: "#FED7AA", color: "#9A3412" },
  BOOKED:        { background: "#D1FAE5", color: "#065F46" },
  ARCHIVED:      { background: "rgba(42,42,40,0.06)", color: "var(--charcoal-muted)" },
};

const ACTIVITY_ICONS: Record<string, string> = {
  LEAD_RECEIVED:  "✉️",
  STATUS_CHANGED: "⇄",
  EMAIL_SENT:     "📤",
  NOTE_ADDED:     "📝",
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function AdminDashboard() {
  await requireAdmin();

  let data: DashboardData;
  try {
    data = await getDashboardData();
  } catch (err) {
    console.error("Dashboard data error:", err);
    data = {
      activeEventsCount: 0,
      totalPhotosCount: 0,
      pendingInquiriesCount: 0,
      activeClientsCount: 0,
      recentInquiries: [],
      recentEvents: [],
    };
  }

  // Activity feed (best-effort — silently empty on fresh projects)
  const activities = await listRecentActivity(8).catch(() => []);

  const {
    activeEventsCount,
    totalPhotosCount,
    pendingInquiriesCount,
    activeClientsCount,
    recentInquiries,
    recentEvents,
  } = data;

  return (
    <div className="page-fade-in">
      {/* Greeting */}
      <div style={{ marginBottom: "2.5rem" }}>
        <p
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--olive)",
            marginBottom: "0.5rem",
          }}
        >
          {getGreeting()}
        </p>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "2.2rem",
            fontWeight: 300,
          }}
        >
          Korrin&apos;s Studio
        </h1>
      </div>

      {/* Stat cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "1rem",
          marginBottom: "2.5rem",
        }}
      >
        {[
          {
            label: "Active Events",
            value: activeEventsCount,
            note: "Total galleries",
            href: "/admin/events",
          },
          {
            label: "Total Photos",
            value: totalPhotosCount.toLocaleString(),
            note: "Across all galleries",
            href: "/admin/events",
          },
          {
            label: "Pending Inquiries",
            value: pendingInquiriesCount,
            note:
              pendingInquiriesCount > 0 ? "Needs attention" : "All caught up",
            noteColor: pendingInquiriesCount > 0 ? "#B45309" : "var(--olive)",
            href: "/admin/bookings",
          },
          {
            label: "Active Clients",
            value: activeClientsCount,
            note: "With gallery access",
            href: "/admin/users",
          },
        ].map(({ label, value, note, noteColor, href }) => (
          <Link
            key={label}
            href={href}
            style={{
              border: "0.5px solid var(--border)",
              padding: "1.5rem",
              background: "var(--white)",
              textDecoration: "none",
              display: "block",
              transition: "border-color 0.2s",
            }}
          >
            <p
              style={{
                fontSize: "0.65rem",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--charcoal-muted)",
                marginBottom: "0.75rem",
              }}
            >
              {label}
            </p>
            <div
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "2.5rem",
                fontWeight: 300,
                color: "var(--charcoal)",
                lineHeight: 1,
                marginBottom: "0.3rem",
              }}
            >
              {value}
            </div>
            <p
              style={{
                fontSize: "0.72rem",
                color: noteColor ?? "var(--charcoal-muted)",
              }}
            >
              {note}
            </p>
          </Link>
        ))}
      </div>

      {/* Two-column lower section */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        {/* Recent inquiries */}
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
              Recent Booking Inquiries
            </span>
            <Link href="/admin/bookings" style={btnOutlineDark}>
              View All
            </Link>
          </div>

          {recentInquiries.length === 0 ? (
            <p
              style={{
                padding: "2rem",
                textAlign: "center",
                color: "var(--charcoal-muted)",
                fontSize: "0.85rem",
              }}
            >
              No inquiries yet. They&apos;ll appear here after clients submit the
              booking form.
            </p>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.85rem",
              }}
            >
              <thead>
                <tr>
                  {["Name", "Session Type", "Date Requested", "Status", ""].map(
                    (h) => (
                      <th key={h} style={thStyle}>
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {recentInquiries.map((inq) => (
                  <tr key={inq.id}>
                    <td style={tdStyle}>{inq.name}</td>
                    <td style={tdStyle}>{inq.sessionType}</td>
                    <td style={tdStyle}>{inq.preferredDate ?? "—"}</td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.25rem 0.65rem",
                          fontSize: "0.62rem",
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          ...(STATUS_STYLES[inq.status] ?? {}),
                        }}
                      >
                        {inq.status.replace("_", " ")}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <Link href="/admin/bookings" style={btnOutlineDark}>
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Activity feed */}
        <div
          style={{
            border: "0.5px solid var(--border)",
            background: "var(--white)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
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
              Recent Activity
            </span>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {activities.length === 0 ? (
              <p
                style={{
                  padding: "2rem",
                  textAlign: "center",
                  color: "var(--charcoal-muted)",
                  fontSize: "0.82rem",
                  fontStyle: "italic",
                }}
              >
                Activity will appear here as you manage leads and galleries.
              </p>
            ) : (
              <div style={{ padding: "0.5rem 0" }}>
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "0.75rem",
                      padding: "0.75rem 1.2rem",
                      borderBottom: "0.5px solid var(--border)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "1rem",
                        flexShrink: 0,
                        marginTop: "0.1rem",
                        opacity: 0.8,
                      }}
                    >
                      {ACTIVITY_ICONS[activity.action] ?? "•"}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: "0.78rem",
                          color: "var(--charcoal)",
                          lineHeight: 1.5,
                          marginBottom: "0.2rem",
                        }}
                      >
                        {activity.message}
                      </p>
                      <p
                        style={{
                          fontSize: "0.65rem",
                          color: "var(--charcoal-muted)",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {activity.timestamp?.toDate?.()?.toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }) ?? "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent events */}
      <div style={{ border: "0.5px solid var(--border)", background: "var(--white)" }}>
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
            Recent Events
          </span>
          <Link
            href="/admin/events"
            style={{
              ...btnOlive,
              padding: "0.5rem 1.2rem",
              fontSize: "0.65rem",
            }}
          >
            + New Event
          </Link>
        </div>

        {recentEvents.length === 0 ? (
          <p
            style={{
              padding: "2rem",
              textAlign: "center",
              color: "var(--charcoal-muted)",
              fontSize: "0.85rem",
            }}
          >
            No events yet.{" "}
            <Link
              href="/admin/events"
              style={{ color: "var(--olive)", textDecoration: "none" }}
            >
              Create your first event →
            </Link>
          </p>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.85rem",
            }}
          >
            <thead>
              <tr>
                {["Event Name", "Photos", "Clients", "Created", ""].map((h) => (
                  <th key={h} style={thStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentEvents.map((ev) => (
                <tr key={ev.id}>
                  <td style={tdStyle}>
                    <strong style={{ fontWeight: 500 }}>{ev.title}</strong>
                  </td>
                  <td style={tdStyle}>{ev.photoCount.toLocaleString()}</td>
                  <td style={tdStyle}>{ev.clientCount}</td>
                  <td style={tdStyle}>{ev.createdAt}</td>
                  <td style={tdStyle}>
                    <Link href={`/admin/events/${ev.id}`} style={btnOutlineDark}>
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "0.75rem 1rem",
  fontSize: "0.65rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--charcoal-muted)",
  borderBottom: "0.5px solid var(--border-strong)",
  fontWeight: 400,
};

const tdStyle: React.CSSProperties = {
  padding: "0.9rem 1rem",
  borderBottom: "0.5px solid var(--border)",
  color: "var(--charcoal-light)",
  verticalAlign: "middle",
};

const btnOutlineDark: React.CSSProperties = {
  display: "inline-block",
  padding: "0.5rem 1.2rem",
  fontSize: "0.65rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--charcoal)",
  border: "0.5px solid var(--border-strong)",
  textDecoration: "none",
  background: "transparent",
  fontFamily: "'Jost', sans-serif",
};

const btnOlive: React.CSSProperties = {
  display: "inline-block",
  background: "var(--olive)",
  color: "var(--white)",
  textDecoration: "none",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  fontFamily: "'Jost', sans-serif",
};