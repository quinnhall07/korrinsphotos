import { adminDb } from "@/lib/firebase-admin";
import type { Timestamp } from "firebase-admin/firestore";

export interface EventDoc {
  id: string;
  title: string;
  bookingId?: string;
  projectId?: string;
  clientId?: string;
  clientEmail?: string;
  clientName?: string;
  status?: "UPCOMING" | "COMPLETED";
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
