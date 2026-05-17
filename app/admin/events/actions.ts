"use server";

// app/admin/events/actions.ts
// Server Actions: create, delete events, and clear gallery data.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/session";
import { FieldValue } from "firebase-admin/firestore";
import { deleteEventAndAssets, clearEventGallery } from "@/lib/domain/events";

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

export async function deleteEvent(
  eventId: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  try {
    await deleteEventAndAssets(eventId);

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

export async function clearGallery(
  eventId: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  try {
    await clearEventGallery(eventId);

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