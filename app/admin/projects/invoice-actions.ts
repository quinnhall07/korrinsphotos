"use server";

import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { createPaymentLinkForInvoice } from "@/lib/stripe";
import { FieldValue } from "firebase-admin/firestore";
import type { InvoiceDoc } from "@/lib/db/invoices";

export async function sendInvoice(invoiceId: string) {
  await requireAdmin();

  const invoiceRef = adminDb.collection("invoices").doc(invoiceId);
  const doc = await invoiceRef.get();
  if (!doc.exists) throw new Error("Invoice not found");

  const invoice = doc.data() as InvoiceDoc;
  
  if (invoice.status !== "DRAFT") {
    throw new Error("Only draft invoices can be sent.");
  }

  const projectSnap = await adminDb.collection("projects").doc(invoice.projectId).get();
  const clientSnap = await adminDb.collection("clients").doc(invoice.clientId).get();

  const projectTitle = projectSnap.data()?.title || "Photography Session";
  const clientEmail = clientSnap.data()?.email;

  if (!clientEmail) throw new Error("Client has no email.");

  // Generate Stripe Payment Link
  const stripeData = await createPaymentLinkForInvoice(
    invoiceId,
    invoice.amountCents,
    `${projectTitle} - ${invoice.type} Invoice`,
    clientEmail
  );

  // Update invoice
  await invoiceRef.update({
    status: "SENT",
    sentAt: FieldValue.serverTimestamp(),
    stripePaymentLinkId: stripeData.paymentLinkId,
    stripePaymentLinkUrl: stripeData.url,
  });

  // Trigger email to client
  await adminDb.collection("mail").add({
    to: clientEmail,
    message: {
      subject: `Your invoice for ${projectTitle} is ready`,
      html: `<p>Hi there,</p>
             <p>Your ${invoice.type.toLowerCase()} invoice for $${(invoice.amountCents / 100).toFixed(2)} is ready.</p>
             <p><a href="${stripeData.url}">Click here to pay securely via Stripe</a></p>
             <p>Thank you,<br/>Korrin's Photography</p>`
    }
  });

  revalidatePath(`/admin/projects/${invoice.projectId}`);
  return { success: true };
}
