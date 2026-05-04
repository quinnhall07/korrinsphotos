"use server";

// app/booking/actions.ts
// Server Action: validatees the booking form submission and writes to the DB.
// Returns a typed result object — no redirect, so the client can show a
// success state inline rather than navigating away.

import { prisma } from "@/lib/prisma";
import { z } from "zod";

const BookingSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Please enter a valid email address"),
  sessionType: z.enum(
    ["Wedding", "Portrait", "Editorial", "Family", "Engagement"],
    { errorMap: () => ({ message: "Please select a session type" }) }
  ),
  preferredDate: z.string().optional(),
  message: z.string().min(10, "Please tell me a bit more about your vision").max(5000),
});

type BookingResult =
  | { success: true }
  | { success: false; error: string };

export async function submitBooking(formData: FormData): Promise<BookingResult> {
  const raw = {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    sessionType: formData.get("sessionType"),
    preferredDate: formData.get("preferredDate"),
    message: formData.get("message"),
  };

  const parsed = BookingSchema.safeParse(raw);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]?.message ?? "Invalid form data";
    return { success: false, error: firstError };
  }

  const { firstName, lastName, email, sessionType, preferredDate, message } =
    parsed.data;

  try {
    await prisma.bookingInquiry.create({
      data: {
        firstName,
        lastName,
        email,
        sessionType,
        preferredDate: preferredDate ? new Date(preferredDate) : null,
        message,
        status: "PENDING",
      },
    });

    // Optional: send a notification email to the admin via Resend
    // Uncomment when RESEND_API_KEY is configured:
    //
    // const { Resend } = await import("resend");
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // await resend.emails.send({
    //   from: process.env.RESEND_FROM_EMAIL!,
    //   to: process.env.ADMIN_EMAIL!,
    //   subject: `New booking inquiry from ${firstName} ${lastName}`,
    //   text: `${firstName} ${lastName} (${email}) has submitted a ${sessionType} inquiry.\n\n${message}`,
    // });

    return { success: true };
  } catch (err) {
    console.error("Booking submission error:", err);
    return {
      success: false,
      error: "Unable to submit your inquiry right now. Please try again.",
    };
  }
}