"use server";

// app/admin/bookings/actions.ts
// Server Actions for booking inquiries: status updates, notes/pricing, email responses.

import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/session";
import { FieldValue } from "firebase-admin/firestore";

type Status = "PENDING" | "REVIEWED" | "BOOKED" | "ARCHIVED";

// ─── Update Status ────────────────────────────────────────────────────────────

export async function updateBookingStatus(
  id: string,
  status: Status
): Promise<void> {
  await requireAdmin();

  await adminDb.collection("bookingInquiries").doc(id).update({
    status,
    updatedAt: FieldValue.serverTimestamp(),
  });

  revalidatePath("/admin/bookings");
  revalidatePath("/admin");
}

// ─── Update Notes & Pricing ───────────────────────────────────────────────────

export async function updateBookingDetails(
  id: string,
  details: { notes?: string; pricing?: string }
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  try {
    await adminDb.collection("bookingInquiries").doc(id).update({
      notes: details.notes ?? "",
      pricing: details.pricing ?? "",
      updatedAt: FieldValue.serverTimestamp(),
    });

    revalidatePath("/admin/bookings");
    return { success: true };
  } catch (err) {
    console.error("updateBookingDetails error:", err);
    return { success: false, error: "Failed to save changes." };
  }
}

// ─── Send Email Response ──────────────────────────────────────────────────────
// Writes to the `mail` collection for Firebase Trigger Email extension to dispatch.

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

    // Write to mail collection — Firebase Trigger Email picks this up
    await adminDb.collection("mail").add({
      to,
      message: {
        subject,
        html: buildResponseHtml({ name, message, subject }),
      },
      createdAt: FieldValue.serverTimestamp(),
    });

    // Record that a response was sent
    await adminDb.collection("bookingInquiries").doc(id).update({
      lastRespondedAt: FieldValue.serverTimestamp(),
      status: "REVIEWED",
      updatedAt: FieldValue.serverTimestamp(),
    });

    revalidatePath("/admin/bookings");
    return { success: true };
  } catch (err) {
    console.error("sendBookingResponse error:", err);
    return { success: false, error: "Failed to send email." };
  }
}

// ─── Email Template ───────────────────────────────────────────────────────────

function buildResponseHtml({
  name,
  message,
  subject,
}: {
  name: string;
  message: string;
  subject: string;
}): string {
  // Convert newlines to <br> tags for HTML email
  const messageHtml = message
    .split("\n")
    .map((line) => `<p style="margin:0 0 12px;font-size:15px;color:#4A4A47;line-height:1.8;">${line}</p>`)
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#FAF9F6;font-family:'Georgia',serif;">
  <div style="max-width:560px;margin:40px auto;background:#FAF9F6;border:0.5px solid rgba(42,42,40,0.15);">
    
    <div style="background:#2A2A28;padding:32px 40px;">
      <p style="margin:0;font-size:22px;font-weight:300;color:#FAF9F6;letter-spacing:0.04em;">
        Korrin&apos;s Photos<span style="color:#6B7845;">.</span>
      </p>
    </div>

    <div style="padding:40px;">
      <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#6B7845;">
        Message from Korrin
      </p>
      <h1 style="margin:0 0 24px;font-size:26px;font-weight:300;color:#2A2A28;line-height:1.2;">
        Hi ${name},
      </h1>

      ${messageHtml}

      <div style="margin-top:32px;padding-top:24px;border-top:0.5px solid rgba(42,42,40,0.12);">
        <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:#8A8A85;">
          Ready to book?
        </p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/booking"
           style="display:inline-block;margin-top:8px;padding:12px 28px;background:#6B7845;color:#FAF9F6;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;text-decoration:none;font-family:sans-serif;">
          View Booking Page
        </a>
      </div>
    </div>

    <div style="padding:24px 40px;border-top:0.5px solid rgba(42,42,40,0.12);">
      <p style="margin:0;font-size:12px;color:#8A8A85;line-height:1.6;">
        You received this because you submitted a booking inquiry on Korrin&apos;s Photos.<br><br>
        © ${new Date().getFullYear()} Korrin&apos;s Photos. All rights reserved.
      </p>
    </div>

  </div>
</body>
</html>
  `.trim();
}