import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { deleteFromCloudflareImages, deleteFromR2 } from "@/lib/cloudflare";

/**
 * Completely removes an event and all associated data:
 * - Photos subcollection
 * - Cloudflare Images assets
 * - Cloudflare R2 objects
 * - Event Access documents
 * - The Event document itself
 */
export async function deleteEventAndAssets(eventId: string): Promise<void> {
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
      if (data.cloudflareImageId) {
        await deleteFromCloudflareImages(data.cloudflareImageId as string);
      }
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
}

/**
 * Removes all photos and revokes all client access for an event WITHOUT
 * deleting the event document itself. This "wipes" the gallery.
 */
export async function clearEventGallery(eventId: string): Promise<void> {
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
      if (data.cloudflareImageId) {
        await deleteFromCloudflareImages(data.cloudflareImageId as string);
      }
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
}
