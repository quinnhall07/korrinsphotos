"use server";

// app/admin/bookings/actions.ts
// Server Action to update a booking inquiry's status.

import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/session";
import { FieldValue } from "firebase-admin/firestore";

type Status = "PENDING" | "REVIEWED" | "BOOKED" | "ARCHIVED";

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