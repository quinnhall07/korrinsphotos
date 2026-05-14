import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

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

export const invoicesCol = () => adminDb.collection("invoices");

export async function createInvoice(
  data: Omit<InvoiceDoc, "id" | "createdAt" | "paidAt" | "sentAt" | "stripePaymentIntentId" | "stripePaymentLinkId" | "stripePaymentLinkUrl">
): Promise<InvoiceDoc> {
  const ref = invoicesCol().doc();
  const now = Timestamp.now();
  const fullData: InvoiceDoc = {
    ...data,
    id: ref.id,
    createdAt: now,
  };
  await ref.set(fullData);
  return fullData;
}

export async function getInvoice(id: string): Promise<InvoiceDoc | null> {
  const snap = await invoicesCol().doc(id).get();
  return snap.exists ? (snap.data() as InvoiceDoc) : null;
}

export async function updateInvoice(id: string, updates: Partial<Omit<InvoiceDoc, "id" | "createdAt" | "projectId" | "clientId">>): Promise<void> {
  await invoicesCol().doc(id).update(updates);
}

export async function getInvoicesForProject(projectId: string): Promise<InvoiceDoc[]> {
  const snap = await invoicesCol().where("projectId", "==", projectId).get();
  return snap.docs.map(doc => doc.data() as InvoiceDoc);
}
