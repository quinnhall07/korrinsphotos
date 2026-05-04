"use server";
// app/admin/users/actions.ts

import { revalidatePath } from "next/cache";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/session";

export async function removeUser(uid: string): Promise<void> {
  await requireAdmin();

  // Remove all event access for this user
  const accessSnap = await adminDb
    .collection("eventAccess")
    .where("userId", "==", uid)
    .get();

  const batch = adminDb.batch();
  accessSnap.docs.forEach((doc) => batch.delete(doc.ref));
  batch.delete(adminDb.collection("users").doc(uid));
  await batch.commit();

  // Disable the Firebase Auth account (softer than deleting)
  try {
    await adminAuth.updateUser(uid, { disabled: true });
  } catch {
    // User may not have a Firebase Auth account yet (invited but never signed in)
  }

  revalidatePath("/admin/users");
}