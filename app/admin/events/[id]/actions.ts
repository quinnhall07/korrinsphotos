"use server";

// app/admin/events/[id]/actions.ts
// Server Actions for the event detail page.
// Each action re-validates admin auth before performing any mutation.

import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/session";
import {
  deleteFromCloudflareImages,
  deleteFromR2,
} from "@/lib/cloudflare";
import { FieldValue } from "firebase-admin/firestore";

// ─── Delete Photo ─────────────────────────────────────────────────────────────

interface DeletePhotoArgs {
  photoId: string;
  eventId: string;
  cloudflareImageId: string;
  r2Key: string | null;
}

export async function deletePhoto({
  photoId,
  eventId,
  cloudflareImageId,
  r2Key,
}: DeletePhotoArgs): Promise<void> {
  await requireAdmin();

  // 1. Remove from Firestore
  await adminDb
    .collection("events")
    .doc(eventId)
    .collection("photos")
    .doc(photoId)
    .delete();

  // 2. Remove from Cloudflare Images (best-effort — don't throw if it fails)
  try {
    await deleteFromCloudflareImages(cloudflareImageId);
  } catch (err) {
    console.error("Cloudflare Images delete failed:", err);
  }

  // 3. Remove from R2 (best-effort)
  if (r2Key) {
    try {
      await deleteFromR2(r2Key);
    } catch (err) {
      console.error("R2 delete failed:", err);
    }
  }

  revalidatePath(`/admin/events/${eventId}`);
}

// ─── Revoke Access ────────────────────────────────────────────────────────────

export async function revokeAccess(
  userId: string,
  eventId: string
): Promise<void> {
  await requireAdmin();

  const accessId = `${userId}_${eventId}`;
  await adminDb.collection("eventAccess").doc(accessId).delete();

  revalidatePath(`/admin/events/${eventId}`);
}

// ─── Update Event Title ───────────────────────────────────────────────────────

export async function updateEventTitle(
  eventId: string,
  title: string
): Promise<void> {
  await requireAdmin();

  if (!title.trim()) return;

  await adminDb.collection("events").doc(eventId).update({
    title: title.trim(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/admin/events");
  revalidatePath("/admin");
}