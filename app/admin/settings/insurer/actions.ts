"use server";

// app/admin/settings/insurer/actions.ts
// Phase 3.9 — Persist the per-admin insurer contact used by the COI
// (Certificate of Insurance) request flow on the project workspace.

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { updateUserInsurerContact } from "@/lib/db/users";
import { logActivity } from "@/lib/db/activity";

export interface InsurerContactInput {
  name?: string;
  email?: string;
  phone?: string;
  defaultAdditionalInsuredText?: string;
}

export type UpdateInsurerContactResult =
  | { success: true }
  | { success: false; error: string };

export async function updateInsurerContactAction(
  input: InsurerContactInput
): Promise<UpdateInsurerContactResult> {
  const session = await requireAdmin();

  // Lightweight validation — every field is optional, but if `email` is
  // supplied it must look like an email so the COI request doesn't fan out
  // to a malformed address.
  if (input.email && input.email.trim()) {
    const trimmed = input.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return { success: false, error: "Insurer email is malformed." };
    }
  }

  try {
    await updateUserInsurerContact(session.uid, {
      name: input.name,
      email: input.email,
      phone: input.phone,
      defaultAdditionalInsuredText: input.defaultAdditionalInsuredText,
    });

    await logActivity(
      "NOTE_ADDED",
      "Insurer contact updated",
      { uid: session.uid }
    ).catch(() => {});

    revalidatePath("/admin/settings/insurer");

    return { success: true };
  } catch (err) {
    console.error("updateInsurerContactAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to save insurer contact.",
    };
  }
}
