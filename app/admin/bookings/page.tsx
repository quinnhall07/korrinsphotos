import type { Metadata } from "next";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/session";
import { BookingsClientPage, type Inquiry } from "./BookingsClientPage";

export const metadata: Metadata = { title: "Bookings | Admin" };
export const dynamic = "force-dynamic";

type TimestampLike = {
  toDate?: () => Date;
};

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object" && "toDate" in value) {
    const date = (value as TimestampLike).toDate?.();
    return date instanceof Date ? date : null;
  }
  return null;
}

function formatDisplayDate(value: unknown): string | null {
  const date = toDate(value);
  return date
    ? date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;
}

function formatDateInput(value: unknown): string | null {
  const date = toDate(value);
  return date ? date.toISOString().slice(0, 10) : null;
}

function formatDateTime(value: unknown): string | null {
  const date = toDate(value);
  return date
    ? date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
}

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
    };
  });
}

export default async function AdminBookingsPage() {
  await requireAdmin();
  const inquiries = await getInquiries();

  return <BookingsClientPage inquiries={inquiries} />;
}
