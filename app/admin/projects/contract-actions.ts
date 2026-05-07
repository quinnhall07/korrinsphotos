"use server";

import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { generateContractForProject } from "@/lib/contract-renderer";

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

  await contractRef.update({
    status: "SENT",
    sentAt: FieldValue.serverTimestamp(),
  });

  // Trigger email to client to sign
  const signUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/sign-contract/${contractId}`;
  
  await adminDb.collection("mail").add({
    to: clientEmail,
    message: {
      subject: `Your Photography Contract is ready to sign`,
      html: `<p>Hi there,</p>
             <p>Your contract is ready for your review and signature.</p>
             <p><a href="${signUrl}">Click here to review and sign</a></p>
             <p>Thank you,<br/>Korrin's Photography</p>`
    }
  });

  revalidatePath(`/admin/projects/${contract.projectId}`);
  return { success: true };
}
