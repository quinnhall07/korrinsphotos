"use server";

// app/admin/segments/actions.ts
// Server Actions for the segments builder. Every export starts with
// `await requireAdmin()` per repo convention.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { logActivity } from "@/lib/db/activity";
import {
  createSegment as dbCreateSegment,
  updateSegment as dbUpdateSegment,
  deleteSegment as dbDeleteSegment,
  cacheResolvedCount,
  type SegmentPredicate,
} from "@/lib/db/segments";
import { resolveSegment } from "@/lib/segments/resolver";

type ActionResult<T = void> =
  | (T extends void ? { success: true } : { success: true; data: T })
  | { success: false; error: string };

// ─── Create ──────────────────────────────────────────────────────────────────

/**
 * Creates an empty segment and redirects straight into the builder so the
 * admin can compose predicate fields against a real doc id.
 */
export async function createNewSegment(name: string): Promise<void> {
  await requireAdmin();

  const trimmed = name?.trim() || "Untitled segment";

  const created = await dbCreateSegment({
    name: trimmed,
    description: null,
    predicate: {},
    lastResolvedCount: null,
    lastResolvedAt: null,
  });

  await logActivity("NOTE_ADDED", `Segment created: ${trimmed}`, {
    segmentId: created.id,
  }).catch(() => {});

  revalidatePath("/admin/segments");

  redirect(`/admin/segments/${created.id}`);
}

// ─── Save ────────────────────────────────────────────────────────────────────

export async function saveSegment(
  id: string,
  predicate: SegmentPredicate,
  name?: string,
  description?: string
): Promise<ActionResult<{ count: number }>> {
  await requireAdmin();

  try {
    const patch: {
      predicate: SegmentPredicate;
      name?: string;
      description?: string | null;
    } = { predicate };

    if (typeof name === "string" && name.trim()) {
      patch.name = name.trim();
    }
    if (typeof description === "string") {
      patch.description = description.trim() ? description.trim() : null;
    }

    await dbUpdateSegment(id, patch);

    // Re-resolve and cache the count so the list view reflects the freshly
    // saved predicate without a separate round-trip.
    let count = 0;
    try {
      const resolution = await resolveSegment(predicate);
      count = resolution.count;
      await cacheResolvedCount(id, count);
    } catch (err) {
      console.error("saveSegment: resolveSegment failed:", err);
      // Save still succeeded — the count is best-effort.
    }

    await logActivity("NOTE_ADDED", `Segment saved`, {
      segmentId: id,
      count,
    }).catch(() => {});

    revalidatePath("/admin/segments");
    revalidatePath(`/admin/segments/${id}`);

    return { success: true, data: { count } };
  } catch (err) {
    console.error("saveSegment error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to save segment.",
    };
  }
}

// ─── Remove ──────────────────────────────────────────────────────────────────

export async function removeSegment(id: string): Promise<ActionResult> {
  await requireAdmin();

  try {
    await dbDeleteSegment(id);

    await logActivity("NOTE_ADDED", `Segment deleted`, {
      segmentId: id,
    }).catch(() => {});

    revalidatePath("/admin/segments");

    return { success: true };
  } catch (err) {
    console.error("removeSegment error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete segment.",
    };
  }
}
