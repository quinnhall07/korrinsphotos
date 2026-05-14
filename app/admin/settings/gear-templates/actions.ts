"use server";

// app/admin/settings/gear-templates/actions.ts
// Server Actions for managing gear templates (Phase 3.7). Mirrors the shape
// used by /admin/questionnaires/templates/actions.ts. Every export starts
// with `await requireAdmin()` per repo convention.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { logActivity } from "@/lib/db/activity";
import {
  createGearTemplate as dbCreateGearTemplate,
  updateGearTemplate as dbUpdateGearTemplate,
  deleteGearTemplate as dbDeleteGearTemplate,
  getGearTemplate,
  listGearTemplatesForSessionType,
  type GearItem,
  type GearItemCategory,
  type GearTemplateDoc,
} from "@/lib/db/gear-templates";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

type ActionResult<T = void> =
  | (T extends void ? { success: true } : { success: true; data: T })
  | { success: false; error: string };

// ─── Form input shape (mirrored by GearTemplateEditor.tsx) ───────────────────

export interface GearTemplateFormInput {
  name: string;
  sessionType: string;
  isDefault?: boolean;
  items: Array<{
    id: string;
    name: string;
    category: GearItemCategory;
    required: boolean;
    notes?: string;
  }>;
}

function normaliseInput(
  input: GearTemplateFormInput
): Omit<GearTemplateDoc, "id" | "createdAt" | "updatedAt"> {
  const name = input.name?.trim() || "Untitled kit";
  const sessionType = input.sessionType?.trim() || "Portrait";
  const items: GearItem[] = (input.items ?? [])
    .filter((item) => item && item.name?.trim())
    .map((item) => ({
      id: item.id?.trim() || crypto.randomUUID(),
      name: item.name.trim(),
      category: item.category,
      required: !!item.required,
      ...(item.notes?.trim() ? { notes: item.notes.trim() } : {}),
    }));

  return {
    name,
    sessionType,
    items,
    ...(input.isDefault ? { isDefault: true } : { isDefault: false }),
  };
}

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createGearTemplateAction(
  input: GearTemplateFormInput
): Promise<void> {
  await requireAdmin();

  const data = normaliseInput(input);

  // If isDefault is true, unset any existing defaults for this sessionType
  // before writing the new doc.
  if (data.isDefault) {
    const peers = await listGearTemplatesForSessionType(data.sessionType);
    if (peers.length > 0) {
      const batch = adminDb.batch();
      for (const peer of peers) {
        if (peer.isDefault) {
          batch.update(adminDb.collection("gearTemplates").doc(peer.id), {
            isDefault: false,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }
      await batch.commit();
    }
  }

  const created = await dbCreateGearTemplate(data);

  await logActivity(
    "NOTE_ADDED",
    `Gear template created: ${data.name}`,
    { templateId: created.id }
  ).catch(() => {});

  revalidatePath("/admin/settings/gear-templates");
  redirect(`/admin/settings/gear-templates/${created.id}`);
}

// ─── Update ──────────────────────────────────────────────────────────────────

export async function updateGearTemplateAction(
  id: string,
  input: GearTemplateFormInput
): Promise<ActionResult> {
  await requireAdmin();
  try {
    const data = normaliseInput(input);

    // Atomically swap the default flag if this template is being marked
    // default — unset any other default for the same sessionType first.
    if (data.isDefault) {
      const peers = await listGearTemplatesForSessionType(data.sessionType);
      const batch = adminDb.batch();
      for (const peer of peers) {
        if (peer.id !== id && peer.isDefault) {
          batch.update(adminDb.collection("gearTemplates").doc(peer.id), {
            isDefault: false,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }
      await batch.commit();
    }

    await dbUpdateGearTemplate(id, data);

    await logActivity(
      "NOTE_ADDED",
      `Gear template updated: ${data.name}`,
      { templateId: id }
    ).catch(() => {});

    revalidatePath("/admin/settings/gear-templates");
    revalidatePath(`/admin/settings/gear-templates/${id}`);
    return { success: true };
  } catch (err) {
    console.error("updateGearTemplateAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to save template.",
    };
  }
}

// ─── Delete ──────────────────────────────────────────────────────────────────

export async function deleteGearTemplateAction(
  id: string
): Promise<ActionResult> {
  await requireAdmin();
  if (!id) return { success: false, error: "Missing template id." };
  try {
    await dbDeleteGearTemplate(id);
    revalidatePath("/admin/settings/gear-templates");
    return { success: true };
  } catch (err) {
    console.error("deleteGearTemplateAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete template.",
    };
  }
}

// ─── Set default ─────────────────────────────────────────────────────────────

/**
 * Atomically mark one template as the default for its sessionType, unsetting
 * any previous default in the same group. Reads the target template first to
 * discover the sessionType.
 */
export async function setDefaultGearTemplate(
  id: string
): Promise<ActionResult> {
  await requireAdmin();
  if (!id) return { success: false, error: "Missing template id." };

  try {
    const target = await getGearTemplate(id);
    if (!target) return { success: false, error: "Template not found." };

    const peers = await listGearTemplatesForSessionType(target.sessionType);
    const batch = adminDb.batch();
    for (const peer of peers) {
      const shouldBeDefault = peer.id === id;
      // Only write if the flag is changing — avoids no-op writes.
      if (!!peer.isDefault !== shouldBeDefault) {
        batch.update(adminDb.collection("gearTemplates").doc(peer.id), {
          isDefault: shouldBeDefault,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }
    await batch.commit();

    revalidatePath("/admin/settings/gear-templates");
    revalidatePath(`/admin/settings/gear-templates/${id}`);
    return { success: true };
  } catch (err) {
    console.error("setDefaultGearTemplate error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to set default.",
    };
  }
}
