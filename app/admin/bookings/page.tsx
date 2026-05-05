// app/admin/bookings/page.tsx
// Booking inquiries management — fetched from Firestore.
// Filter tabs include Archived. Each row expands to show the BookingDetailPanel.

import { requireAdmin } from "@/lib/session";
import { adminDb } from "@/lib/firebase-admin";
import { BookingActions } from "./BookingActions";
import { BookingTable } from "./BookingTable";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Booking Inquiries | Admin" };
export const dynamic = "force-dynamic";

export type Inquiry = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  sessionType: string;
  preferredDate: string | null;
  message: string;
  notes: string;
  pricing: string;
  status: string;
  createdAt: string;
  lastRespondedAt: string | null;
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
        ? data.preferredDate.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : null,
      message: data.message as string,
      notes: (data.notes as string) ?? "",
      pricing: (data.pricing as string) ?? "",
      status: data.status as string,
      createdAt: data.createdAt?.toDate
        ? data.createdAt.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "—",
      lastRespondedAt: data.lastRespondedAt?.toDate
        ? data.lastRespondedAt.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : null,
    };
  });
}

const filterTabs = [
  { label: "All", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Reviewed", value: "reviewed" },
  { label: "Booked", value: "booked" },
  { label: "Archived", value: "archived" },
];

const STATUS_FILTER_MAP: Record<string, string> = {
  pending: "PENDING",
  reviewed: "REVIEWED",
  booked: "BOOKED",
  archived: "ARCHIVED",
};

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const { status } = await searchParams;
  const activeStatus = status?.toLowerCase() ?? "";
  const firestoreStatus = STATUS_FILTER_MAP[activeStatus];

  const inquiries = await getInquiries(firestoreStatus);

  // Counts for each tab
  const counts = await Promise.all(
    ["", "PENDING", "REVIEWED", "BOOKED", "ARCHIVED"].map(async (s) => {
      const q = s
        ? adminDb.collection("bookingInquiries").where("status", "==", s)
        : adminDb.collection("bookingInquiries");
      const snap = await q.count().get();
      return { status: s, count: snap.data().count };
    })
  );

  function tabCount(tabValue: string) {
    if (!tabValue) return counts.find((c) => c.status === "")?.count ?? 0;
    return counts.find((c) => c.status === STATUS_FILTER_MAP[tabValue])?.count ?? 0;
  }

  return (
    <div className="page-fade-in">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "2rem", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: "0.65rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--olive)", marginBottom: "0.3rem" }}>
            Clients
          </p>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "2rem", fontWeight: 300 }}>
            Booking Inquiries
          </h2>
          <p style={{ fontSize: "0.78rem", color: "var(--charcoal-muted)", marginTop: "0.25rem" }}>
            Click any row to expand notes, pricing, and email response tools.
          </p>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {filterTabs.map((tab) => {
            const isActive = activeStatus === tab.value;
            return (
              <Link
                key={tab.value}
                href={tab.value ? `/admin/bookings?status=${tab.value}` : "/admin/bookings"}
                style={{
                  display: "inline-block",
                  padding: "0.45rem 0.9rem",
                  fontSize: "0.65rem",
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
                {tab.label} ({tabCount(tab.value)})
              </Link>
            );
          })}
        </div>
      </div>

      {/* Info bar for archived */}
      {activeStatus === "archived" && (
        <div style={{ padding: "0.85rem 1.2rem", background: "rgba(42,42,40,0.04)", border: "0.5px solid var(--border)", marginBottom: "1.5rem", fontSize: "0.82rem", color: "var(--charcoal-muted)" }}>
          Archived inquiries are stored indefinitely and can be restored to Pending at any time.
        </div>
      )}

      {/* Table with expandable rows (client component) */}
      <BookingTable inquiries={inquiries} />
    </div>
  );
}