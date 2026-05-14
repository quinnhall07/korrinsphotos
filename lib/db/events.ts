import { adminDb } from "@/lib/firebase-admin";
import type { Timestamp } from "firebase-admin/firestore";

/**
 * Canonical EventDoc.status lifecycle (in order):
 *   UPCOMING  — created, shoot has not happened yet (default for new events).
 *   ACTIVE    — shoot is in progress / day-of (optional intermediate state).
 *   COMPLETED — shoot finished, editing/delivery pending or done.
 *   DELIVERED — gallery delivered to client (legacy/manual marker).
 *   ARCHIVED  — terminal off-ramp; event hidden from primary lists.
 */
export type EventStatus =
  | "UPCOMING"
  | "ACTIVE"
  | "COMPLETED"
  | "DELIVERED"
  | "ARCHIVED";

export interface EventDoc {
  id: string;
  title: string;
  bookingId?: string;
  projectId?: string;
  clientId?: string;
  clientEmail?: string;
  clientName?: string;
  status?: EventStatus;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  isMultiDay?: boolean;
  location?: string;
  shootDate?: Timestamp;
  shootEndDate?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const eventsCol = () => adminDb.collection("events");
