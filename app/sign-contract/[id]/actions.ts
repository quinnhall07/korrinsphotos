"use server";

// app/sign-contract/[id]/actions.ts
// Public Server Action — clients sign the contract from the email link.
// No requireAdmin/requireSession guard: the contract id is the access token
// for now. The secure-token-bound version is Phase 1.7.

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { contractsCol, getContract } from "@/lib/db/contracts";
import { logActivity } from "@/lib/db/activity";

type SignResult =
  | { success: true; signedAt: string }
  | { success: false; error: string };

export async function signContract(
  contractId: string,
  typedName: string,
  agreedToElectronicSignature: boolean
): Promise<SignResult> {
  const trimmedName = typedName?.trim() ?? "";

  if (trimmedName.length < 2) {
    return { success: false, error: "Please enter your full legal name." };
  }
  if (!agreedToElectronicSignature) {
    return { success: false, error: "You must agree to the electronic signature terms." };
  }

  try {
    const contract = await getContract(contractId);
    if (!contract) {
      return { success: false, error: "Contract not found." };
    }
    if (contract.status === "SIGNED") {
      return { success: false, error: "This contract has already been signed." };
    }
    if (contract.status === "VOIDED") {
      return { success: false, error: "This contract is no longer valid." };
    }

    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    const signerIp = fwd ? fwd.split(",")[0].trim() : null;
    const signerUserAgent = h.get("user-agent");

    await contractsCol().doc(contractId).update({
      status: "SIGNED",
      signedAt: FieldValue.serverTimestamp(),
      signerIp,
      signerUserAgent,
      signedTypedName: trimmedName,
    });

    // Best-effort activity log — never block the signing flow.
    // "NOTE_ADDED" is the closest existing ActivityAction; the activity feed
    // is informational only.
    logActivity("NOTE_ADDED", `Contract signed by ${trimmedName}`, {
      contractId,
      projectId: contract.projectId,
      clientId: contract.clientId,
      kind: "CONTRACT_SIGNED",
    }).catch(() => {});

    revalidatePath(`/sign-contract/${contractId}`);
    revalidatePath(`/admin/projects/${contract.projectId}`);

    return { success: true, signedAt: new Date().toLocaleString() };
  } catch (err) {
    console.error("signContract error:", err);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}
