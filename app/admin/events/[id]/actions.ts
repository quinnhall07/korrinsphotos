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
import type { EventStatus } from "@/lib/db/events";
import { setDownloadPin } from "@/lib/db/events";
import { updatePhoto } from "@/lib/db/photos";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

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

// ─── Update Event Status ────────────────────────────────────────────────────────

export async function updateEventStatus(
  eventId: string,
  status: EventStatus
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  const eventDoc = await adminDb.collection("events").doc(eventId).get();
  if (!eventDoc.exists) return { success: false, error: "Event not found" };

  const eventData = eventDoc.data();

  await adminDb.collection("events").doc(eventId).update({
    status,
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Legacy: events linked to a historical bookingInquiry (pre-Project model)
  // get their booking doc archived when the event hits a terminal status.
  // The /admin/bookings UI no longer exists, but the field is still read by
  // any old scripts/reports until the historical collection is migrated.
  const TERMINAL_FOR_BOOKING: ReadonlySet<EventStatus> = new Set([
    "COMPLETED",
    "DELIVERED",
    "ARCHIVED",
  ]);
  if (TERMINAL_FOR_BOOKING.has(status) && eventData?.bookingId) {
    await adminDb.collection("bookingInquiries").doc(eventData.bookingId).update({
      status: "ARCHIVED",
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/admin/events");
  return { success: true };
}

// ─── Update Shoot Scheduling ──────────────────────────────────────────────────

export async function updateShootDates(
  eventId: string,
  updates: {
    startDate?: string | null;
    endDate?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    isMultiDay?: boolean;
    location?: string | null;
  }
): Promise<void> {
  await requireAdmin();

  const updatePayload: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (updates.startDate !== undefined) updatePayload.startDate = updates.startDate;
  if (updates.endDate !== undefined) updatePayload.endDate = updates.endDate;
  if (updates.startTime !== undefined) updatePayload.startTime = updates.startTime;
  if (updates.endTime !== undefined) updatePayload.endTime = updates.endTime;
  if (updates.isMultiDay !== undefined) updatePayload.isMultiDay = updates.isMultiDay;
  if (updates.location !== undefined) updatePayload.location = updates.location;

  // Clear fields if explicitly set to null
  for (const key of Object.keys(updatePayload)) {
    if (updatePayload[key] === null) {
      updatePayload[key] = FieldValue.delete();
    }
  }

  await adminDb.collection("events").doc(eventId).update(updatePayload);

  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/admin/events");
}

// ─── Phase 2.6 — Download PIN gate ─────────────────────────────────────────────
//
// `setEventDownloadPin` writes or clears a per-event numeric PIN. When set,
// the public + favorites zip endpoints require `?pin=...` to match. The
// comparison is constant-time (see `verifyDownloadPin` in lib/db/events).
//
// Validation rules (mirrored on the admin UI):
//   - `pin === null` → clear.
//   - non-null → 4–6 digits, numeric only.

export async function setEventDownloadPin(
  eventId: string,
  pin: string | null,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  if (pin !== null) {
    const trimmed = pin.trim();
    if (!/^\d{4,6}$/.test(trimmed)) {
      return { success: false, error: "PIN must be 4–6 digits." };
    }
    pin = trimmed;
  }

  try {
    await setDownloadPin(eventId, pin);
  } catch (err) {
    console.error("[setEventDownloadPin] failed", { eventId, err });
    return { success: false, error: "Failed to save PIN." };
  }

  revalidatePath(`/admin/events/${eventId}`);
  return { success: true };
}

// ─── Wave 10 — Update Photo Metadata (label / category) ───────────────────────
//
// Drives the inline pencil-edit popover in `PhotoGrid.tsx`. Only writes the
// fields explicitly present in `partial`. Pass `null` for `label` / `category`
// to clear the field (FieldValue.delete()).
//
// Other photo fields (cloudflareImageId, r2Key, favoritedBy, viewCount, etc.)
// are preserved by `updatePhoto()` (Firestore `update()`, not `set()`).

export async function updatePhotoMetadata(
  eventId: string,
  photoId: string,
  partial: { label?: string | null; category?: string | null },
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  try {
    const cleaned: { label?: string | null; category?: string | null } = {};
    if (partial.label !== undefined) {
      const trimmed = partial.label?.trim();
      cleaned.label = trimmed && trimmed.length > 0 ? trimmed : null;
    }
    if (partial.category !== undefined) {
      const trimmed = partial.category?.trim();
      cleaned.category = trimmed && trimmed.length > 0 ? trimmed : null;
    }

    await updatePhoto(eventId, photoId, cleaned);
  } catch (err) {
    console.error("[updatePhotoMetadata] failed", { eventId, photoId, err });
    return { success: false, error: "Failed to update photo." };
  }

  revalidatePath(`/admin/events/${eventId}`);
  return { success: true };
}