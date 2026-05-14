"use server";

// app/admin/sequences/actions.ts
// Server Actions for the sequence builder. Every export starts with
// `await requireAdmin()` per repo convention.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { logActivity } from "@/lib/db/activity";
import {
  createSequence as dbCreateSequence,
  updateSequence as dbUpdateSequence,
  deactivateSequence as dbDeactivateSequence,
  type SequenceDoc,
  type SequenceTrigger,
  type SequenceChannel,
  type SequenceStep,
} from "@/lib/db/sequences";
import type { ProjectStatus } from "@/lib/db/projects";

type ActionResult<T = void> =
  | (T extends void ? { success: true } : { success: true; data: T })
  | { success: false; error: string };

// ─── Input shape (mirrored by SequenceBuilder.tsx) ───────────────────────────

export interface SequenceFormInput {
  name: string;
  description?: string;
  trigger: SequenceTrigger;
  triggerStatus?: ProjectStatus | null;
  dateAnchor?: "shootDate" | "deliveredAt" | null;
  active: boolean;
  steps: Array<{
    delayHours: number;
    channel: SequenceChannel;
    templateId: string;
  }>;
}

// ─── Normalise raw client input into the SequenceDoc shape ───────────────────

function normaliseInput(
  input: SequenceFormInput
): Omit<SequenceDoc, "id" | "createdAt" | "updatedAt"> {
  const trimmedName = input.name?.trim() || "Untitled sequence";
  const description =
    typeof input.description === "string" && input.description.trim()
      ? input.description.trim()
      : undefined;

  // Only persist triggerStatus when the trigger actually uses it.
  const triggerStatus =
    input.trigger === "STATUS_CHANGE" ? input.triggerStatus ?? null : null;

  // Only persist dateAnchor when the trigger actually uses it.
  const dateAnchor =
    input.trigger === "DATE_RELATIVE_TO_SHOOT"
      ? input.dateAnchor ?? "shootDate"
      : null;

  const steps: SequenceStep[] = (input.steps ?? []).map((s) => ({
    delayHours: Number.isFinite(s.delayHours) ? s.delayHours : 0,
    channel: s.channel,
    templateId: (s.templateId ?? "").trim(),
    conditionPredicate: null,
  }));

  const out: Omit<SequenceDoc, "id" | "createdAt" | "updatedAt"> = {
    name: trimmedName,
    trigger: input.trigger,
    triggerStatus,
    dateAnchor,
    active: !!input.active,
    steps,
  };
  if (description) out.description = description;
  return out;
}

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createSequenceAction(input: SequenceFormInput): Promise<void> {
  await requireAdmin();

  const data = normaliseInput(input);
  const created = await dbCreateSequence(data);

  await logActivity("NOTE_ADDED", `Sequence created: ${data.name}`, {
    sequenceId: created.id,
  }).catch(() => {});

  revalidatePath("/admin/sequences");

  redirect(`/admin/sequences/${created.id}`);
}

// ─── Update ──────────────────────────────────────────────────────────────────

export async function updateSequenceAction(
  id: string,
  input: SequenceFormInput
): Promise<ActionResult> {
  await requireAdmin();

  try {
    const data = normaliseInput(input);
    await dbUpdateSequence(id, data);

    await logActivity("NOTE_ADDED", `Sequence updated: ${data.name}`, {
      sequenceId: id,
    }).catch(() => {});

    revalidatePath("/admin/sequences");
    revalidatePath(`/admin/sequences/${id}`);

    return { success: true };
  } catch (err) {
    console.error("updateSequenceAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to save sequence.",
    };
  }
}

// ─── Toggle active ───────────────────────────────────────────────────────────

export async function toggleSequenceActiveAction(
  id: string,
  active: boolean
): Promise<ActionResult> {
  await requireAdmin();

  try {
    if (active) {
      await dbUpdateSequence(id, { active: true });
    } else {
      await dbDeactivateSequence(id);
    }

    await logActivity(
      "NOTE_ADDED",
      `Sequence ${active ? "activated" : "deactivated"}`,
      { sequenceId: id }
    ).catch(() => {});

    revalidatePath("/admin/sequences");
    revalidatePath(`/admin/sequences/${id}`);

    return { success: true };
  } catch (err) {
    console.error("toggleSequenceActiveAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to toggle sequence.",
    };
  }
}
