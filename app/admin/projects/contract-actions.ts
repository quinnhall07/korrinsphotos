"use server";

import { randomBytes } from "crypto";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { generateContractForProject } from "@/lib/contract-renderer";

/**
 * Token lifetime for a public signing link. Once `tokenExpiresAt` has passed,
 * the public page renders an "expired" state and the client must request a
 * fresh link from Korrin.
 */
const SIGNING_TOKEN_TTL_DAYS = 14;

export async function createDraftContract(projectId: string) {
  await requireAdmin();
  try {
    const contractId = await generateContractForProject(projectId);
    revalidatePath(`/admin/projects/${projectId}`);
    return { success: true, contractId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function sendContract(contractId: string) {
  await requireAdmin();

  const contractRef = adminDb.collection("contracts").doc(contractId);
  const doc = await contractRef.get();
  if (!doc.exists) throw new Error("Contract not found");

  const contract = doc.data();
  if (contract?.status !== "DRAFT") throw new Error("Only draft contracts can be sent.");

  const clientSnap = await adminDb.collection("clients").doc(contract.clientId).get();
  const clientEmail = clientSnap.data()?.email;

  if (!clientEmail) throw new Error("Client has no email.");

  // Phase 1.7 — mint a single-use signing token. 16 random bytes = 32 hex
  // chars; the public route compares this constant-time against the `t`
  // query param, and refuses to render the signing UI on mismatch.
  const signingToken = randomBytes(16).toString("hex");
  const tokenExpiresAt = Timestamp.fromMillis(
    Date.now() + SIGNING_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
  );

  await contractRef.update({
    status: "SENT",
    sentAt: FieldValue.serverTimestamp(),
    signingToken,
    tokenExpiresAt,
  });

  // Trigger email to client to sign
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const signUrl = `${appUrl}/sign-contract/${contractId}?t=${signingToken}`;

  await adminDb.collection("mail").add({
    to: clientEmail,
    message: {
      subject: `Your Photography Contract is ready to sign`,
      html: `<p>Hi there,</p>
             <p>Your contract is ready for your review and signature. The link below is unique to you and expires in ${SIGNING_TOKEN_TTL_DAYS} days.</p>
             <p><a href="${signUrl}">Click here to review and sign</a></p>
             <p>Thank you,<br/>Korrin's Photography</p>`,
    },
  });

  revalidatePath(`/admin/projects/${contract.projectId}`);
  return { success: true };
}
