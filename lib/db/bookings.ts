import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { LeadStatus, LeadSource, CommunicationChannel } from "@/lib/booking-kanban";

export type { LeadStatus, LeadSource, CommunicationChannel } from "@/lib/booking-kanban";

export interface CommunicationLogEntry {
  id: string;
  timestamp: Timestamp;
  channel: CommunicationChannel;
  summary: string;
  adminUid: string;
}

export interface BookingInquiryDoc {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  sessionType: string;
  preferredDate?: string;
  message: string;
  status: LeadStatus;
  notes: string;
  pricing: string | null;
  leadSource?: LeadSource;
  leadScore?: number;
  tags?: string[];
  estimatedValue?: number;
  followUpDate?: Timestamp | null;
  lastContactedAt?: Timestamp | null;
  lastRespondedAt?: Timestamp | null;
  communicationLog?: CommunicationLogEntry[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const bookingCol = () => adminDb.collection("bookingInquiries");

export async function createBookingInquiry(
  data: Omit<BookingInquiryDoc, "id" | "createdAt" | "updatedAt" | "leadScore">
): Promise<BookingInquiryDoc> {
  const ref = bookingCol().doc();
  const now = Timestamp.now();
  const full = {
    ...data,
    status: "PENDING" as const,
    leadScore: 0,
    tags: [],
    communicationLog: [],
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(full);
  return { id: ref.id, ...full } as BookingInquiryDoc;
}

export async function listBookingInquiries(
  status?: BookingInquiryDoc["status"]
): Promise<BookingInquiryDoc[]> {
  let query = bookingCol().orderBy("createdAt", "desc") as FirebaseFirestore.Query;
  if (status) query = query.where("status", "==", status);
  const snap = await query.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as BookingInquiryDoc));
}

export async function updateBookingStatus(
  id: string,
  status: BookingInquiryDoc["status"]
): Promise<void> {
  await bookingCol().doc(id).update({ status, updatedAt: FieldValue.serverTimestamp() });
}

export async function countBookingInquiries(status?: string): Promise<number> {
  let query = bookingCol() as FirebaseFirestore.Query;
  if (status) query = query.where("status", "==", status);
  const snap = await query.count().get();
  return snap.data().count;
}
