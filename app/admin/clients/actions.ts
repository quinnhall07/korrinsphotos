"use server";

// app/admin/clients/actions.ts — Wave 11
//
// Server actions for the dedicated /admin/clients pages. Read-heavy area;
// the only mutation is editing a small allow-list of client fields.

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import {
  updateClientDetails,
  type UpdateClientDetailsInput,
} from "@/lib/db/clients";

export type UpdateClientDetailsResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Update a client's editable details (name, phone, notes, recurring cadence).
 *
 * Field allow-list lives in `lib/db/clients.ts > updateClientDetails`. Any
 * field not on that list is silently ignored. Recurring cadence values are
 * validated against the `RecurringCadence` union before write.
 */
export async function updateClientDetailsAction(
  clientId: string,
  partial: UpdateClientDetailsInput
): Promise<UpdateClientDetailsResult> {
  await requireAdmin();
  if (!clientId) return { success: false, error: "Missing client id." };

  try {
    await updateClientDetails(clientId, partial);
    revalidatePath("/admin/clients");
    revalidatePath(`/admin/clients/${clientId}`);
    return { success: true };
  } catch (err) {
    console.error("updateClientDetailsAction error:", err);
    return { success: false, error: "Failed to update client." };
  }
}
