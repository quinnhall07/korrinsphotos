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
  getProduct,
  incrementPurchaseCount,
  markPurchaseDelivered,
  recordProductPurchase,
} from "@/lib/db/products";
import { generatePresignedGetUrl } from "@/lib/storage/r2";
import { enqueueTrackedMail } from "@/lib/email/tracking";
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
      const productId: string | undefined = session.metadata?.productId;

      if (invoiceId) {
        await processInvoicePayment(invoiceId, session.payment_intent);
      } else if (productId) {
        // Phase 4.13 — Digital products store. Wrapped so a delivery failure
        // can't crash the webhook (Stripe retries flood the inbox otherwise).
        await processProductPurchase(productId, session).catch((err) => {
          console.error("[stripe] product purchase delivery failed", {
            productId,
            sessionId: session?.id,
            err,
          });
        });
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

// ─── Digital products store (Phase 4.13) ─────────────────────────────────────

const PRODUCT_DOWNLOAD_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

async function processProductPurchase(
  productId: string,
  session: any
): Promise<void> {
  const product = await getProduct(productId);
  if (!product) {
    console.warn("[stripe] product purchase: product not found", {
      productId,
      sessionId: session?.id,
    });
    return;
  }

  const sessionId: string = typeof session?.id === "string" ? session.id : "";
  if (!sessionId) {
    console.warn("[stripe] product purchase: missing session id", { productId });
    return;
  }

  const buyerEmail: string =
    session?.customer_details?.email ||
    session?.customer_email ||
    "";
  if (!buyerEmail) {
    console.warn("[stripe] product purchase: no buyer email on session", {
      sessionId,
      productId,
    });
    return;
  }

  const buyerName: string | undefined =
    typeof session?.customer_details?.name === "string"
      ? session.customer_details.name
      : undefined;

  const amountCents: number =
    typeof session?.amount_total === "number"
      ? session.amount_total
      : product.priceCents;

  // 1. Idempotently record the purchase. `recordProductPurchase` short-circuits
  //    if a row already exists for this session id.
  const purchase = await recordProductPurchase({
    productId: product.id,
    productSlug: product.slug,
    buyerEmail,
    buyerName,
    amountCents,
    stripeCheckoutSessionId: sessionId,
    deliveryR2Key: product.fileR2Key,
  });

  // If we've already delivered this purchase, stop here.
  if (purchase.deliveredAt) return;

  // 2. Mint a 7-day presigned GET URL for the deliverable.
  const downloadUrl = await generatePresignedGetUrl(
    product.fileR2Key,
    PRODUCT_DOWNLOAD_TTL_SECONDS
  );

  // 3. Email the buyer through the tracked-mail wrapper.
  const greeting = buyerName ? `Hi ${buyerName.split(" ")[0]},` : "Hi there,";
  const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #2A2A28; max-width: 560px; margin: 0 auto; padding: 24px;">
      <p style="font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #6B7845; margin: 0 0 16px;">Korrin's Photography</p>
      <h1 style="font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 300; font-size: 28px; line-height: 1.2; margin: 0 0 16px; color: #2A2A28;">${greeting}</h1>
      <p style="font-size: 15px; line-height: 1.7; color: #4A4A47; margin: 0 0 16px;">Thank you for your purchase of <strong>${product.title}</strong>.</p>
      <p style="font-size: 15px; line-height: 1.7; color: #4A4A47; margin: 0 0 24px;">Your private download link is below. It will work for the next 7 days — please save the file somewhere safe.</p>
      <p style="margin: 0 0 32px;">
        <a href="${downloadUrl}" style="display: inline-block; padding: 14px 28px; background: #2A2A28; color: #FAF9F6; text-decoration: none; font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase;">Download your file</a>
      </p>
      <p style="font-size: 13px; line-height: 1.6; color: #8A8A85; margin: 0 0 8px;">If the button doesn't work, copy this URL into your browser:</p>
      <p style="font-size: 12px; word-break: break-all; color: #6B7845; margin: 0 0 24px;">${downloadUrl}</p>
      <p style="font-size: 13px; line-height: 1.6; color: #8A8A85; margin: 0;">If you have any trouble, just reply to this email and I'll sort it out.</p>
    </div>
  `;

  await enqueueTrackedMail({
    to: buyerEmail,
    subject: `Your download — ${product.title}`,
    html,
    sendKind: "product-delivery",
  }).catch((err) => {
    console.error("[stripe] product delivery email enqueue failed", {
      productId,
      sessionId,
      err,
    });
  });

  // 4. Mark the purchase delivered + bump the catalog counter.
  await markPurchaseDelivered(purchase.id).catch((err) => {
    console.error("[stripe] markPurchaseDelivered failed", {
      purchaseId: purchase.id,
      err,
    });
  });
  await incrementPurchaseCount(product.id).catch((err) => {
    console.error("[stripe] incrementPurchaseCount failed", {
      productId: product.id,
      err,
    });
  });

  await logActivity(
    "EMAIL_SENT",
    `Digital product delivered: ${product.title}`,
    { productId: product.id, sessionId, buyerEmail }
  ).catch(() => {});
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
