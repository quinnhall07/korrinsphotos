"use server";

// app/admin/reports/compliance/actions.ts
// Phase 3.10 — Server Actions for the compliance dashboard.

import { revalidatePath } from "next/cache";
import { Timestamp } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/session";
import { logActivity } from "@/lib/db/activity";
import { getClientByEmail } from "@/lib/db/clients";
import { createInboxItem } from "@/lib/db/inbox";
import {
  createDataRequest,
  updateDataRequest,
  type DataRequestType,
  type DataRequestStatus,
  DATA_REQUEST_TYPE_LABELS,
} from "@/lib/db/data-requests";

type ActionResult<T = void> =
  | (T extends void ? { success: true } : { success: true; data: T })
  | { success: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CreateDataRequestInput {
  type: DataRequestType;
  subjectEmail: string;
  notes?: string;
}

export async function createDataRequestAction(
  input: CreateDataRequestInput
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();

  try {
    const email = (input.subjectEmail ?? "").trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) {
      return { success: false, error: "A valid subject email is required." };
    }
    if (input.type !== "DELETE" && input.type !== "ACCESS" && input.type !== "PORTABILITY") {
      return { success: false, error: "Invalid request type." };
    }

    let subjectClientId: string | null = null;
    try {
      const client = await getClientByEmail(email);
      if (client) subjectClientId = client.id;
    } catch (err) {
      console.error("[compliance] client lookup failed:", err);
    }

    const created = await createDataRequest({
      type: input.type,
      subjectEmail: email,
      subjectClientId,
      notes: input.notes?.trim() || null,
    });

    await logActivity(
      "NOTE_ADDED",
      `${DATA_REQUEST_TYPE_LABELS[input.type]} request logged for ${email}`,
      { dataRequestId: created.id, type: input.type, subjectClientId }
    ).catch(() => {});

    // Best-effort inbox triage row. The `InboxItemType` union does not yet
    // include "DATA_REQUEST_OPEN", so cast through unknown to avoid blocking
    // on a parallel-agent change to lib/db/inbox.ts. Failure is swallowed.
    try {
      await createInboxItem({
        type: "DATA_REQUEST_OPEN" as unknown as Parameters<typeof createInboxItem>[0]["type"],
        title: `${DATA_REQUEST_TYPE_LABELS[input.type]} request from ${email}`,
        body: input.notes?.trim() || null,
        link: `/admin/reports/compliance`,
        clientId: subjectClientId,
        read: false,
      });
    } catch (err) {
      console.error("[compliance] inbox row write failed:", err);
    }

    revalidatePath("/admin/reports/compliance");
    revalidatePath("/admin/inbox");

    return { success: true, data: { id: created.id } };
  } catch (err) {
    console.error("createDataRequestAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to log data request.",
    };
  }
}

export async function updateDataRequestStatusAction(
  id: string,
  status: DataRequestStatus,
  notes?: string
): Promise<ActionResult> {
  await requireAdmin();

  try {
    if (
      status !== "OPEN" &&
      status !== "IN_PROGRESS" &&
      status !== "FULFILLED" &&
      status !== "REJECTED"
    ) {
      return { success: false, error: "Invalid status." };
    }

    const patch: Parameters<typeof updateDataRequest>[1] = { status };
    if (status === "FULFILLED") {
      patch.fulfilledAt = Timestamp.now();
    }
    if (typeof notes === "string" && notes.trim()) {
      patch.notes = notes.trim();
    }

    await updateDataRequest(id, patch);

    await logActivity("NOTE_ADDED", `Data request ${id} → ${status}`, {
      dataRequestId: id,
      status,
    }).catch(() => {});

    revalidatePath("/admin/reports/compliance");

    return { success: true };
  } catch (err) {
    console.error("updateDataRequestStatusAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update data request.",
    };
  }
}
