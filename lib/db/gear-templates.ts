// lib/db/gear-templates.ts
// Persistence layer for the per-shoot-type gear template engine (Phase 3.7).
//
// One collection lives here:
//   * gearTemplates/{id} — reusable gear checklists keyed by sessionType.
//
// Per CLAUDE.md > lib/db/CLAUDE.md, this module is server-only. Every
// helper goes through `adminDb`. Callers read/write via these helpers;
// no other file should touch the underlying collection directly.
//
// A companion subcollection lives under each project for the day-of
// pack-check log — see `lib/db/gear-log.ts`.

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { SessionType } from "./projects";

// ─── Types ────────────────────────────────────────────────────────────────────

export type GearItemCategory =
  | "CAMERA"
  | "LENS"
  | "LIGHTING"
  | "AUDIO"
  | "STORAGE"
  | "ACCESSORY"
  | "BACKUP"
  | "OTHER";

export interface GearItem {
  /** Stable per-template item id. Used as the join key on `GearLogEntryDoc`. */
  id: string;
  name: string;
  category: GearItemCategory;
  required: boolean;
  notes?: string;
}

export interface GearTemplateDoc {
  id: string;
  /** Human-readable label, e.g. "Wedding kit". */
  name: string;
  /**
   * Matches `ProjectDoc.sessionType`. Free-form string per the SessionType
   * type — we don't constrain (allows custom session types).
   */
  sessionType: SessionType;
  items: GearItem[];
  /**
   * If true, this template is the default for its `sessionType`. At most one
   * default per sessionType is enforced by `setDefaultGearTemplate` in the
   * action layer (atomic swap).
   */
  isDefault?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Collection ref ──────────────────────────────────────────────────────────

export const gearTemplatesCol = () => adminDb.collection("gearTemplates");

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function getGearTemplate(
  id: string
): Promise<GearTemplateDoc | null> {
  const snap = await gearTemplatesCol().doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as GearTemplateDoc) : null;
}

export async function listGearTemplates(): Promise<GearTemplateDoc[]> {
  const snap = await gearTemplatesCol().orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as GearTemplateDoc));
}

export async function listGearTemplatesForSessionType(
  sessionType: SessionType
): Promise<GearTemplateDoc[]> {
  const snap = await gearTemplatesCol()
    .where("sessionType", "==", sessionType)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as GearTemplateDoc));
}

export async function getDefaultGearTemplateForSessionType(
  sessionType: SessionType
): Promise<GearTemplateDoc | null> {
  const snap = await gearTemplatesCol()
    .where("sessionType", "==", sessionType)
    .where("isDefault", "==", true)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as GearTemplateDoc;
}

// ─── Writes ───────────────────────────────────────────────────────────────────

/**
 * Create a new gear template. Items missing an `id` are stamped with a fresh
 * `crypto.randomUUID()` so the day-of `gearLog` rows can join by item id even
 * after renames.
 */
export async function createGearTemplate(
  data: Omit<GearTemplateDoc, "id" | "createdAt" | "updatedAt">
): Promise<GearTemplateDoc> {
  const ref = gearTemplatesCol().doc();
  const now = Timestamp.now();
  const items: GearItem[] = (data.items ?? []).map((item) => ({
    id: item.id?.trim() || crypto.randomUUID(),
    name: item.name,
    category: item.category,
    required: !!item.required,
    ...(item.notes ? { notes: item.notes } : {}),
  }));

  const fullData = { ...data, items, createdAt: now, updatedAt: now };
  await ref.set(fullData);
  return { id: ref.id, ...fullData } as GearTemplateDoc;
}

export async function updateGearTemplate(
  id: string,
  patch: Partial<Omit<GearTemplateDoc, "id" | "createdAt">>
): Promise<void> {
  const next: Record<string, unknown> = {
    ...patch,
    updatedAt: FieldValue.serverTimestamp(),
  };

  // Re-normalise items so callers can pass partials without stripping ids.
  if (Array.isArray(patch.items)) {
    next.items = patch.items.map((item) => ({
      id: item.id?.trim() || crypto.randomUUID(),
      name: item.name,
      category: item.category,
      required: !!item.required,
      ...(item.notes ? { notes: item.notes } : {}),
    }));
  }

  await gearTemplatesCol().doc(id).update(next);
}

export async function deleteGearTemplate(id: string): Promise<void> {
  await gearTemplatesCol().doc(id).delete();
}

/**
 * Idempotency helper used by the seed script. Returns the first template
 * whose `name` matches exactly (case-sensitive), or null.
 */
export async function findGearTemplateByName(
  name: string
): Promise<GearTemplateDoc | null> {
  const snap = await gearTemplatesCol()
    .where("name", "==", name)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as GearTemplateDoc;
}
