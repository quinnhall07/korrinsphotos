"use server";

// app/admin/broadcasts/actions.ts
// Server Actions for the broadcast composer (Phase 4.3). Every export starts
// with `await requireAdmin()` per repo convention.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Timestamp } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/session";
import { logActivity } from "@/lib/db/activity";
import {
  createBroadcast as dbCreateBroadcast,
  updateBroadcast as dbUpdateBroadcast,
  deleteBroadcast as dbDeleteBroadcast,
  type BroadcastBlock,
} from "@/lib/db/broadcasts";
import { sendBroadcastById } from "@/lib/broadcasts/sender";

type ActionResult<T = void> =
  | (T extends void ? { success: true } : { success: true; data: T })
  | { success: false; error: string };

// ─── Create ──────────────────────────────────────────────────────────────────

/**
 * Creates an empty broadcast and redirects straight into the composer so the
 * admin can compose blocks against a real doc id.
 */
export async function createNewBroadcast(
  name: string,
  segmentId: string
): Promise<void> {
  await requireAdmin();

  const trimmed = name?.trim() || "Untitled broadcast";

  const defaultBlocks: BroadcastBlock[] = [
    { type: "hero", title: "Hello,", subtitle: "Tap to edit this hero." },
    {
      type: "text",
      html: "<p>Write your update here. Use the buttons on the left to add image grids, CTAs, or a footer.</p>",
    },
    { type: "footer", text: "Korrin's Photography · Cary, NC" },
  ];

  const created = await dbCreateBroadcast({
    name: trimmed,
    segmentId,
    subject: trimmed,
    blocks: defaultBlocks,
    status: "DRAFT",
    scheduledFor: null,
    sentAt: null,
    recipientCount: null,
    sentCount: null,
    sendIdsByRecipient: null,
  });

  await logActivity("NOTE_ADDED", `Broadcast created: ${trimmed}`, {
    broadcastId: created.id,
  }).catch(() => {});

  revalidatePath("/admin/broadcasts");
  redirect(`/admin/broadcasts/${created.id}`);
}

// ─── Save draft ──────────────────────────────────────────────────────────────

export interface SaveBroadcastInput {
  name: string;
  subject: string;
  segmentId: string;
  blocks: BroadcastBlock[];
}

export async function saveBroadcastAction(
  id: string,
  input: SaveBroadcastInput
): Promise<ActionResult> {
  await requireAdmin();

  try {
    await dbUpdateBroadcast(id, {
      name: input.name?.trim() || "Untitled broadcast",
      subject: input.subject?.trim() || "(no subject)",
      segmentId: input.segmentId,
      blocks: Array.isArray(input.blocks) ? input.blocks : [],
    });

    await logActivity("NOTE_ADDED", `Broadcast saved`, {
      broadcastId: id,
    }).catch(() => {});

    revalidatePath("/admin/broadcasts");
    revalidatePath(`/admin/broadcasts/${id}`);

    return { success: true };
  } catch (err) {
    console.error("saveBroadcastAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to save broadcast.",
    };
  }
}

// ─── Send now ────────────────────────────────────────────────────────────────

export async function sendBroadcastAction(
  id: string
): Promise<ActionResult<{ recipientCount: number; sentCount: number; capped?: boolean }>> {
  await requireAdmin();

  try {
    const result = await sendBroadcastById(id);
    if (!result.success) {
      return {
        success: false,
        error: result.error ?? "Send failed",
      };
    }

    await logActivity("EMAIL_SENT", `Broadcast sent to ${result.sentCount}`, {
      broadcastId: id,
      recipientCount: result.recipientCount,
      sentCount: result.sentCount,
    }).catch(() => {});

    revalidatePath("/admin/broadcasts");
    revalidatePath(`/admin/broadcasts/${id}`);

    return {
      success: true,
      data: {
        recipientCount: result.recipientCount,
        sentCount: result.sentCount,
        ...(result.capped ? { capped: true } : {}),
      },
    };
  } catch (err) {
    console.error("sendBroadcastAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to send broadcast.",
    };
  }
}

// ─── Schedule ────────────────────────────────────────────────────────────────

export async function scheduleBroadcastAction(
  id: string,
  scheduledForIso: string
): Promise<ActionResult> {
  await requireAdmin();

  const ms = Date.parse(scheduledForIso);
  if (Number.isNaN(ms)) {
    return { success: false, error: "Invalid schedule date" };
  }
  if (ms <= Date.now()) {
    return { success: false, error: "Schedule time must be in the future" };
  }

  try {
    await dbUpdateBroadcast(id, {
      status: "SCHEDULED",
      scheduledFor: Timestamp.fromMillis(ms),
    });

    await logActivity("NOTE_ADDED", `Broadcast scheduled`, {
      broadcastId: id,
      scheduledFor: scheduledForIso,
    }).catch(() => {});

    revalidatePath("/admin/broadcasts");
    revalidatePath(`/admin/broadcasts/${id}`);

    return { success: true };
  } catch (err) {
    console.error("scheduleBroadcastAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to schedule broadcast.",
    };
  }
}

// ─── Unschedule (back to DRAFT) ──────────────────────────────────────────────

export async function unscheduleBroadcastAction(
  id: string
): Promise<ActionResult> {
  await requireAdmin();

  try {
    await dbUpdateBroadcast(id, {
      status: "DRAFT",
      scheduledFor: null,
    });

    revalidatePath("/admin/broadcasts");
    revalidatePath(`/admin/broadcasts/${id}`);

    return { success: true };
  } catch (err) {
    console.error("unscheduleBroadcastAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to unschedule broadcast.",
    };
  }
}

// ─── Delete ──────────────────────────────────────────────────────────────────

export async function removeBroadcast(id: string): Promise<ActionResult> {
  await requireAdmin();

  try {
    await dbDeleteBroadcast(id);
    await logActivity("NOTE_ADDED", `Broadcast deleted`, {
      broadcastId: id,
    }).catch(() => {});
    revalidatePath("/admin/broadcasts");
    return { success: true };
  } catch (err) {
    console.error("removeBroadcast error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete broadcast.",
    };
  }
}
