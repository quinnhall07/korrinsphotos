import type { Timestamp } from "firebase-admin/firestore";

export type InvoiceType = "DEPOSIT" | "BALANCE" | "FULL";
export type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "VOID";
export type DisputeStatus = "NONE" | "NEEDS_RESPONSE" | "UNDER_REVIEW" | "WON" | "LOST";

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
  disputeStatus?: DisputeStatus;
  refundCents?: number;
  refundReason?: string;
}
