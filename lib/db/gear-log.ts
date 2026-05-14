// lib/db/gear-log.ts
// Per-project day-of pack-check log (Phase 3.7).
//
// Companion subcollection to `lib/db/gear-templates.ts`. Lives under each
// project at `projects/{projectId}/gearLog/{entryId}`. Items are seeded from
// a template via `instantiateGearLogFromTemplate` and individually checked
// off morning-of via `markGearItemPacked`.
//
// All fields are denormalized at log-time so renames to the source template
// don't break the historical record. The `gearItemId` join key still lets
// the UI surface "this came from the Wedding kit template" if desired.

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  getGearTemplate,
  type GearItemCategory,
} from "./gear-templates";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GearLogEntryDoc {
  id: string;
  /**
   * Original `GearItem.id` from the source template, or `"manual:<uuid>"` for
   * ad-hoc items added after instantiation.
   */
  gearItemId: string;
  /** Denormalized at log creation so template renames don't rewrite history. */
  name: string;
  category: GearItemCategory;
  required: boolean;
  /** True once the gear has been physically packed. Set by the admin check-off. */
  packed: boolean;
  packedAt?: Timestamp;
  packedByUid?: string;
  notes?: string;
}

// ─── Collection ref ──────────────────────────────────────────────────────────

export const projectGearLogCol = (projectId: string) =>
  adminDb.collection("projects").doc(projectId).collection("gearLog");

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function listProjectGearLog(
  projectId: string
): Promise<GearLogEntryDoc[]> {
  const snap = await projectGearLogCol(projectId).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as GearLogEntryDoc));
}

// ─── Writes ───────────────────────────────────────────────────────────────────

/**
 * Copy every item from the named template into the project's `gearLog`
 * subcollection with `packed: false`.
 *
 * Idempotent: if the log already has any entries this returns early with
 * `created: 0`. Callers that want to re-seed must explicitly clear the
 * subcollection first.
 */
export async function instantiateGearLogFromTemplate(
  projectId: string,
  templateId: string
): Promise<{ created: number; skippedExisting: boolean }> {
  const existing = await projectGearLogCol(projectId).limit(1).get();
  if (!existing.empty) {
    return { created: 0, skippedExisting: true };
  }

  const template = await getGearTemplate(templateId);
  if (!template) {
    throw new Error(`Gear template not found: ${templateId}`);
  }

  const items = Array.isArray(template.items) ? template.items : [];
  if (items.length === 0) {
    return { created: 0, skippedExisting: false };
  }

  const batch = adminDb.batch();
  const colRef = projectGearLogCol(projectId);

  for (const item of items) {
    const ref = colRef.doc();
    const entry: Omit<GearLogEntryDoc, "id"> = {
      gearItemId: item.id,
      name: item.name,
      category: item.category,
      required: !!item.required,
      packed: false,
      ...(item.notes ? { notes: item.notes } : {}),
    };
    batch.set(ref, entry);
  }

  await batch.commit();
  return { created: items.length, skippedExisting: false };
}

/**
 * Toggle the packed flag on a single log entry. Stamps `packedAt` and
 * `packedByUid` when set true; clears them when set false.
 */
export async function markGearItemPacked(
  projectId: string,
  entryId: string,
  packed: boolean,
  byUid?: string
): Promise<void> {
  const patch: Record<string, unknown> = { packed };
  if (packed) {
    patch.packedAt = FieldValue.serverTimestamp();
    if (byUid) patch.packedByUid = byUid;
  } else {
    patch.packedAt = FieldValue.delete();
    patch.packedByUid = FieldValue.delete();
  }
  await projectGearLogCol(projectId).doc(entryId).update(patch);
}

/**
 * Add a one-off item to the project's gear log that wasn't on any template.
 * The `gearItemId` is auto-prefixed with `manual:` so reports can distinguish
 * template-derived entries from ad-hoc additions.
 */
export async function addAdHocGearItem(
  projectId: string,
  input: {
    name: string;
    category: GearItemCategory;
    required?: boolean;
    notes?: string;
  }
): Promise<GearLogEntryDoc> {
  const ref = projectGearLogCol(projectId).doc();
  const entry: Omit<GearLogEntryDoc, "id"> = {
    gearItemId: `manual:${crypto.randomUUID()}`,
    name: input.name.trim() || "Untitled gear",
    category: input.category,
    required: !!input.required,
    packed: false,
    ...(input.notes ? { notes: input.notes } : {}),
  };
  await ref.set(entry);
  return { id: ref.id, ...entry } as GearLogEntryDoc;
}

export async function removeGearItem(
  projectId: string,
  entryId: string
): Promise<void> {
  await projectGearLogCol(projectId).doc(entryId).delete();
}
