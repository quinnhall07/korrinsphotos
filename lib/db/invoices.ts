import { adminDb } from "@/lib/firebase-admin";
import type { Timestamp } from "firebase-admin/firestore";

export type InvoiceType = "DEPOSIT" | "BALANCE" | "FULL";
export type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "VOID";

// Mirrors Stripe's `charge.dispute.status` enum plus a "NONE" sentinel for
// invoices that have never been disputed. Stripe's values:
// warning_needs_response | warning_under_review | warning_closed |
// needs_response | under_review | charge_refunded | won | lost
export type DisputeStatus =
  | "NONE"
  | "WARNING_NEEDS_RESPONSE"
  | "WARNING_UNDER_REVIEW"
  | "WARNING_CLOSED"
  | "NEEDS_RESPONSE"
  | "UNDER_REVIEW"
  | "CHARGE_REFUNDED"
  | "WON"
  | "LOST";

export interface InvoiceDoc {
  id: string;
  projectId: string;
  clientId: string;
  type: InvoiceType;
  status: InvoiceStatus;
  amountCents: number;
  dueDate: Timestamp;
  paidAt?: Timestamp | null;
  stripePaymentIntentId?: string | null;
  stripePaymentLinkId?: string | null;
  stripePaymentLinkUrl?: string | null;
  sentAt?: Timestamp | null;
  createdAt: Timestamp;
  // Legacy sales-tax fields (Phase pre-3.11). Kept for backwards-compatibility
  // with any invoice docs created before Phase 3.11. New writes use
  // `subtotalCents` + `taxCents` + `taxStateCode` + `taxRatePct` below.
  salesTaxCents?: number;
  salesTaxRate?: number;
  salesTaxJurisdiction?: string;

  /**
   * Phase 3.11 — sales tax engine.
   *
   * `amountCents` is always the **gross** (subtotal + tax) so the existing
   * Stripe Payment Link flow keeps working unchanged. The fields below carry
   * the breakdown so the invoice email + admin tax report can show it.
   *
   * For invoices written before this change, treat `subtotalCents` as
   * `amountCents` and `taxCents` as 0 (see helpers in `lib/db/invoices.ts`).
   */
  subtotalCents?: number;
  taxCents?: number;
  taxStateCode?: string;
  taxRatePct?: number;

  // Refund ledger (Phase 3.12)
  refundCents?: number;
  refundReason?: string;
  refundedAt?: Timestamp | null;

  // Dispute / chargeback ledger (Phase 3.12)
  disputeStatus?: DisputeStatus;
  disputeReason?: string;
  disputeAmountCents?: number;
  disputeOpenedAt?: Timestamp | null;
  disputeClosedAt?: Timestamp | null;
}

export const invoicesCol = () => adminDb.collection("invoices");

/**
 * Phase 3.11 — normalise an invoice's subtotal/tax breakdown for callers
 * that need to display or aggregate it. Handles three flavours of data:
 *
 *   1. New Phase 3.11 invoices — `subtotalCents` + `taxCents` set explicitly.
 *   2. Legacy invoices with the old `salesTaxCents` field set.
 *   3. Pre-tax invoices with neither field — `subtotal = amountCents`, `tax = 0`.
 */
export function readInvoiceTaxBreakdown(invoice: InvoiceDoc): {
  subtotalCents: number;
  taxCents: number;
  taxStateCode: string | null;
  taxRatePct: number | null;
} {
  const amount = Number(invoice.amountCents) || 0;

  if (typeof invoice.subtotalCents === "number") {
    return {
      subtotalCents: invoice.subtotalCents,
      taxCents: typeof invoice.taxCents === "number" ? invoice.taxCents : 0,
      taxStateCode: invoice.taxStateCode ?? null,
      taxRatePct: typeof invoice.taxRatePct === "number" ? invoice.taxRatePct : null,
    };
  }

  if (typeof invoice.salesTaxCents === "number" && invoice.salesTaxCents > 0) {
    return {
      subtotalCents: Math.max(0, amount - invoice.salesTaxCents),
      taxCents: invoice.salesTaxCents,
      taxStateCode: invoice.salesTaxJurisdiction ?? null,
      taxRatePct: typeof invoice.salesTaxRate === "number" ? invoice.salesTaxRate : null,
    };
  }

  return { subtotalCents: amount, taxCents: 0, taxStateCode: null, taxRatePct: null };
}
