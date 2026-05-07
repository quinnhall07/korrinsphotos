import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export type Role = "ADMIN" | "CLIENT";

export interface UserDoc {
  uid: string;
  email: string;
  displayName?: string | null;
  photoURL?: string | null;
  role: Role;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export const usersCol = () => adminDb.collection("users");

export async function getUser(uid: string): Promise<UserDoc | null> {
  const snap = await usersCol().doc(uid).get();
  return snap.exists ? ({ uid, ...snap.data() } as UserDoc) : null;
}

export async function upsertUser(uid: string, data: Partial<UserDoc>): Promise<void> {
  const ref = usersCol().doc(uid);
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = FieldValue.serverTimestamp();
    if (!snap.exists) {
      tx.set(ref, { ...data, createdAt: now, updatedAt: now });
    } else {
      tx.set(ref, { ...data, updatedAt: now }, { merge: true });
    }
  });
}

export async function listUsers(): Promise<UserDoc[]> {
  const snap = await usersCol().orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserDoc));
}
