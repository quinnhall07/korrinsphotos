"use server";

// app/admin/events/actions.ts
// Server Actions: create, delete events, and clear gallery data.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/session";
import { FieldValue } from "firebase-admin/firestore";
import {
  deleteFromCloudflareImages,
  deleteFromR2,
} from "@/lib/cloudflare";

// ─── Create Event ─────────────────────────────────────────────────────────────

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

// ─── Delete Event ─────────────────────────────────────────────────────────────
// Removes the event document, all photos in its subcollection (+ their
// Cloudflare Images and R2 objects), and all associated eventAccess documents.

export async function deleteEvent(
  eventId: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  try {
    // 1. Fetch all photos in the event's subcollection
    const photosSnap = await adminDb
      .collection("events")
      .doc(eventId)
      .collection("photos")
      .get();

    // 2. Delete each photo's external assets (best-effort)
    const photoDeletes = photosSnap.docs.map(async (doc) => {
      const data = doc.data();
      try {
        await deleteFromCloudflareImages(data.cloudflareImageId as string);
      } catch (err) {
        console.error("CF Images delete failed:", err);
      }
      if (data.r2Key) {
        try {
          await deleteFromR2(data.r2Key as string);
        } catch (err) {
          console.error("R2 delete failed:", err);
        }
      }
    });

    await Promise.allSettled(photoDeletes);

    // 3. Batch-delete photos subcollection documents
    const batch1 = adminDb.batch();
    photosSnap.docs.forEach((doc) => batch1.delete(doc.ref));
    if (photosSnap.docs.length > 0) await batch1.commit();

    // 4. Delete all eventAccess documents for this event
    const accessSnap = await adminDb
      .collection("eventAccess")
      .where("eventId", "==", eventId)
      .get();

    const batch2 = adminDb.batch();
    accessSnap.docs.forEach((doc) => batch2.delete(doc.ref));
    if (accessSnap.docs.length > 0) await batch2.commit();

    // 5. Delete the event document itself
    await adminDb.collection("events").doc(eventId).delete();

    revalidatePath("/admin/events");
    revalidatePath("/admin");

    return { success: true };
  } catch (err) {
    console.error("deleteEvent error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete event.",
    };
  }
}

// ─── Clear Gallery ────────────────────────────────────────────────────────────
// Removes all photos and revokes all client access for an event WITHOUT
// deleting the event document itself. This "wipes" the gallery.

export async function clearGallery(
  eventId: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  try {
    // 1. Fetch all photos in the event's subcollection
    const photosSnap = await adminDb
      .collection("events")
      .doc(eventId)
      .collection("photos")
      .get();

    // 2. Delete external assets (best-effort)
    const photoDeletes = photosSnap.docs.map(async (doc) => {
      const data = doc.data();
      try {
        await deleteFromCloudflareImages(data.cloudflareImageId as string);
      } catch (err) {
        console.error("CF Images delete failed:", err);
      }
      if (data.r2Key) {
        try {
          await deleteFromR2(data.r2Key as string);
        } catch (err) {
          console.error("R2 delete failed:", err);
        }
      }
    });

    await Promise.allSettled(photoDeletes);

    // 3. Batch-delete photos subcollection documents
    const batch1 = adminDb.batch();
    photosSnap.docs.forEach((doc) => batch1.delete(doc.ref));
    if (photosSnap.docs.length > 0) await batch1.commit();

    // 4. Delete all eventAccess documents for this event
    const accessSnap = await adminDb
      .collection("eventAccess")
      .where("eventId", "==", eventId)
      .get();

    const batch2 = adminDb.batch();
    accessSnap.docs.forEach((doc) => batch2.delete(doc.ref));
    if (accessSnap.docs.length > 0) await batch2.commit();

    // 5. Mark the event as updated
    await adminDb.collection("events").doc(eventId).update({
      updatedAt: FieldValue.serverTimestamp(),
    });

    revalidatePath(`/admin/events/${eventId}`);
    revalidatePath("/admin/events");

    return { success: true };
  } catch (err) {
    console.error("clearGallery error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to clear gallery.",
    };
  }
}