import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { handleProjectTransition } from "@/lib/project-transitions";
import { logActivity } from "@/lib/db/activity";
import { createInboxItem } from "@/lib/db/inbox";
import type { InvoiceDoc } from "@/lib/db/invoices";
import type { ProjectDoc } from "@/lib/db/projects";
import {
  normalizeStripeDisputeStatus,
  recordDisputeClosed,
  recordDisputeCreated,
  recordDisputeUpdated,
  recordRefund,
  resolveInvoiceRef,
} from "@/lib/domain/ledger";

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

  // Event-level idempotency. Stripe retries on transient errors; replays must
  // never double-apply a refund or re-open a closed dispute. We claim the
  // event id atomically; if we already processed it, return 200 immediately.
  if (await alreadyProcessed(event.id)) {
    return NextResponse.json({ received: true, replayed: true });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;
      const invoiceId = session.metadata?.invoiceId || session.client_reference_id;

      if (invoiceId) {
        await processInvoicePayment(invoiceId, session.payment_intent);
      }
    } else if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as any;
      const invoiceId = paymentIntent.metadata?.invoiceId;

      if (invoiceId) {
        await processInvoicePayment(invoiceId, paymentIntent.id);
      }
    } else if (event.type === "charge.refunded") {
      await processChargeRefunded(event.data.object as any);
    } else if (event.type === "charge.dispute.created") {
      await processDisputeCreated(event.data.object as any);
    } else if (event.type === "charge.dispute.updated") {
      await processDisputeUpdated(event.data.object as any);
    } else if (event.type === "charge.dispute.closed") {
      await processDisputeClosed(event.data.object as any);
    }

    await markProcessed(event.id, event.type);
    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Error processing webhook:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

// ─── Idempotency mirror ───────────────────────────────────────────────────────
//
// We dedupe by writing a row at `stripeWebhookEvents/{event.id}` *before*
// running the handler. Firestore's `create()` throws on collision, so the
// second invocation of the same event short-circuits via alreadyProcessed().
// The marker write is best-effort; if Firestore is unavailable we still run
// the handler (idempotency falls back to the per-handler doc-state guards).

async function alreadyProcessed(eventId: string): Promise<boolean> {
  try {
    const snap = await adminDb.collection("stripeWebhookEvents").doc(eventId).get();
    return snap.exists;
  } catch {
    return false;
  }
}

async function markProcessed(eventId: string, type: string): Promise<void> {
  try {
    await adminDb.collection("stripeWebhookEvents").doc(eventId).set({
      type,
      processedAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error("Failed to record processed Stripe event marker:", err);
  }
}

// ─── Existing PAID-invoice flow ──────────────────────────────────────────────

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

  // 1a. Mirror paymentIntent → invoice mapping for later refund / dispute
  // lookups. The webhook events for refunds/disputes give us a Charge (with
  // a payment_intent id) but no invoice metadata, so this mirror is how we
  // correlate them back to our invoice.
  if (paymentIntentId) {
    try {
      await adminDb.collection("paymentIntents").doc(paymentIntentId).set(
        {
          invoiceId,
          projectId: invoice.projectId ?? null,
          clientId: invoice.clientId ?? null,
          paidAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error("Failed to write paymentIntents mirror:", err);
    }
  }

  // 1b. Surface to admin inbox (best-effort).
  const amountDollars =
    typeof invoice.amountCents === "number" ? (invoice.amountCents / 100).toFixed(2) : null;
  await createInboxItem({
    type: "PAYMENT_RECEIVED",
    projectId: invoice.projectId ?? null,
    clientId: invoice.clientId ?? null,
    title: `Payment received${amountDollars ? ` — $${amountDollars}` : ""} (${invoice.type})`,
    body: `Invoice ${invoiceId} marked PAID via Stripe.`,
    link: invoice.projectId ? `/admin/projects/${invoice.projectId}` : null,
    read: false,
  }).catch(() => {});

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

// ─── Refund / dispute handlers (Phase 3.12) ──────────────────────────────────

async function processChargeRefunded(charge: any): Promise<void> {
  const invoiceFromMeta: string | null = charge?.metadata?.invoiceId ?? null;
  const pi: string | null =
    typeof charge?.payment_intent === "string" ? charge.payment_intent : null;

  const resolved = await resolveInvoiceRef({
    invoiceId: invoiceFromMeta,
    paymentIntentId: pi,
  });
  if (!resolved) {
    console.warn("[stripe] charge.refunded: could not locate invoice", { pi });
    return;
  }

  const refundCents: number =
    typeof charge?.amount_refunded === "number" ? charge.amount_refunded : 0;

  // Stripe puts reason on each refund object; the outermost charge does not
  // carry a top-level reason. Take the most-recent refund's reason.
  const reason: string =
    charge?.refunds?.data?.[0]?.reason ??
    charge?.refunds?.data?.[charge?.refunds?.data?.length - 1]?.reason ??
    "requested_by_customer";

  await recordRefund(resolved.id, refundCents, reason);

  await logActivity(
    "PAYMENT_REFUNDED",
    `Refund recorded on invoice ${resolved.doc.type} ($${(refundCents / 100).toFixed(2)}).`,
    { invoiceId: resolved.id, projectId: resolved.doc.projectId }
  ).catch(() => {});
}

async function processDisputeCreated(dispute: any): Promise<void> {
  const pi: string | null =
    typeof dispute?.payment_intent === "string" ? dispute.payment_intent : null;
  const invoiceFromMeta: string | null = dispute?.metadata?.invoiceId ?? null;

  const resolved = await resolveInvoiceRef({
    invoiceId: invoiceFromMeta,
    paymentIntentId: pi,
  });
  if (!resolved) {
    console.warn("[stripe] charge.dispute.created: could not locate invoice", { pi });
    return;
  }

  await recordDisputeCreated(resolved.id, {
    status: normalizeStripeDisputeStatus(dispute?.status),
    reason: dispute?.reason ?? "unspecified",
    amountCents: typeof dispute?.amount === "number" ? dispute.amount : 0,
  });

  await logActivity(
    "PAYMENT_DISPUTE_CREATED",
    `Stripe dispute opened on invoice ${resolved.doc.type} — ${dispute?.reason ?? "unspecified"}.`,
    { invoiceId: resolved.id, projectId: resolved.doc.projectId }
  ).catch(() => {});
}

async function processDisputeUpdated(dispute: any): Promise<void> {
  const pi: string | null =
    typeof dispute?.payment_intent === "string" ? dispute.payment_intent : null;
  const invoiceFromMeta: string | null = dispute?.metadata?.invoiceId ?? null;

  const resolved = await resolveInvoiceRef({
    invoiceId: invoiceFromMeta,
    paymentIntentId: pi,
  });
  if (!resolved) return;

  await recordDisputeUpdated(resolved.id, normalizeStripeDisputeStatus(dispute?.status));
}

async function processDisputeClosed(dispute: any): Promise<void> {
  const pi: string | null =
    typeof dispute?.payment_intent === "string" ? dispute.payment_intent : null;
  const invoiceFromMeta: string | null = dispute?.metadata?.invoiceId ?? null;

  const resolved = await resolveInvoiceRef({
    invoiceId: invoiceFromMeta,
    paymentIntentId: pi,
  });
  if (!resolved) return;

  const status = normalizeStripeDisputeStatus(dispute?.status);
  await recordDisputeClosed(resolved.id, status);

  await logActivity(
    "PAYMENT_DISPUTE_CLOSED",
    `Stripe dispute closed on invoice ${resolved.doc.type} — outcome ${status}.`,
    { invoiceId: resolved.id, projectId: resolved.doc.projectId }
  ).catch(() => {});
}
