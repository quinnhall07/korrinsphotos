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

  const projectRef = adminDb.collection("projects").doc(invoice.projectId);
  const clientRef = adminDb.collection("clients").doc(invoice.clientId);
  const [projectSnap, clientSnap] = await Promise.all([projectRef.get(), clientRef.get()]);

  const projectData = projectSnap.data() || {};
  const clientData = clientSnap.data() || {};

  const projectTitle = projectData.title || "Photography Session";
  const clientEmail = clientData.email;

  if (!clientEmail) throw new Error("Client has no email.");

  // ── Tiered referral credit (Phase 4.4) ────────────────────────────────────
  //
  // Apply at most one referral discount per project. Idempotency is enforced
  // by `projects/{id}.discountApplied` — if it is already a positive number,
  // the credit was already redeemed on a previous invoice send and we leave
  // the new invoice untouched. The client doc's `referralCredit` is stored
  // in **cents** (matches `InvoiceDoc.amountCents`).
  let finalAmountCents = invoice.amountCents;
  let appliedDiscountCents = 0;

  const projectAlreadyDiscounted =
    typeof projectData.discountApplied === "number" && projectData.discountApplied > 0;
  const availableCreditCents =
    typeof clientData.referralCredit === "number" && clientData.referralCredit > 0
      ? clientData.referralCredit
      : 0;

  if (!projectAlreadyDiscounted && availableCreditCents > 0) {
    appliedDiscountCents = Math.min(availableCreditCents, invoice.amountCents);
    finalAmountCents = Math.max(0, invoice.amountCents - appliedDiscountCents);

    // Atomically decrement the client's credit balance and stamp the project.
    await Promise.all([
      clientRef.update({
        referralCredit: FieldValue.increment(-appliedDiscountCents),
        updatedAt: FieldValue.serverTimestamp(),
      }),
      projectRef.update({
        discountApplied: appliedDiscountCents,
        updatedAt: FieldValue.serverTimestamp(),
      }),
    ]);
  }

  // Generate Stripe Payment Link against the (possibly discounted) amount.
  const stripeData = await createPaymentLinkForInvoice(
    invoiceId,
    finalAmountCents,
    `${projectTitle} - ${invoice.type} Invoice`,
    clientEmail
  );

  // Update invoice — persist the discount on the invoice itself so audit/
  // refund flows can see the original vs. final amount.
  const invoiceUpdate: Record<string, unknown> = {
    status: "SENT",
    sentAt: FieldValue.serverTimestamp(),
    stripePaymentLinkId: stripeData.paymentLinkId,
    stripePaymentLinkUrl: stripeData.url,
    amountCents: finalAmountCents,
  };
  if (appliedDiscountCents > 0) {
    invoiceUpdate.referralCreditAppliedCents = appliedDiscountCents;
  }
  await invoiceRef.update(invoiceUpdate);

  const creditLine =
    appliedDiscountCents > 0
      ? `<p>A referral credit of $${(appliedDiscountCents / 100).toFixed(2)} was applied — thank you for sharing Korrin's work.</p>`
      : "";

  // Trigger email to client
  await adminDb.collection("mail").add({
    to: clientEmail,
    message: {
      subject: `Your invoice for ${projectTitle} is ready`,
      html: `<p>Hi there,</p>
             <p>Your ${invoice.type.toLowerCase()} invoice for $${(finalAmountCents / 100).toFixed(2)} is ready.</p>
             ${creditLine}
             <p><a href="${stripeData.url}">Click here to pay securely via Stripe</a></p>
             <p>Thank you,<br/>Korrin's Photography</p>`
    }
  });

  revalidatePath(`/admin/projects/${invoice.projectId}`);
  return { success: true };
}

/**
 * Manually mark an invoice paid (cash, bank transfer, etc.) without going
 * through Stripe. Does NOT advance project status — the Stripe webhook is
 * the canonical writer for the deposit→booked and editing→delivered moves.
 * Admins who need to advance the project after a manual payment should use
 * the Advance Status modal afterwards.
 */
export async function markInvoicePaidManually(
  invoiceId: string,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  if (!invoiceId) return { success: false, error: "Missing invoice id." };

  try {
    const invoiceRef = adminDb.collection("invoices").doc(invoiceId);
    const snap = await invoiceRef.get();
    if (!snap.exists) return { success: false, error: "Invoice not found." };

    const invoice = snap.data() as InvoiceDoc;
    if (invoice.status === "PAID") {
      return { success: true };
    }
    if (invoice.status === "VOID") {
      return { success: false, error: "Cannot mark a voided invoice paid." };
    }

    await invoiceRef.update({
      status: "PAID",
      paidAt: FieldValue.serverTimestamp(),
    });

    revalidatePath(`/admin/projects/${invoice.projectId}`);
    return { success: true };
  } catch (err) {
    console.error("markInvoicePaidManually error:", err);
    return { success: false, error: "Failed to mark invoice paid." };
  }
}
