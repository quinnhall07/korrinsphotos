import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { handleProjectTransition } from "@/lib/project-transitions";
import { logActivity } from "@/lib/db/activity";
import type { InvoiceDoc } from "@/lib/db/invoices";
import type { ProjectDoc } from "@/lib/db/projects";

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature or secret" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    console.error("Webhook signature verification failed.", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    // We listen for successful payments
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;
      const invoiceId = session.metadata?.invoiceId || session.client_reference_id;
      
      if (invoiceId) {
        await processInvoicePayment(invoiceId, session.payment_intent);
      }
    } else if (event.type === "payment_intent.succeeded") {
      // Depending on how we generated the payment link, metadata might be here
      const paymentIntent = event.data.object as any;
      const invoiceId = paymentIntent.metadata?.invoiceId;
      
      if (invoiceId) {
        await processInvoicePayment(invoiceId, paymentIntent.id);
      }
    }
    
    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Error processing webhook:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

async function processInvoicePayment(invoiceId: string, paymentIntentId: string) {
  const invoiceRef = adminDb.collection("invoices").doc(invoiceId);
  const doc = await invoiceRef.get();
  
  if (!doc.exists) return;
  const invoice = doc.data() as InvoiceDoc;
  
  if (invoice.status === "PAID") return; // Already processed

  // 1. Mark Invoice as PAID
  await invoiceRef.update({
    status: "PAID",
    paidAt: FieldValue.serverTimestamp(),
    stripePaymentIntentId: paymentIntentId,
  });

  // 2. Advance Project Status based on invoice type
  const projectRef = adminDb.collection("projects").doc(invoice.projectId);
  const projectDoc = await projectRef.get();
  
  if (projectDoc.exists) {
    const project = projectDoc.data() as ProjectDoc;
    const oldStatus = project.status;
    let newStatus = oldStatus;

    if (invoice.type === "DEPOSIT" && oldStatus === "DEPOSIT_PENDING") {
      newStatus = "BOOKED";
      await projectRef.update({ 
        status: newStatus,
        depositPaidAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    } else if (invoice.type === "BALANCE" && oldStatus === "IN_EDITING") {
      newStatus = "GALLERY_DELIVERED";
      await projectRef.update({ 
        status: newStatus,
        balancePaidAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    }

    if (newStatus !== oldStatus) {
      await handleProjectTransition(projectDoc.id, oldStatus, newStatus);

      // Log Activity (best-effort)
      await logActivity(
        "PAYMENT_RECEIVED",
        `Payment received for ${invoice.type} invoice. Project moved to ${newStatus}.`,
        { projectId: projectDoc.id, invoiceId }
      ).catch(() => {});
    }
  }
}
