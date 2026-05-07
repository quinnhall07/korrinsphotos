import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

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

export async function createContract(
  data: Omit<ContractDoc, "id" | "createdAt" | "status" | "sentAt" | "signedAt" | "signerIp" | "signerUserAgent">
): Promise<ContractDoc> {
  const ref = contractsCol().doc();
  const now = Timestamp.now();
  const fullData: ContractDoc = {
    ...data,
    id: ref.id,
    status: "DRAFT",
    createdAt: now,
  };
  await ref.set(fullData);
  return fullData;
}

export async function getContract(id: string): Promise<ContractDoc | null> {
  const snap = await contractsCol().doc(id).get();
  return snap.exists ? (snap.data() as ContractDoc) : null;
}

export async function updateContract(id: string, updates: Partial<Omit<ContractDoc, "id" | "createdAt" | "projectId" | "clientId">>): Promise<void> {
  await contractsCol().doc(id).update(updates);
}

export async function getContractsForProject(projectId: string): Promise<ContractDoc[]> {
  const snap = await contractsCol().where("projectId", "==", projectId).get();
  return snap.docs.map(doc => doc.data() as ContractDoc);
}
