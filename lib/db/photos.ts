import { adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

export interface PhotoDoc {
  id: string;
  eventId: string;
  cloudflareUrl: string;
  cloudflareImageId: string;
  label?: string;
  category?: string;
  uploadedAt: Timestamp;
}

export const photosCol = () => adminDb.collection("photos");

export async function listPhotos(eventId: string): Promise<PhotoDoc[]> {
  const snap = await photosCol()
    .where("eventId", "==", eventId)
    .orderBy("uploadedAt", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PhotoDoc));
}

export async function listPublicPhotos(limit = 9): Promise<PhotoDoc[]> {
  const snap = await photosCol()
    .where("category", "!=", null)
    .orderBy("category")
    .orderBy("uploadedAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PhotoDoc));
}

export async function createPhoto(data: Omit<PhotoDoc, "id" | "uploadedAt">): Promise<PhotoDoc> {
  const ref = photosCol().doc();
  const uploadedAt = Timestamp.now();
  await ref.set({ ...data, uploadedAt });
  return { id: ref.id, ...data, uploadedAt };
}

export async function deletePhoto(photoId: string): Promise<void> {
  await photosCol().doc(photoId).delete();
}

export async function countPhotos(eventId: string): Promise<number> {
  const snap = await photosCol().where("eventId", "==", eventId).count().get();
  return snap.data().count;
}
