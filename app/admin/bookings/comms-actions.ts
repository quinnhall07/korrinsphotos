"use server";

import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/session";
import { FieldValue } from "firebase-admin/firestore";
import { logActivity } from "@/lib/firestore";
import type { LeadStatus, CommunicationChannel } from "@/lib/booking-kanban";
import { randomUUID } from "crypto";
import { z } from "zod";

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

    await logActivity(
      "NOTE_ADDED",
      `${entry.channel.toLowerCase()} interaction logged`,
      { inquiryId: id, channel: entry.channel }
    ).catch(() => { });

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
  {
    to,
    name,
    subject,
    message,
  }: {
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

    const currentStatus = doc.data()?.status as LeadStatus | undefined;
    // Advance PENDING leads to QUALIFIED when an email is sent; leave others unchanged
    const nextStatus: LeadStatus =
      currentStatus === "PENDING" ? "QUALIFIED" : (currentStatus ?? "QUALIFIED");

    await adminDb.collection("bookingInquiries").doc(id).update({
      lastRespondedAt: FieldValue.serverTimestamp(),
      lastContactedAt: FieldValue.serverTimestamp(),
      status: nextStatus,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await logActivity(
      "EMAIL_SENT",
      `Email sent to ${name} (${to})`,
      { inquiryId: id, subject }
    ).catch(() => { });

    revalidatePath("/admin/bookings");
    return { success: true };
  } catch (err) {
    console.error("sendBookingResponse error:", err);
    return { success: false, error: "Failed to send email." };
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
    .map(
      (line) =>
        `<p style="margin:0 0 12px;font-size:15px;color:#4A4A47;line-height:1.8;">${line}</p>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#FAF9F6;font-family:'Georgia',serif;">
  <div style="max-width:560px;margin:40px auto;background:#FAF9F6;border:0.5px solid rgba(42,42,40,0.15);">
    <div style="background:#2A2A28;padding:32px 40px;">
      <p style="margin:0;font-size:22px;font-weight:300;color:#FAF9F6;letter-spacing:0.04em;">
        Korrin&apos;s Photography<span style="color:#6B7845;">.</span>
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
        © ${new Date().getFullYear()} Korrin&apos;s Photography. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>`.trim();
}
