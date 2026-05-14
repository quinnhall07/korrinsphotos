// lib/db/day-of-timeline.ts
//
// Phase 2.8 — Per-project day-of timeline blocks.
//
// Lives under each project at `projects/{projectId}/dayOfTimeline/{blockId}`.
// Korrin builds a drag-orderable list of timeline blocks (e.g. "12:00 — First
// look @ Garden") for each shoot. The shoot-brief auto-generator (Phase 3.4)
// and the client portal (Phase 2.4) both render these in order.
//
// `startTime` is a local time-of-day string (`HH:mm`), NOT a Firestore
// Timestamp — the shoot date itself lives on `ProjectDoc.shootDate`, and the
// timeline can be edited well before that date is locked.

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TimelineBlockType =
  | "PREP"
  | "TRAVEL"
  | "SHOOT"
  | "BREAK"
  | "DETAIL"
  | "FAMILY"
  | "CEREMONY"
  | "RECEPTION"
  | "OTHER";

export const TIMELINE_BLOCK_TYPES: TimelineBlockType[] = [
  "PREP",
  "TRAVEL",
  "SHOOT",
  "BREAK",
  "DETAIL",
  "FAMILY",
  "CEREMONY",
  "RECEPTION",
  "OTHER",
];

export interface TimelineBlockDoc {
  id: string;
  /** 0-indexed; reorder rewrites all rows transactionally. */
  order: number;
  /** Human-readable label, e.g. "First look". */
  title: string;
  /** `HH:mm` local time-of-day. Not a Timestamp. */
  startTime: string;
  /** Duration in minutes. 0 for instant blocks. */
  durationMinutes: number;
  /** Free-text location string; not joined to `lib/db/locations.ts` yet. */
  location?: string;
  blockType: TimelineBlockType;
  notes?: string;
  /** Gates portal rendering. */
  visibleToClient: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type TimelineBlockInput = {
  title?: string;
  startTime?: string;
  durationMinutes?: number;
  location?: string;
  blockType?: TimelineBlockType;
  notes?: string;
  visibleToClient?: boolean;
};

// ─── Collection ref ──────────────────────────────────────────────────────────

export const dayOfTimelineCol = (projectId: string) =>
  adminDb.collection("projects").doc(projectId).collection("dayOfTimeline");

// ─── Helpers ─────────────────────────────────────────────────────────────────

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function normalizeStartTime(input: unknown): string {
  if (typeof input !== "string") return "00:00";
  const trimmed = input.trim();
  if (HHMM_RE.test(trimmed)) return trimmed;
  // Be forgiving — accept "9:30" → "09:30".
  const loose = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (loose) {
    const hh = Math.min(23, Math.max(0, parseInt(loose[1], 10)));
    const mm = Math.min(59, Math.max(0, parseInt(loose[2], 10)));
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }
  return "00:00";
}

function normalizeDuration(input: unknown): number {
  const n = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function normalizeBlockType(input: unknown): TimelineBlockType {
  if (typeof input === "string" && (TIMELINE_BLOCK_TYPES as string[]).includes(input)) {
    return input as TimelineBlockType;
  }
  return "OTHER";
}

// ─── Reads ───────────────────────────────────────────────────────────────────

/**
 * Returns every block on the project, sorted by `order` ascending.
 */
export async function listDayOfTimeline(
  projectId: string
): Promise<TimelineBlockDoc[]> {
  const snap = await dayOfTimelineCol(projectId).orderBy("order", "asc").get();
  return snap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as TimelineBlockDoc)
  );
}

// ─── Writes ──────────────────────────────────────────────────────────────────

/**
 * Append a new block at the end of the existing ordering. Reads the current
 * row count once to compute the new `order` value.
 */
export async function createTimelineBlock(
  projectId: string,
  input: TimelineBlockInput
): Promise<TimelineBlockDoc> {
  const colRef = dayOfTimelineCol(projectId);
  const countSnap = await colRef.count().get();
  const order = countSnap.data().count;

  const now = Timestamp.now();
  const data: Omit<TimelineBlockDoc, "id"> = {
    order,
    title: (input.title ?? "").trim() || "Untitled block",
    startTime: normalizeStartTime(input.startTime),
    durationMinutes: normalizeDuration(input.durationMinutes),
    ...(input.location && input.location.trim()
      ? { location: input.location.trim() }
      : {}),
    blockType: normalizeBlockType(input.blockType),
    ...(input.notes && input.notes.trim() ? { notes: input.notes.trim() } : {}),
    visibleToClient:
      typeof input.visibleToClient === "boolean" ? input.visibleToClient : true,
    createdAt: now,
    updatedAt: now,
  };

  const ref = colRef.doc();
  await ref.set(data);
  return { id: ref.id, ...data };
}

/**
 * Partial update. Whitelists the fields callers are allowed to mutate so a
 * stray payload can't overwrite `order` (use `reorderTimelineBlocks` for that)
 * or `createdAt`.
 */
export async function updateTimelineBlock(
  projectId: string,
  id: string,
  patch: TimelineBlockInput
): Promise<void> {
  const update: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (typeof patch.title === "string") {
    update.title = patch.title.trim() || "Untitled block";
  }
  if (typeof patch.startTime === "string") {
    update.startTime = normalizeStartTime(patch.startTime);
  }
  if (patch.durationMinutes !== undefined) {
    update.durationMinutes = normalizeDuration(patch.durationMinutes);
  }
  if (patch.location !== undefined) {
    const loc = (patch.location ?? "").trim();
    update.location = loc.length > 0 ? loc : FieldValue.delete();
  }
  if (patch.blockType !== undefined) {
    update.blockType = normalizeBlockType(patch.blockType);
  }
  if (patch.notes !== undefined) {
    const notes = (patch.notes ?? "").trim();
    update.notes = notes.length > 0 ? notes : FieldValue.delete();
  }
  if (typeof patch.visibleToClient === "boolean") {
    update.visibleToClient = patch.visibleToClient;
  }

  await dayOfTimelineCol(projectId).doc(id).update(update);
}

export async function deleteTimelineBlock(
  projectId: string,
  id: string
): Promise<void> {
  await dayOfTimelineCol(projectId).doc(id).delete();
}

/**
 * Rewrite the `order` field on every block in a single transaction so the
 * collection always reflects a consistent ordering. IDs that don't exist in
 * the subcollection are skipped silently.
 */
export async function reorderTimelineBlocks(
  projectId: string,
  orderedIds: string[]
): Promise<void> {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return;
  const colRef = dayOfTimelineCol(projectId);

  await adminDb.runTransaction(async (tx) => {
    // Read every doc inside the txn so the write set is consistent.
    const refs = orderedIds.map((id) => colRef.doc(id));
    const snaps = await tx.getAll(...refs);
    snaps.forEach((snap, i) => {
      if (!snap.exists) return;
      tx.update(snap.ref, {
        order: i,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  });
}
