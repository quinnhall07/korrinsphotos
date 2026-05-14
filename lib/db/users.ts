import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, type Timestamp } from "firebase-admin/firestore";

export type Role = "ADMIN" | "CLIENT";

export interface NotificationPrefs {
  galleryAlerts?: boolean;
  bookingReminders?: boolean;
}

export interface UserDoc {
  uid: string;
  email: string;
  displayName?: string | null;
  photoURL?: string | null;
  role: Role;
  phone?: string;
  notificationPrefs?: NotificationPrefs;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export const usersCol = () => adminDb.collection("users");

export async function getUser(uid: string): Promise<UserDoc | null> {
  const snap = await usersCol().doc(uid).get();
  if (!snap.exists) return null;
  return { uid: snap.id, ...(snap.data() as Omit<UserDoc, "uid">) };
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

export interface UpdateUserPreferencesInput {
  phone?: string;
  notificationPrefs?: NotificationPrefs;
  displayName?: string | null;
}

export async function updateUserPreferences(
  uid: string,
  prefs: UpdateUserPreferencesInput
): Promise<void> {
  const ref = usersCol().doc(uid);
  await ref.set(
    { ...prefs, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
}
