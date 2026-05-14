// lib/db/style-profiles.ts
// Style-quiz responses captured by the public /style page (Phase 2.2).
// Email is the unique key — re-submission overwrites (atomic upsert), not
// append. The future AI mood-board generator (Phase 5.8) reads `tagSummary`
// from this collection. One file per Firestore collection per `lib/db/CLAUDE.md`.

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export interface StyleProfileDoc {
  id: string; // doc id = lowercased trimmed email
  email: string;
  firstName?: string;
  /** Map of question id → chosen option id. */
  answers: Record<string, string>;
  /** Dominant tag buckets derived from answers (e.g. "light-airy"). */
  tagSummary: string[];
  submittedAt: Timestamp;
  updatedAt: Timestamp;
}

export const styleProfilesCol = () => adminDb.collection("styleProfiles");

/** Normalise the email used as document id — lowercase + trim. */
function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function getStyleProfile(
  email: string
): Promise<StyleProfileDoc | null> {
  const id = normaliseEmail(email);
  if (!id) return null;
  const snap = await styleProfilesCol().doc(id).get();
  return snap.exists
    ? ({ id: snap.id, ...snap.data() } as StyleProfileDoc)
    : null;
}

export async function listStyleProfiles(): Promise<StyleProfileDoc[]> {
  const snap = await styleProfilesCol()
    .orderBy("submittedAt", "desc")
    .get();
  return snap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as StyleProfileDoc)
  );
}

/**
 * Atomic upsert. Re-submission overwrites the entire `answers` and
 * `tagSummary` payload (per spec — not append). `submittedAt` is preserved
 * across re-submissions if the doc already exists; `updatedAt` is always
 * bumped.
 */
export async function upsertStyleProfile(input: {
  email: string;
  firstName?: string;
  answers: Record<string, string>;
  tagSummary: string[];
}): Promise<StyleProfileDoc> {
  const id = normaliseEmail(input.email);
  if (!id) throw new Error("Email is required to upsert a style profile.");

  const ref = styleProfilesCol().doc(id);
  const existing = await ref.get();
  const now = Timestamp.now();
  const submittedAt = existing.exists
    ? ((existing.data()?.submittedAt as Timestamp | undefined) ?? now)
    : now;

  const payload = {
    email: id,
    firstName: input.firstName ?? null,
    answers: input.answers,
    tagSummary: input.tagSummary,
    submittedAt,
    updatedAt: FieldValue.serverTimestamp(),
  };

  await ref.set(payload, { merge: false });

  return {
    id,
    email: id,
    firstName: input.firstName,
    answers: input.answers,
    tagSummary: input.tagSummary,
    submittedAt,
    updatedAt: now,
  };
}
