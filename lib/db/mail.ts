import { adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

export const mailCol = () => adminDb.collection("mail");

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  await mailCol().add({
    to,
    message: { subject, html },
    createdAt: Timestamp.now(),
  });
}
