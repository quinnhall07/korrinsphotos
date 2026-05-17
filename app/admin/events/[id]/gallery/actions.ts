"use server";

// app/admin/events/[id]/gallery/actions.ts
// Server actions for the admin gallery editor.

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
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

// Phase 13.5 — "Korrin's picks" overlay. Toggles the reserved `"korrinsPick"`
// tag on a single photo so clients can opt into the curated subset via the
// "Just show me Korrin's favorites" filter on the public gallery viewer.
//
// Implementation note: a parallel `toggleKorrinsPick` exists in
// `app/gallery/[id]/actions.ts` and is intentionally identical — keeping the
// admin gallery editor's wiring inside its own action module avoids the
// "client component imports from public gallery actions" cross-route smell.
export type ToggleKorrinsPickResult =
  | { success: true; tagged: boolean }
  | { success: false; error: string };

export async function toggleKorrinsPick(
  eventId: string,
  photoId: string
): Promise<ToggleKorrinsPickResult> {
  await requireAdmin();
  if (!eventId || !photoId) {
    return { success: false, error: "Missing event or photo." };
  }

  const photoRef = adminDb
    .collection("events")
    .doc(eventId)
    .collection("photos")
    .doc(photoId);

  const photoSnap = await photoRef.get();
  if (!photoSnap.exists) {
    return { success: false, error: "Photo not found." };
  }
  const tags = (photoSnap.data()?.tags as string[] | undefined) ?? [];
  const isTagged = tags.includes("korrinsPick");

  try {
    await photoRef.update({
      tags: isTagged
        ? FieldValue.arrayRemove("korrinsPick")
        : FieldValue.arrayUnion("korrinsPick"),
    });
  } catch (err) {
    console.error("[toggleKorrinsPick] update failed", { eventId, photoId, err });
    return { success: false, error: "Failed to update tag." };
  }

  revalidatePath(`/admin/events/${eventId}/gallery`);
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/gallery/${eventId}`);
  return { success: true, tagged: !isTagged };
}
