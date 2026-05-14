import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export interface EventDoc {
  id: string;
  title: string;
  coverPhotoUrl?: string;
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

export async function getEvent(eventId: string): Promise<EventDoc | null> {
  const snap = await eventsCol().doc(eventId).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as EventDoc) : null;
}

export async function listEvents(): Promise<EventDoc[]> {
  const snap = await eventsCol().orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as EventDoc));
}

export async function createEvent(title: string): Promise<EventDoc> {
  const ref = eventsCol().doc();
  const now = Timestamp.now();
  const data = { title, createdAt: now, updatedAt: now };
  await ref.set(data);
  return { id: ref.id, ...data };
}

export async function updateEvent(eventId: string, data: Partial<EventDoc>): Promise<void> {
  await eventsCol().doc(eventId).update({
    ...data,
    updatedAt: FieldValue.serverTimestamp(),
  });
}
