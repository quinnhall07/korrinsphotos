// app/admin/bookings/page.tsx
// Booking inquiries management — fetches all from Firestore, grouped by status.

import { requireAdmin } from "@/lib/session";
import { adminDb } from "@/lib/firebase-admin";
import { BookingActions } from "./BookingActions";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Booking Inquiries | Admin" };
export const dynamic = "force-dynamic";

type Inquiry = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  sessionType: string;
  preferredDate: string | null;
  message: string;
  status: string;
  createdAt: string;
};

async function getInquiries(status?: string): Promise<Inquiry[]> {
  let query = adminDb
    .collection("bookingInquiries")
    .orderBy("createdAt", "desc") as FirebaseFirestore.Query;

  if (status) {
    query = query.where("status", "==", status);
  }

  const snap = await query.get();

  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      firstName: data.firstName as string,
      lastName: data.lastName as string,
      email: data.email as string,
      sessionType: data.sessionType as string,
      preferredDate: data.preferredDate
        ? data.preferredDate.toDate().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : null,
      message: data.message as string,
      status: data.status as string,
      createdAt: data.createdAt?.toDate
        ? data.createdAt.toDate().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "—",
    };
  });
}

const STATUS_COLORS: Record<string, React.CSSProperties> = {
  PENDING: { background: "#FEF3C7", color: "#92400E" },
  REVIEWED: { background: "var(--olive-dim)", color: "var(--olive)" },
  BOOKED: { background: "#D1FAE5", color: "#065F46" },
  ARCHIVED: { background: "rgba(42,42,40,0.06)", color: "var(--charcoal-muted)" },
};

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const { status } = await searchParams;
  const inquiries = await getInquiries(status?.toUpperCase());

  const counts = await Promise.all(
    ["", "PENDING", "REVIEWED", "BOOKED"].map(async (s) => {
      const q = s
        ? adminDb.collection("bookingInquiries").where("status", "==", s)
        : adminDb.collection("bookingInquiries");
      const snap = await q.count().get();
      return { status: s, count: snap.data().count };
    })
  );

  const filterTabs = [
    { label: "All", value: "" },
    { label: "Pending", value: "pending" },
    { label: "Reviewed", value: "reviewed" },
    { label: "Booked", value: "booked" },
  ];

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
            Clients
          </p>
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "2rem",
              fontWeight: 300,
            }}
          >
            Booking Inquiries
          </h2>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {filterTabs.map((tab) => {
            const count =
              counts.find(
                (c) => c.status === tab.value.toUpperCase()
              )?.count ?? counts[0]?.count;
            const isActive = (status ?? "") === tab.value;
            return (
              <a
                key={tab.value}
                href={
                  tab.value ? `/admin/bookings?status=${tab.value}` : "/admin/bookings"
                }
                style={{
                  display: "inline-block",
                  padding: "0.5rem 1rem",
                  fontSize: "0.68rem",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: isActive ? "var(--white)" : "var(--charcoal)",
                  background: isActive ? "var(--charcoal)" : "transparent",
                  border: "0.5px solid var(--border-strong)",
                  textDecoration: "none",
                  transition: "all 0.2s",
                  fontFamily: "'Jost', sans-serif",
                }}
              >
                {tab.label} ({count})
              </a>
            );
          })}
        </div>
      </div>

      <div style={{ border: "0.5px solid var(--border)", background: "var(--white)" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}
        >
          <thead>
            <tr>
              {["Name", "Email", "Session", "Date", "Message", "Received", "Status", ""].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "0.75rem 1rem",
                      fontSize: "0.65rem",
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "var(--charcoal-muted)",
                      borderBottom: "0.5px solid var(--border-strong)",
                      fontWeight: 400,
                    }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {inquiries.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    padding: "3rem",
                    textAlign: "center",
                    color: "var(--charcoal-muted)",
                    fontSize: "0.88rem",
                  }}
                >
                  No inquiries{status ? ` with status "${status}"` : ""} yet.
                </td>
              </tr>
            )}
            {inquiries.map((inq) => (
              <tr key={inq.id}>
                <td style={tdStyle}>
                  <strong style={{ fontWeight: 500 }}>
                    {inq.firstName} {inq.lastName}
                  </strong>
                </td>
                <td style={tdStyle}>{inq.email}</td>
                <td style={tdStyle}>{inq.sessionType}</td>
                <td style={tdStyle}>{inq.preferredDate ?? "—"}</td>
                <td
                  style={{
                    ...tdStyle,
                    maxWidth: "180px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={inq.message}
                >
                  {inq.message}
                </td>
                <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                  {inq.createdAt}
                </td>
                <td style={tdStyle}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "0.25rem 0.65rem",
                      fontSize: "0.62rem",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      ...(STATUS_COLORS[inq.status] ?? {}),
                    }}
                  >
                    {inq.status}
                  </span>
                </td>
                <td style={tdStyle}>
                  <BookingActions id={inq.id} currentStatus={inq.status} />
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