"use server";

// app/admin/settings/brand-voice/actions.ts
// Phase 13.13 — Persist Korrin's writing samples that the Phase 5 AI assists
// will use as voice anchors. Every action gates on requireAdmin() and grabs
// the uid from the session to scope writes to the current admin's user doc.

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import {
  addBrandVoiceSample,
  removeBrandVoiceSample,
  updateBrandVoiceSample,
  BRAND_VOICE_MAX_BODY,
  BRAND_VOICE_MAX_SAMPLES,
  BRAND_VOICE_MIN_BODY,
  type BrandVoiceSample,
} from "@/lib/db/admin-settings";

export type ActionResult<T = void> =
  | (T extends void ? { success: true } : { success: true; data: T })
  | { success: false; error: string };

function revalidate() {
  revalidatePath("/admin/settings/brand-voice");
  revalidatePath("/admin/inbox");
}

function validateBody(body: string): string | null {
  const len = body.length;
  if (len < BRAND_VOICE_MIN_BODY) {
    return `Sample body must be at least ${BRAND_VOICE_MIN_BODY} characters (currently ${len}).`;
  }
  if (len > BRAND_VOICE_MAX_BODY) {
    return `Sample body must be at most ${BRAND_VOICE_MAX_BODY} characters (currently ${len}).`;
  }
  return null;
}

function validateLabel(label: string): string | null {
  const trimmed = label.trim();
  if (!trimmed) return "Label is required.";
  if (trimmed.length > 80) return "Label must be 80 characters or fewer.";
  return null;
}

export async function addBrandVoiceSampleAction(input: {
  label: string;
  body: string;
  context?: string;
}): Promise<ActionResult<BrandVoiceSample>> {
  const session = await requireAdmin();

  const labelErr = validateLabel(input.label ?? "");
  if (labelErr) return { success: false, error: labelErr };
  const bodyErr = validateBody(input.body ?? "");
  if (bodyErr) return { success: false, error: bodyErr };
  if (input.context && input.context.length > 160) {
    return { success: false, error: "Context must be 160 characters or fewer." };
  }

  try {
    const sample = await addBrandVoiceSample(session.uid, {
      label: input.label,
      body: input.body,
      context: input.context,
    });
    revalidate();
    return { success: true, data: sample };
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : `Failed to save sample (max ${BRAND_VOICE_MAX_SAMPLES}).`;
    return { success: false, error: msg };
  }
}

export async function updateBrandVoiceSampleAction(
  id: string,
  patch: { label?: string; body?: string; context?: string | null }
): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!id) return { success: false, error: "Missing sample id." };

  if (patch.label !== undefined) {
    const labelErr = validateLabel(patch.label);
    if (labelErr) return { success: false, error: labelErr };
  }
  if (patch.body !== undefined) {
    const bodyErr = validateBody(patch.body);
    if (bodyErr) return { success: false, error: bodyErr };
  }
  if (typeof patch.context === "string" && patch.context.length > 160) {
    return { success: false, error: "Context must be 160 characters or fewer." };
  }

  try {
    await updateBrandVoiceSample(session.uid, id, patch);
    revalidate();
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update sample.";
    return { success: false, error: msg };
  }
}

export async function removeBrandVoiceSampleAction(id: string): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!id) return { success: false, error: "Missing sample id." };

  try {
    await removeBrandVoiceSample(session.uid, id);
    revalidate();
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to remove sample.";
    return { success: false, error: msg };
  }
}
