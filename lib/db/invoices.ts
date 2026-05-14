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
  salesTaxCents?: number;
  salesTaxRate?: number;
  salesTaxJurisdiction?: string;

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
