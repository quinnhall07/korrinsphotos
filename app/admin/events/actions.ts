"use server";

// app/admin/events/actions.ts
// Server Action: creates a new event in Firestore and redirects to its detail page.

import { redirect }     from "next/navigation";
import { adminDb }      from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/session";
import { FieldValue }   from "firebase-admin/firestore";

export async function createEvent(formData: FormData) {
  await requireAdmin();

  const title = (formData.get("title") as string) || "New Event";

  const docRef = await adminDb.collection("events").add({
    title,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  redirect(`/admin/events/${docRef.id}`);
}