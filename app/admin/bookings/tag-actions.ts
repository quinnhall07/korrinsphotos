"use server";

import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/session";
import { FieldValue } from "firebase-admin/firestore";
import { calculateLeadScore, type LeadScoreInput } from "@/lib/lead-scoring";

// ─── Tag Management ───────────────────────────────────────────────────────────

export async function addTag(
  id: string,
  tag: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  try {
    const doc = await adminDb.collection("bookingInquiries").doc(id).get();
    if (!doc.exists) return { success: false, error: "Inquiry not found." };

    await adminDb.collection("bookingInquiries").doc(id).update({
      tags: FieldValue.arrayUnion(tag),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Recalculate score with new tag
    const freshDoc = await adminDb.collection("bookingInquiries").doc(id).get();
    const newScore = calculateLeadScore(
      freshDoc.data() as LeadScoreInput
    );
    await adminDb
      .collection("bookingInquiries")
      .doc(id)
      .update({ leadScore: newScore });

    revalidatePath("/admin/bookings");
    return { success: true };
  } catch (err) {
    console.error("addTag error:", err);
    return { success: false, error: "Failed to add tag." };
  }
}

export async function removeTag(
  id: string,
  tag: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  try {
    await adminDb.collection("bookingInquiries").doc(id).update({
      tags: FieldValue.arrayRemove(tag),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const freshDoc = await adminDb.collection("bookingInquiries").doc(id).get();
    const newScore = calculateLeadScore(
      freshDoc.data() as LeadScoreInput
    );
    await adminDb
      .collection("bookingInquiries")
      .doc(id)
      .update({ leadScore: newScore });

    revalidatePath("/admin/bookings");
    return { success: true };
  } catch (err) {
    console.error("removeTag error:", err);
    return { success: false, error: "Failed to remove tag." };
  }
}

