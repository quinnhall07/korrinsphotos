// lib/domain/ledger.ts
//
// Refund + chargeback ledger plumbing (Phase 3.12).
//
// Cross-collection: writes to `invoices/{id}`, queries `paymentIntents/{piId}`
// for invoice correlation when Stripe only hands us a Charge / Dispute, and
// surfaces ledger events to the admin `inboxItems` collection. Server-only.

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { DisputeStatus, InvoiceDoc } from "@/lib/db/invoices";
import { createInboxItem } from "@/lib/db/inbox";

// Stripe dispute.status strings → our normalized enum.
export function normalizeStripeDisputeStatus(value: unknown): DisputeStatus {
  if (typeof value !== "string") return "NEEDS_RESPONSE";
  switch (value) {
    case "warning_needs_response":
      return "WARNING_NEEDS_RESPONSE";
    case "warning_under_review":
      return "WARNING_UNDER_REVIEW";
    case "warning_closed":
      return "WARNING_CLOSED";
    case "needs_response":
      return "NEEDS_RESPONSE";
    case "under_review":
      return "UNDER_REVIEW";
    case "charge_refunded":
      return "CHARGE_REFUNDED";
    case "won":
      return "WON";
    case "lost":
      return "LOST";
    default:
      return "NEEDS_RESPONSE";
  }
}

// Best-effort: look up an `invoiceId` from a Stripe paymentIntent id by
// reading the mirror doc at `paymentIntents/{piId}`. Returns null if the
// caller already has the invoiceId via webhook metadata.
export async function lookupInvoiceIdFromPaymentIntent(
  paymentIntentId: string | null | undefined
): Promise<string | null> {
  if (!paymentIntentId) return null;
  try {
    const snap = await adminDb.collection("paymentIntents").doc(paymentIntentId).get();
    if (!snap.exists) return null;
    const data = snap.data() as { invoiceId?: string; metadata?: { invoiceId?: string } } | undefined;
    return data?.invoiceId ?? data?.metadata?.invoiceId ?? null;
  } catch {
    return null;
  }
}

// Resolve an invoice via either an explicit invoiceId or a paymentIntentId.
// The webhook handler prefers metadata-attached ids; the manual admin path
// passes the invoiceId directly.
export async function resolveInvoiceRef(opts: {
  invoiceId?: string | null;
  paymentIntentId?: string | null;
}): Promise<{ id: string; doc: InvoiceDoc } | null> {
  let invoiceId = opts.invoiceId ?? null;
  if (!invoiceId) {
    invoiceId = await lookupInvoiceIdFromPaymentIntent(opts.paymentIntentId);
  }
  // Fall back: scan invoices for a stored stripePaymentIntentId match. This
  // covers invoices paid before we started writing the paymentIntents mirror.
  if (!invoiceId && opts.paymentIntentId) {
    try {
      const q = await adminDb
        .collection("invoices")
        .where("stripePaymentIntentId", "==", opts.paymentIntentId)
        .limit(1)
        .get();
      if (!q.empty) {
        invoiceId = q.docs[0].id;
      }
    } catch {
      // ignore — fall through to null
    }
  }
  if (!invoiceId) return null;
  const ref = await adminDb.collection("invoices").doc(invoiceId).get();
  if (!ref.exists) return null;
  return { id: ref.id, doc: ref.data() as InvoiceDoc };
}

export type RecordRefundResult =
  | { success: true; alreadyApplied: boolean }
  | { success: false; error: string };

/**
 * Apply a refund to an invoice. Idempotent on `refundCents`:
 *   - If the new `refundCents` is <= what is already on the invoice, this
 *     no-ops (the same Stripe event was replayed).
 *   - Otherwise the invoice's `refundCents` is set to the new total,
 *     `refundReason`/`refundedAt` are stamped, and the invoice is marked
 *     `VOID` iff the refund covers the full charge.
 *
 * Does NOT advance project status — Korrin handles credit / cancellation
 * by hand from the admin UI.
 */
export async function recordRefund(
  invoiceId: string,
  refundCents: number,
  reason: string
): Promise<RecordRefundResult> {
  if (!invoiceId) return { success: false, error: "Missing invoiceId" };
  if (!Number.isFinite(refundCents) || refundCents < 0) {
    return { success: false, error: "refundCents must be a non-negative integer" };
  }

  const ref = adminDb.collection("invoices").doc(invoiceId);
  const snap = await ref.get();
  if (!snap.exists) return { success: false, error: "Invoice not found" };
  const invoice = snap.data() as InvoiceDoc;

  const currentRefund = invoice.refundCents ?? 0;
  if (refundCents <= currentRefund) {
    // Idempotent: replayed event or admin clicked twice.
    return { success: true, alreadyApplied: true };
  }

  const fullyRefunded = refundCents >= (invoice.amountCents ?? 0);
  const patch: Record<string, unknown> = {
    refundCents,
    refundReason: reason || "unspecified",
    refundedAt: FieldValue.serverTimestamp(),
  };
  if (fullyRefunded && invoice.status !== "VOID") {
    patch.status = "VOID";
  }
  await ref.update(patch);

  // Surface to admin inbox (best-effort).
  const amountDollars = (refundCents / 100).toFixed(2);
  await createInboxItem({
    type: "PAYMENT_REFUNDED",
    projectId: invoice.projectId ?? null,
    clientId: invoice.clientId ?? null,
    title: `Refund issued — $${amountDollars} (${invoice.type})`,
    body: `Invoice ${invoiceId} refunded${reason ? ` (${reason})` : ""}.${
      fullyRefunded ? " Marked VOID." : ""
    }`,
    link: invoice.projectId ? `/admin/projects/${invoice.projectId}` : null,
    read: false,
  }).catch(() => {});

  return { success: true, alreadyApplied: false };
}

/**
 * Stamp a newly-opened dispute onto its invoice. Idempotent on
 * `disputeOpenedAt` — if a dispute is already recorded, this no-ops.
 */
export async function recordDisputeCreated(
  invoiceId: string,
  args: {
    status: DisputeStatus;
    reason: string;
    amountCents: number;
  }
): Promise<{ success: boolean; alreadyApplied?: boolean; error?: string }> {
  const ref = adminDb.collection("invoices").doc(invoiceId);
  const snap = await ref.get();
  if (!snap.exists) return { success: false, error: "Invoice not found" };
  const invoice = snap.data() as InvoiceDoc;

  if (invoice.disputeOpenedAt) {
    return { success: true, alreadyApplied: true };
  }

  await ref.update({
    disputeStatus: args.status,
    disputeReason: args.reason || "unspecified",
    disputeAmountCents: Math.max(0, Math.floor(args.amountCents)),
    disputeOpenedAt: FieldValue.serverTimestamp(),
  });

  const amountDollars = (args.amountCents / 100).toFixed(2);
  await createInboxItem({
    type: "PAYMENT_DISPUTE_CREATED",
    projectId: invoice.projectId ?? null,
    clientId: invoice.clientId ?? null,
    title: `DISPUTE OPENED — $${amountDollars} (${invoice.type})`,
    body: `Stripe dispute on invoice ${invoiceId}: ${args.reason}. Status: ${args.status}.`,
    link: invoice.projectId ? `/admin/projects/${invoice.projectId}` : null,
    read: false,
  }).catch(() => {});

  return { success: true };
}

/**
 * Update only the dispute status (used for `charge.dispute.updated`).
 */
export async function recordDisputeUpdated(
  invoiceId: string,
  status: DisputeStatus
): Promise<{ success: boolean; error?: string }> {
  const ref = adminDb.collection("invoices").doc(invoiceId);
  const snap = await ref.get();
  if (!snap.exists) return { success: false, error: "Invoice not found" };
  const current = (snap.data() as InvoiceDoc).disputeStatus;
  if (current === status) {
    return { success: true };
  }
  await ref.update({ disputeStatus: status });
  return { success: true };
}

/**
 * Close out a dispute. If lost, the dispute amount is also recorded as a
 * refund (`reason: "dispute_lost"`) so the ledger stays balanced.
 * Idempotent on `disputeClosedAt`.
 */
export async function recordDisputeClosed(
  invoiceId: string,
  status: DisputeStatus
): Promise<{ success: boolean; alreadyApplied?: boolean; error?: string }> {
  const ref = adminDb.collection("invoices").doc(invoiceId);
  const snap = await ref.get();
  if (!snap.exists) return { success: false, error: "Invoice not found" };
  const invoice = snap.data() as InvoiceDoc;

  if (invoice.disputeClosedAt) {
    return { success: true, alreadyApplied: true };
  }

  await ref.update({
    disputeStatus: status,
    disputeClosedAt: FieldValue.serverTimestamp(),
  });

  // If we lost, treat the disputed amount as a refund. recordRefund is
  // itself idempotent, so re-runs are safe.
  if (status === "LOST" && invoice.disputeAmountCents && invoice.disputeAmountCents > 0) {
    await recordRefund(invoiceId, invoice.disputeAmountCents, "dispute_lost").catch(() => {});
  }

  await createInboxItem({
    type: "PAYMENT_DISPUTE_CLOSED",
    projectId: invoice.projectId ?? null,
    clientId: invoice.clientId ?? null,
    title: `Dispute closed (${status}) — invoice ${invoice.type}`,
    body: `Stripe dispute on invoice ${invoiceId} closed. Outcome: ${status}.`,
    link: invoice.projectId ? `/admin/projects/${invoice.projectId}` : null,
    read: false,
  }).catch(() => {});

  return { success: true };
}

// Helper to keep callers compiling against a Timestamp-typed surface.
export const __nowForTest = (): Timestamp => Timestamp.now();
