"use server";

// app/admin/projects/timeline-actions.ts
//
// Phase 2.8 — Server Actions for the per-project day-of timeline builder.
// All mutations require admin and revalidate both the admin workspace and the
// client portal route.

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import {
  createTimelineBlock,
  updateTimelineBlock,
  deleteTimelineBlock,
  reorderTimelineBlocks,
  type TimelineBlockInput,
} from "@/lib/db/day-of-timeline";

type Result = { success: boolean; error?: string };

function revalidate(projectId: string) {
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath(`/portal/${projectId}`);
}

export async function createTimelineBlockAction(
  projectId: string,
  input: TimelineBlockInput
): Promise<Result & { id?: string }> {
  await requireAdmin();
  if (!projectId) return { success: false, error: "Missing project id." };
  try {
    const block = await createTimelineBlock(projectId, input);
    revalidate(projectId);
    return { success: true, id: block.id };
  } catch (err) {
    console.error("createTimelineBlockAction error:", err);
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to create timeline block.",
    };
  }
}

export async function updateTimelineBlockAction(
  projectId: string,
  id: string,
  patch: TimelineBlockInput
): Promise<Result> {
  await requireAdmin();
  if (!projectId || !id) {
    return { success: false, error: "Missing identifiers." };
  }
  try {
    await updateTimelineBlock(projectId, id, patch);
    revalidate(projectId);
    return { success: true };
  } catch (err) {
    console.error("updateTimelineBlockAction error:", err);
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to update timeline block.",
    };
  }
}

export async function deleteTimelineBlockAction(
  projectId: string,
  id: string
): Promise<Result> {
  await requireAdmin();
  if (!projectId || !id) {
    return { success: false, error: "Missing identifiers." };
  }
  try {
    await deleteTimelineBlock(projectId, id);
    revalidate(projectId);
    return { success: true };
  } catch (err) {
    console.error("deleteTimelineBlockAction error:", err);
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to delete timeline block.",
    };
  }
}

export async function reorderTimelineBlocksAction(
  projectId: string,
  orderedIds: string[]
): Promise<Result> {
  await requireAdmin();
  if (!projectId) return { success: false, error: "Missing project id." };
  if (!Array.isArray(orderedIds)) {
    return { success: false, error: "Invalid order payload." };
  }
  try {
    await reorderTimelineBlocks(projectId, orderedIds);
    revalidate(projectId);
    return { success: true };
  } catch (err) {
    console.error("reorderTimelineBlocksAction error:", err);
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to reorder timeline blocks.",
    };
  }
}
