"use server";

// app/admin/bookings/actions.ts
// Server Actions for booking inquiries.
// Phase 1 additions: tags, lead scoring, communication log,
// follow-up dates, bulk status updates, lead source tracking.

import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/session";
import { FieldValue } from "firebase-admin/firestore";
import { calculateLeadScore } from "@/lib/lead-scoring";
import type { LeadStatus, LeadSource, CommunicationChannel } from "@/lib/firestore";
import { randomUUID } from "crypto";
import { z } from "zod";

// ─── Update Status ────────────────────────────────────────────────────────────

export async function updateBookingStatus(
  id: string,
  status: LeadStatus
): Promise<void> {
  await requireAdmin();
  await adminDb.collection("bookingInquiries").doc(id).update({
    status,
    updatedAt: FieldValue.serverTimestamp(),
  });
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
      ...(details.estimatedValue !== undefined ? { estimatedValue: details.estimatedValue } : {}),
      ...scoreUpdate,
      updatedAt: FieldValue.serverTimestamp(),
    });

    revalidatePath("/admin/bookings");
    return { success: true };
  } catch (err) {
    console.error("updateBookingDetails error:", err);
    return { success: false, error: "Failed to save changes." };
  }
}

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
    const newScore = calculateLeadScore(freshDoc.data() as Parameters<typeof calculateLeadScore>[0]);
    await adminDb.collection("bookingInquiries").doc(id).update({ leadScore: newScore });

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
    const newScore = calculateLeadScore(freshDoc.data() as Parameters<typeof calculateLeadScore>[0]);
    await adminDb.collection("bookingInquiries").doc(id).update({ leadScore: newScore });

    revalidatePath("/admin/bookings");
    return { success: true };
  } catch (err) {
    console.error("removeTag error:", err);
    return { success: false, error: "Failed to remove tag." };
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
    const newScore = calculateLeadScore(freshDoc.data() as Parameters<typeof calculateLeadScore>[0]);
    await adminDb.collection("bookingInquiries").doc(id).update({ leadScore: newScore });

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

// ─── Communication Log ────────────────────────────────────────────────────────

const CommLogSchema = z.object({
  channel: z.enum(["EMAIL", "PHONE", "SMS", "IN_PERSON"]),
  summary: z.string().min(1).max(2000),
});

export async function logCommunication(
  id: string,
  entry: { channel: CommunicationChannel; summary: string }
): Promise<{ success: boolean; error?: string }> {
  const session = await requireAdmin();

  const parsed = CommLogSchema.safeParse(entry);
  if (!parsed.success) {
    return { success: false, error: "Invalid log entry." };
  }

  try {
    const logEntry = {
      id: randomUUID(),
      timestamp: new Date(),
      channel: entry.channel,
      summary: entry.summary.trim(),
      adminUid: session.uid,
    };

    await adminDb.collection("bookingInquiries").doc(id).update({
      communicationLog: FieldValue.arrayUnion(logEntry),
      lastContactedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    revalidatePath("/admin/bookings");
    return { success: true };
  } catch (err) {
    console.error("logCommunication error:", err);
    return { success: false, error: "Failed to log communication." };
  }
}

export async function deleteCommunicationLog(
  id: string,
  logEntry: {
    id: string;
    channel: CommunicationChannel;
    summary: string;
    adminUid: string;
    timestamp: Date;
  }
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  try {
    await adminDb.collection("bookingInquiries").doc(id).update({
      communicationLog: FieldValue.arrayRemove(logEntry),
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidatePath("/admin/bookings");
    return { success: true };
  } catch (err) {
    return { success: false, error: "Failed to delete log entry." };
  }
}

// ─── Send Email Response ──────────────────────────────────────────────────────

export async function sendBookingResponse(
  id: string,
  { to, name, subject, message }: {
    to: string;
    name: string;
    subject: string;
    message: string;
  }
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  try {
    const doc = await adminDb.collection("bookingInquiries").doc(id).get();
    if (!doc.exists) return { success: false, error: "Booking not found." };

    await adminDb.collection("mail").add({
      to,
      message: {
        subject,
        html: buildResponseHtml({ name, message, subject }),
      },
      createdAt: FieldValue.serverTimestamp(),
    });

    await adminDb.collection("bookingInquiries").doc(id).update({
      lastRespondedAt: FieldValue.serverTimestamp(),
      lastContactedAt: FieldValue.serverTimestamp(),
      status: doc.data()?.status === "PENDING" ? "QUALIFIED" : doc.data()?.status,
      updatedAt: FieldValue.serverTimestamp(),
    });

    revalidatePath("/admin/bookings");
    return { success: true };
  } catch (err) {
    console.error("sendBookingResponse error:", err);
    return { success: false, error: "Failed to send email." };
  }
}

// ─── Recalculate Score (utility for backfill) ─────────────────────────────────

export async function recalculateLeadScore(
  id: string
): Promise<{ success: boolean; score?: number; error?: string }> {
  await requireAdmin();

  try {
    const doc = await adminDb.collection("bookingInquiries").doc(id).get();
    if (!doc.exists) return { success: false, error: "Not found." };

    const score = calculateLeadScore(doc.data() as Parameters<typeof calculateLeadScore>[0]);
    await adminDb.collection("bookingInquiries").doc(id).update({
      leadScore: score,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true, score };
  } catch (err) {
    return { success: false, error: "Failed to recalculate score." };
  }
}

// ─── Email Template Builder ───────────────────────────────────────────────────

function buildResponseHtml({
  name,
  message,
  subject,
}: {
  name: string;
  message: string;
  subject: string;
}): string {
  const messageHtml = message
    .split("\n")
    .map((line) => `<p style="margin:0 0 12px;font-size:15px;color:#4A4A47;line-height:1.8;">${line}</p>`)
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#FAF9F6;font-family:'Georgia',serif;">
  <div style="max-width:560px;margin:40px auto;background:#FAF9F6;border:0.5px solid rgba(42,42,40,0.15);">
    <div style="background:#2A2A28;padding:32px 40px;">
      <p style="margin:0;font-size:22px;font-weight:300;color:#FAF9F6;letter-spacing:0.04em;">
        Korrin&apos;s Photos<span style="color:#6B7845;">.</span>
      </p>
    </div>
    <div style="padding:40px;">
      <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#6B7845;">Message from Korrin</p>
      <h1 style="margin:0 0 24px;font-size:26px;font-weight:300;color:#2A2A28;line-height:1.2;">Hi ${name},</h1>
      ${messageHtml}
      <div style="margin-top:32px;padding-top:24px;border-top:0.5px solid rgba(42,42,40,0.12);">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/booking"
           style="display:inline-block;margin-top:8px;padding:12px 28px;background:#6B7845;color:#FAF9F6;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;text-decoration:none;font-family:sans-serif;">
          View Booking Page
        </a>
      </div>
    </div>
    <div style="padding:24px 40px;border-top:0.5px solid rgba(42,42,40,0.12);">
      <p style="margin:0;font-size:12px;color:#8A8A85;line-height:1.6;">
        © ${new Date().getFullYear()} Korrin&apos;s Photos. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>`.trim();
}