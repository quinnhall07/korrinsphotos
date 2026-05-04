"use server";

// app/booking/actions.ts
// Server Action: validates booking form and writes to Firestore.

import { adminDb }    from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { z }          from "zod";

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
    await adminDb.collection("bookingInquiries").add({
      firstName,
      lastName,
      email,
      sessionType,
      preferredDate: preferredDate ? new Date(preferredDate) : null,
      message,
      status:    "PENDING",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (err) {
    console.error("Booking submission error:", err);
    return { success: false, error: "Unable to submit your inquiry right now. Please try again." };
  }
}