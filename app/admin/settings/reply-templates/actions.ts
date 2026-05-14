"use server";

// app/admin/settings/reply-templates/actions.ts
// Wave 12 — CRUD server actions for the admin's saved reply templates.
// Templates are persisted on `users/{uid}.replyTemplates` and surfaced in
// the project workspace MessagesTab as a "Templates ▾" quick-insert popover.

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import {
  addReplyTemplate,
  removeReplyTemplate,
  updateReplyTemplate,
  REPLY_TEMPLATE_MAX_BODY,
  REPLY_TEMPLATE_MAX_LABEL,
  type ReplyTemplate,
} from "@/lib/db/admin-settings";

export type ActionResult<T = void> =
  | (T extends void ? { success: true } : { success: true; data: T })
  | { success: false; error: string };

function revalidate() {
  revalidatePath("/admin/settings/reply-templates");
  // Project workspace reads templates server-side via getReplyTemplates,
  // so any project detail page also needs invalidation. The blanket
  // pattern revalidates the segment.
  revalidatePath("/admin/projects/[id]", "page");
}

function validateLabel(label: string): string | null {
  const trimmed = (label ?? "").trim();
  if (!trimmed) return "Label is required.";
  if (trimmed.length > REPLY_TEMPLATE_MAX_LABEL) {
    return `Label must be ${REPLY_TEMPLATE_MAX_LABEL} characters or fewer.`;
  }
  return null;
}

function validateBody(body: string): string | null {
  if (typeof body !== "string" || body.length === 0) {
    return "Body is required.";
  }
  if (body.length > REPLY_TEMPLATE_MAX_BODY) {
    return `Body must be ${REPLY_TEMPLATE_MAX_BODY} characters or fewer.`;
  }
  return null;
}

export async function addReplyTemplateAction(input: {
  label: string;
  body: string;
}): Promise<ActionResult<ReplyTemplate>> {
  const session = await requireAdmin();

  const labelErr = validateLabel(input.label ?? "");
  if (labelErr) return { success: false, error: labelErr };
  const bodyErr = validateBody(input.body ?? "");
  if (bodyErr) return { success: false, error: bodyErr };

  try {
    const template = await addReplyTemplate(session.uid, {
      label: input.label,
      body: input.body,
    });
    revalidate();
    return { success: true, data: template };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to save template.";
    return { success: false, error: msg };
  }
}

export async function updateReplyTemplateAction(
  id: string,
  patch: { label?: string; body?: string }
): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!id) return { success: false, error: "Missing template id." };

  if (patch.label !== undefined) {
    const labelErr = validateLabel(patch.label);
    if (labelErr) return { success: false, error: labelErr };
  }
  if (patch.body !== undefined) {
    const bodyErr = validateBody(patch.body);
    if (bodyErr) return { success: false, error: bodyErr };
  }

  try {
    await updateReplyTemplate(session.uid, id, patch);
    revalidate();
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update template.";
    return { success: false, error: msg };
  }
}

export async function removeReplyTemplateAction(
  id: string
): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!id) return { success: false, error: "Missing template id." };

  try {
    await removeReplyTemplate(session.uid, id);
    revalidate();
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to remove template.";
    return { success: false, error: msg };
  }
}
