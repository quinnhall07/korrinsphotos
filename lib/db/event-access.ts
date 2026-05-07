import { adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

export interface EventAccessDoc {
  id: string;
  userId: string;
  eventId: string;
  email: string;
  createdAt: Timestamp;
}

export const eventAccessCol = () => adminDb.collection("eventAccess");

export async function grantEventAccess(
  userId: string,
  eventId: string,
  email: string
): Promise<void> {
  const docId = `${eventId}_${userId}`;
  await eventAccessCol().doc(docId).set(
    { userId, eventId, email, createdAt: Timestamp.now() },
    { merge: true }
  );
}

export async function revokeEventAccess(userId: string, eventId: string): Promise<void> {
  const docId = `${eventId}_${userId}`;
  await eventAccessCol().doc(docId).delete();
}

export async function userHasEventAccess(userId: string, eventId: string): Promise<boolean> {
  const docId = `${eventId}_${userId}`;
  const snap = await eventAccessCol().doc(docId).get();
  return snap.exists;
}

export async function listEventAccess(eventId: string): Promise<EventAccessDoc[]> {
  const snap = await eventAccessCol()
    .where("eventId", "==", eventId)
    .orderBy("createdAt", "asc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as EventAccessDoc));
}

export async function listUserEvents(userId: string): Promise<string[]> {
  const snap = await eventAccessCol().where("userId", "==", userId).get();
  return snap.docs.map((d) => (d.data() as EventAccessDoc).eventId);
}

export async function countEventAccess(eventId: string): Promise<number> {
  const snap = await eventAccessCol().where("eventId", "==", eventId).count().get();
  return snap.data().count;
}
