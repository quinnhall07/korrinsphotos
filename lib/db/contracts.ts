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
  // Phase 1.7 — token-gated public signing
  // The token is generated when an admin sends the contract; the public
  // /sign-contract/[id]?t=<token> route validates the token + expiry before
  // exposing any content. Token is single-use only via the SIGNED status
  // gate (a contract cannot be signed twice).
  signingToken?: string | null;
  tokenExpiresAt?: Timestamp | null;
  signerName?: string | null;
  signerSignatureDataUrl?: string | null;
  // R2 key for the completion-certificate file (HTML in v1; PDF in a future
  // follow-up once puppeteer-core + @sparticuz/chromium are wired up).
  signedPdfR2Key?: string | null;
  // Legacy field: pre-Phase-1.7 typed signature lived here. Kept optional
  // so historical records still render in the admin UI.
  signedTypedName?: string | null;
}

export const contractsCol = () => adminDb.collection("contracts");

export async function getContract(id: string): Promise<ContractDoc | null> {
  const snap = await contractsCol().doc(id).get();
  return snap.exists
    ? ({ id: snap.id, ...(snap.data() as Omit<ContractDoc, "id">) } as ContractDoc)
    : null;
}
