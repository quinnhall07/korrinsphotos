import type { Metadata } from "next";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/session";
import { BookingsClientPage, type Inquiry } from "./BookingsClientPage";

export const metadata: Metadata = { title: "Bookings | Admin" };
export const dynamic = "force-dynamic";

import { formatDisplayDate, formatDateInput, formatDateTime } from "@/lib/date";

async function getInquiries(): Promise<Inquiry[]> {
  const snap = await adminDb
    .collection("bookingInquiries")
    .orderBy("createdAt", "desc")
    .get();

  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      firstName: String(data.firstName ?? ""),
      lastName: String(data.lastName ?? ""),
      email: String(data.email ?? ""),
      sessionType: String(data.sessionType ?? ""),
      preferredDate: formatDisplayDate(data.preferredDate),
      message: String(data.message ?? ""),
      notes: String(data.notes ?? ""),
      pricing: data.pricing ? String(data.pricing) : "",
      status: String(data.status ?? "PENDING"),
      createdAt: formatDateTime(data.createdAt) ?? "Unknown",
      lastRespondedAt: formatDateTime(data.lastRespondedAt),
      leadScore: Number(data.leadScore ?? 0),
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      leadSource: data.leadSource ? String(data.leadSource) : null,
      estimatedValue:
        typeof data.estimatedValue === "number" ? data.estimatedValue : null,
      followUpDate: formatDateInput(data.followUpDate),
      lastContactedAt: formatDateTime(data.lastContactedAt),
      communicationLog: Array.isArray(data.communicationLog)
        ? data.communicationLog.map((entry, index) => ({
            id: String(entry?.id ?? `${doc.id}-${index}`),
            channel: String(entry?.channel ?? "EMAIL"),
            summary: String(entry?.summary ?? ""),
            timestamp:
              formatDateTime(entry?.timestamp) ?? new Date(0).toISOString(),
            adminUid: String(entry?.adminUid ?? ""),
          }))
        : [],
      eventId: data.eventId ? String(data.eventId) : null,
      eventName: data.eventName ? String(data.eventName) : null,
    };
  });
}

export default async function AdminBookingsPage() {
  await requireAdmin();
  const inquiries = await getInquiries();

  return <BookingsClientPage inquiries={inquiries} />;
}
