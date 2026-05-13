"use server";

import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/session";
import { FieldValue } from "firebase-admin/firestore";
import { calculateLeadScore } from "@/lib/lead-scoring";
import { logActivity } from "@/lib/db/activity";
import type { LeadStatus, LeadSource } from "@/lib/booking-kanban";

// ─── Update Status ────────────────────────────────────────────────────────────

export async function updateBookingStatus(
  id: string,
  status: LeadStatus
): Promise<void> {
  await requireAdmin();

  const doc = await adminDb.collection("bookingInquiries").doc(id).get();
  const data = doc.data();
  const name = doc.exists
    ? `${data?.firstName ?? ""} ${data?.lastName ?? ""}`.trim()
    : "Unknown";

  await adminDb.collection("bookingInquiries").doc(id).update({
    status,
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Automated Pipeline: Booking -> Event Synchronization
  if (status === "BOOKED" && data && !data.eventId) {
    const newEventRef = adminDb.collection("events").doc();
    const eventTitle = `${name} - ${data.sessionType || "Session"}`;
    
    await newEventRef.set({
      title: eventTitle,
      bookingId: id,
      clientEmail: data.email,
      clientName: name,
      status: "UPCOMING",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await adminDb.collection("bookingInquiries").doc(id).update({
      eventId: newEventRef.id,
      eventName: eventTitle,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await logActivity(
      "STATUS_CHANGED",
      `Event "${eventTitle}" auto-generated from approved booking`,
      { eventId: newEventRef.id, inquiryId: id }
    ).catch(() => {});
  }

  // Log to activity feed
  await logActivity(
    "STATUS_CHANGED",
    `${name} moved to ${status.replace(/_/g, " ").toLowerCase()}`,
    { inquiryId: id, status }
  ).catch(() => { }); // best-effort

  revalidatePath("/admin/bookings");
  revalidatePath("/admin");
}

// ─── Bulk Status Update ───────────────────────────────────────────────────────

export async function bulkUpdateStatus(
  ids: string[],
  status: LeadStatus
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  if (ids.length === 0) return { success: true };

  try {
    const batch = adminDb.batch();
    ids.forEach((id) => {
      batch.update(adminDb.collection("bookingInquiries").doc(id), {
        status,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();

    await logActivity(
      "STATUS_CHANGED",
      `${ids.length} inquir${ids.length === 1 ? "y" : "ies"} bulk-moved to ${status.replace(/_/g, " ").toLowerCase()}`,
      { ids, status }
    ).catch(() => { });

    revalidatePath("/admin/bookings");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    console.error("bulkUpdateStatus error:", err);
    return { success: false, error: "Failed to update inquiries." };
  }
}

// ─── Update Notes & Pricing ───────────────────────────────────────────────────

export async function updateBookingDetails(
  id: string,
  details: { notes?: string; pricing?: string; estimatedValue?: number }
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  try {
    // Recalculate score if estimated value changed
    let scoreUpdate: Record<string, unknown> = {};
    if (details.estimatedValue !== undefined) {
      const doc = await adminDb.collection("bookingInquiries").doc(id).get();
      if (doc.exists) {
        const data = doc.data()!;
        const newScore = calculateLeadScore({
          ...data,
          estimatedValue: details.estimatedValue,
        } as Parameters<typeof calculateLeadScore>[0]);
        scoreUpdate = { leadScore: newScore };
      }
    }

    await adminDb.collection("bookingInquiries").doc(id).update({
      ...(details.notes !== undefined ? { notes: details.notes } : {}),
      ...(details.pricing !== undefined ? { pricing: details.pricing } : {}),
      ...(details.estimatedValue !== undefined
        ? { estimatedValue: details.estimatedValue }
        : {}),
      ...scoreUpdate,
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (details.notes !== undefined) {
      await logActivity("NOTE_ADDED", `Internal note updated`, {
        inquiryId: id,
      }).catch(() => { });
    }

    revalidatePath("/admin/bookings");
    return { success: true };
  } catch (err) {
    console.error("updateBookingDetails error:", err);
    return { success: false, error: "Failed to save changes." };
  }
}

// ─── Lead Source ──────────────────────────────────────────────────────────────

export async function updateLeadSource(
  id: string,
  leadSource: LeadSource
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  try {
    await adminDb.collection("bookingInquiries").doc(id).update({
      leadSource,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const freshDoc = await adminDb.collection("bookingInquiries").doc(id).get();
    const newScore = calculateLeadScore(
      freshDoc.data() as Parameters<typeof calculateLeadScore>[0]
    );
    await adminDb
      .collection("bookingInquiries")
      .doc(id)
      .update({ leadScore: newScore });

    revalidatePath("/admin/bookings");
    return { success: true };
  } catch (err) {
    return { success: false, error: "Failed to update lead source." };
  }
}

// ─── Follow-Up Date ───────────────────────────────────────────────────────────

export async function setFollowUpDate(
  id: string,
  dateIso: string | null
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  try {
    await adminDb.collection("bookingInquiries").doc(id).update({
      followUpDate: dateIso ? new Date(dateIso) : null,
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidatePath("/admin/bookings");
    return { success: true };
  } catch (err) {
    return { success: false, error: "Failed to set follow-up date." };
  }
}

// ─── Delete Booking Inquiry ───────────────────────────────────────────────────

export async function deleteBookingInquiry(
  id: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  try {
    const doc = await adminDb.collection("bookingInquiries").doc(id).get();
    if (!doc.exists) return { success: false, error: "Inquiry not found." };

    const name = `${doc.data()?.firstName ?? ""} ${doc.data()?.lastName ?? ""}`.trim();
    await adminDb.collection("bookingInquiries").doc(id).delete();

    await logActivity(
      "STATUS_CHANGED",
      `${name || "Unknown"} inquiry deleted`,
      { inquiryId: id }
    ).catch(() => { });

    revalidatePath("/admin/bookings");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    console.error("deleteBookingInquiry error:", err);
    return { success: false, error: "Failed to delete inquiry." };
  }
}

// ─── Create Booking Inquiry ───────────────────────────────────────────────────

export async function createBookingInquiry(data: {
  firstName: string;
  lastName: string;
  email: string;
  sessionType: string;
  eventId?: string | null;
  eventName?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  try {
    const newDoc = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      sessionType: data.sessionType,
      status: "PENDING",
      message: "",
      notes: "",
      pricing: "",
      leadScore: calculateLeadScore({
        sessionType: data.sessionType,
        message: "",
        tags: [],
      }),
      tags: [],
      leadSource: null,
      estimatedValue: null,
      followUpDate: null,
      lastContactedAt: null,
      lastRespondedAt: null,
      preferredDate: null,
      communicationLog: [],
      eventId: data.eventId ?? null,
      eventName: data.eventName ?? null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await adminDb.collection("bookingInquiries").add(newDoc);

    await logActivity(
      "LEAD_RECEIVED",
      `${data.firstName} ${data.lastName} (${data.sessionType}) added manually`,
      { email: data.email }
    ).catch(() => { });

    revalidatePath("/admin/bookings");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    console.error("createBookingInquiry error:", err);
    return { success: false, error: "Failed to create inquiry." };
  }
}

// ─── Link Event to Inquiry ────────────────────────────────────────────────────

export async function linkEventToInquiry(
  inquiryId: string,
  eventId: string | null
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  try {
    let eventName: string | null = null;

    if (eventId) {
      const eventDoc = await adminDb.collection("events").doc(eventId).get();
      if (!eventDoc.exists) {
        return { success: false, error: "Event not found." };
      }
      eventName = (eventDoc.data()?.title as string) ?? null;

      const inquiryDoc = await adminDb.collection("bookingInquiries").doc(inquiryId).get();
      if (inquiryDoc.exists) {
        const inquiryData = inquiryDoc.data();
        await adminDb.collection("events").doc(eventId).update({
          bookingId: inquiryId,
          clientEmail: inquiryData?.email || null,
          clientName: `${inquiryData?.firstName ?? ""} ${inquiryData?.lastName ?? ""}`.trim() || null,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    await adminDb.collection("bookingInquiries").doc(inquiryId).update({
      eventId: eventId || null,
      eventName: eventName,          // ← this line was missing
      updatedAt: FieldValue.serverTimestamp(),
    });

    revalidatePath("/admin/bookings");
    return { success: true };
  } catch (err) {
    console.error("linkEventToInquiry error:", err);
    return { success: false, error: "Failed to link event." };
  }
}
