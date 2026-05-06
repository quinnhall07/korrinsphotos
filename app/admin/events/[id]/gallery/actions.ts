"use server";

// app/admin/events/[id]/gallery/actions.ts
// Server actions for the admin gallery editor.

import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/session";

export async function toggleGalleryReady(
  eventId: string,
  photoIds: string[],
  galleryReady: boolean
): Promise<void> {
  await requireAdmin();

  const batch = adminDb.batch();
  const photosRef = adminDb.collection("events").doc(eventId).collection("photos");

  for (const photoId of photoIds) {
    batch.update(photosRef.doc(photoId), { galleryReady });
  }

  await batch.commit();
  revalidatePath(`/admin/events/${eventId}/gallery`);
}
