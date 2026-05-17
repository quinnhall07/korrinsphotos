// lib/db/saved-views.ts
// Per-admin saved views for the /admin/projects pipeline.
// Stored as a subcollection so each user owns their own views:
//   users/{uid}/views/{viewId}
//
// Built-in views (DEFAULT_SAVED_VIEWS in ProjectsPipelineClientPage.tsx)
// are NOT persisted — they are static and rendered alongside whatever
// rows live in this collection.

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, type Timestamp } from "firebase-admin/firestore";

/** Discriminated filter kind. Matches `SavedViewFilter` in the pipeline UI. */
export type SavedViewFilterKind =
  | "HOT_LEADS"
  | "STUCK_OVER_7D"
  | "GALLERIES_OVERDUE"
  | "THIS_WEEKS_SHOOTS"
  | "AWAITING_DEPOSIT"
  | "ALL";

export interface SavedViewFilter {
  kind: SavedViewFilterKind;
}

export interface SavedViewDoc {
  id: string;
  name: string;
  filter: SavedViewFilter;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const ALLOWED_KINDS: ReadonlySet<SavedViewFilterKind> = new Set([
  "HOT_LEADS",
  "STUCK_OVER_7D",
  "GALLERIES_OVERDUE",
  "THIS_WEEKS_SHOOTS",
  "AWAITING_DEPOSIT",
  "ALL",
]);

function isValidFilter(value: unknown): value is SavedViewFilter {
  if (!value || typeof value !== "object") return false;
  const kind = (value as { kind?: unknown }).kind;
  return typeof kind === "string" && ALLOWED_KINDS.has(kind as SavedViewFilterKind);
}

export const savedViewsCol = (uid: string) =>
  adminDb.collection("users").doc(uid).collection("views");

export async function listSavedViews(uid: string): Promise<SavedViewDoc[]> {
  if (!uid) return [];
  try {
    const snap = await savedViewsCol(uid).orderBy("createdAt", "asc").get();
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as SavedViewDoc))
      // Defensive filter: ignore rows whose persisted filter has drifted
      // from the current discriminated-union (e.g. removed kinds).
      .filter((v) => isValidFilter(v.filter));
  } catch (err) {
    console.error("[listSavedViews] failed:", err);
    return [];
  }
}

export async function createSavedView(
  uid: string,
  data: { name: string; filter: SavedViewFilter }
): Promise<SavedViewDoc> {
  if (!uid) throw new Error("createSavedView: missing uid");
  const name = data.name.trim();
  if (!name) throw new Error("createSavedView: name required");
  if (!isValidFilter(data.filter)) {
    throw new Error("createSavedView: invalid filter kind");
  }

  const ref = savedViewsCol(uid).doc();
  await ref.set({
    name,
    filter: data.filter,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  const snap = await ref.get();
  return { id: ref.id, ...snap.data() } as SavedViewDoc;
}

export async function deleteSavedView(uid: string, viewId: string): Promise<void> {
  if (!uid || !viewId) return;
  await savedViewsCol(uid).doc(viewId).delete();
}
