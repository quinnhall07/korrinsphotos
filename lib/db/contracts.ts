import { adminDb } from "@/lib/firebase-admin";
import type { Timestamp } from "firebase-admin/firestore";

export type ContractStatus = "DRAFT" | "SENT" | "SIGNED" | "VOIDED";

export interface ContractDoc {
  id: string;
  projectId: string;
  clientId: string;
  status: ContractStatus;
  templateId: string;
  renderedHtml: string;
  signerIp?: string | null;
  signerUserAgent?: string | null;
  sentAt?: Timestamp | null;
  signedAt?: Timestamp | null;
  createdAt: Timestamp;
}

export const contractsCol = () => adminDb.collection("contracts");

export async function getContract(id: string): Promise<ContractDoc | null> {
  const snap = await contractsCol().doc(id).get();
  return snap.exists ? (snap.data() as ContractDoc) : null;
}
