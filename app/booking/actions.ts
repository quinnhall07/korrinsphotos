"use server";

// app/booking/actions.ts
// Server Action: validates booking form and writes to Firestore.
// Also fires an auto-responder email via the Firebase "Trigger Email" extension.

import { adminDb }    from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { z }          from "zod";
import { calculateLeadScore } from "@/lib/lead-scoring";
import { logActivity } from "@/lib/firestore";

const BookingSchema = z.object({
  firstName:     z.string().min(1, "First name is required").max(100),
  lastName:      z.string().min(1, "Last name is required").max(100),
  email:         z.string().email("Please enter a valid email address"),
  sessionType:   z.enum(["Wedding", "Portrait", "Editorial", "Family", "Engagement"], {
    errorMap: () => ({ message: "Please select a session type" }),
  }),
  preferredDate: z.string().optional(),
  message:       z.string().min(10, "Please tell me a bit more about your vision").max(5000),
});

type BookingResult = { success: true } | { success: false; error: string };

export async function submitBooking(formData: FormData): Promise<BookingResult> {
  const parsed = BookingSchema.safeParse({
    firstName:     formData.get("firstName"),
    lastName:      formData.get("lastName"),
    email:         formData.get("email"),
    sessionType:   formData.get("sessionType"),
    preferredDate: formData.get("preferredDate"),
    message:       formData.get("message"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid form data" };
  }

  const { firstName, lastName, email, sessionType, preferredDate, message } = parsed.data;

  try {
    // Build initial doc data so we can compute lead score before writing
    const inquiryData = {
      firstName,
      lastName,
      email,
      sessionType,
      preferredDate: preferredDate ? new Date(preferredDate) : null,
      message,
      status:    "PENDING" as const,
      notes:     "",
      pricing:   null,
      tags:      [] as string[],
      communicationLog: [] as unknown[],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Calculate initial lead score
    const leadScore = calculateLeadScore({
      sessionType,
      message,
      preferredDate: preferredDate ?? undefined,
    });

    // Write the inquiry
    const docRef = await adminDb.collection("bookingInquiries").add({
      ...inquiryData,
      leadScore,
    });

    // Log to activity feed (best-effort)
    await logActivity(
      "LEAD_RECEIVED",
      `New ${sessionType.toLowerCase()} inquiry from ${firstName} ${lastName}`,
      { inquiryId: docRef.id, sessionType, email }
    ).catch(() => {});

    // Auto-responder: write to `mail` collection for Firebase Trigger Email extension
    await adminDb.collection("mail").add({
      to: email,
      message: {
        subject: `Thank you for your inquiry, ${firstName}!`,
        html: buildAutoResponderHtml({ firstName, sessionType }),
      },
      createdAt: FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (err) {
    console.error("Booking submission error:", err);
    return { success: false, error: "Unable to submit your inquiry right now. Please try again." };
  }
}

function buildAutoResponderHtml({
  firstName,
  sessionType,
}: {
  firstName: string;
  sessionType: string;
}): string {
  const rates: Record<string, string> = {
    Wedding:    "$2,800 – $6,500 depending on coverage hours and add-ons.",
    Portrait:   "$350 – $750 for a standard 1–2 hour session.",
    Editorial:  "$500 – $2,000 depending on scope and usage.",
    Family:     "$300 – $600 for an outdoor or in-home session.",
    Engagement: "$450 – $850 for a 1.5-hour golden-hour session.",
  };

  const rate = rates[sessionType] ?? "Rates vary by session type — we'll cover details in our call.";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thank you for your inquiry</title>
</head>
<body style="margin:0;padding:0;background:#FAF9F6;font-family:'Georgia',serif;">
  <div style="max-width:560px;margin:40px auto;background:#FAF9F6;border:0.5px solid rgba(42,42,40,0.15);">
    
    <!-- Header -->
    <div style="background:#2A2A28;padding:32px 40px;">
      <p style="margin:0;font-size:22px;font-weight:300;color:#FAF9F6;letter-spacing:0.04em;">
        Korrin&apos;s Photos<span style="color:#6B7845;">.</span>
      </p>
    </div>

    <!-- Body -->
    <div style="padding:40px;">
      <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#6B7845;">
        Booking Inquiry Received
      </p>
      <h1 style="margin:0 0 24px;font-size:28px;font-weight:300;color:#2A2A28;line-height:1.2;">
        Thank you, ${firstName}
      </h1>

      <p style="margin:0 0 20px;font-size:15px;color:#4A4A47;line-height:1.8;">
        I've received your ${sessionType.toLowerCase()} inquiry and I'm genuinely excited to learn more about your vision. I'll be in touch within <strong>48 hours</strong> to discuss availability and next steps.
      </p>

      <!-- Rate callout -->
      <div style="background:#E8EBD8;border-left:2px solid #6B7845;padding:16px 20px;margin:0 0 24px;">
        <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#6B7845;">
          Typical ${sessionType} Investment
        </p>
        <p style="margin:0;font-size:15px;color:#2A2A28;line-height:1.6;">
          ${rate}
        </p>
      </div>

      <p style="margin:0 0 20px;font-size:15px;color:#4A4A47;line-height:1.8;">
        Every package is tailored to your needs — the figures above are a starting point. We'll find something that feels right for you.
      </p>

      <p style="margin:0 0 8px;font-size:15px;color:#4A4A47;line-height:1.8;">
        In the meantime, feel free to explore my portfolio for a feel of my work.
      </p>

      <a href="${process.env.NEXT_PUBLIC_APP_URL}/portfolio"
         style="display:inline-block;margin-top:12px;padding:12px 28px;background:#6B7845;color:#FAF9F6;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;text-decoration:none;font-family:sans-serif;">
        View Portfolio
      </a>
    </div>

    <!-- Footer -->
    <div style="padding:24px 40px;border-top:0.5px solid rgba(42,42,40,0.12);">
      <p style="margin:0;font-size:12px;color:#8A8A85;line-height:1.6;">
        This is an automated confirmation. Please don't reply to this email — Korrin will reach out directly from her personal address.<br><br>
        © ${new Date().getFullYear()} Korrin's Photos. All rights reserved.
      </p>
    </div>

  </div>
</body>
</html>
  `.trim();
}