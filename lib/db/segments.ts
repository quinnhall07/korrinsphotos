// lib/db/segments.ts
// Persistence helpers for the `segments/{id}` collection. A segment is a
// saved, JSON-serialisable predicate over the Client/Project model. The
// resolver (lib/segments/resolver.ts) compiles the predicate into Firestore
// queries + in-memory filters at read time.
//
// Server-only: imports `adminDb`. Never import from a "use client" file.

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { ProjectStatus } from "./projects";

/**
 * SegmentPredicate — the persistence shape, JSON-serialisable.
 *
 * Conventions:
 * - Array fields are "any-of" (OR within the field), except `tagsInclude`
 *   which is "all-of" (AND) and `tagsExclude` which is "none-of".
 * - Date fields are ISO strings; the resolver parses them on use.
 * - Numeric ranges are inclusive on both ends.
 * - All fields are optional. Empty predicate ⇒ matches every client + project.
 */
export interface SegmentPredicate {
  projectStatus?: ProjectStatus[];
  /**
   * Roadmap §4.3 — client lifecycle stage filter.
   * Matches `clients/{id}.lifecycleStage` (`INQUIRED | BOOKED | DELIVERED | REPEAT | CHURNED`).
   */
  lifecycleStage?: string[];
  sessionType?: string[];
  tagsInclude?: string[];   // ALL must match
  tagsExclude?: string[];   // NONE may match
  leadScoreMin?: number;
  leadScoreMax?: number;
  leadSource?: string[];
  totalSessionsBookedMin?: number;
  firstTouchSource?: string[];
  deliveredAfter?: string;  // ISO date — client.lastDeliveredAt OR project.deliveredAt
  deliveredBefore?: string;
  hasReferred?: boolean;    // referralCount > 0
  /**
   * Minimum referral tier (1–5). Matches `clients/{id}.referralTier`.
   */
  referralTierMin?: number;
}

export interface SegmentDoc {
  id: string;
  name: string;
  description?: string | null;
  predicate: SegmentPredicate;
  lastResolvedCount?: number | null;
  lastResolvedAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const segmentsCol = () => adminDb.collection("segments");

export async function getSegment(id: string): Promise<SegmentDoc | null> {
  const snap = await segmentsCol().doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as SegmentDoc) : null;
}

export async function listSegments(): Promise<SegmentDoc[]> {
  const snap = await segmentsCol().orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SegmentDoc));
}

export async function createSegment(
  data: Omit<SegmentDoc, "id" | "createdAt" | "updatedAt">
): Promise<SegmentDoc> {
  const ref = segmentsCol().doc();
  const now = Timestamp.now();
  const fullData = { ...data, createdAt: now, updatedAt: now };
  await ref.set(fullData);
  return { id: ref.id, ...fullData } as SegmentDoc;
}

export async function updateSegment(
  id: string,
  data: Partial<Omit<SegmentDoc, "id" | "createdAt">>
): Promise<void> {
  await segmentsCol().doc(id).update({
    ...data,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function deleteSegment(id: string): Promise<void> {
  await segmentsCol().doc(id).delete();
}

/**
 * Caches the resolved count on the segment doc so the list view can show
 * "last resolved N matches" without re-running the resolver on every render.
 */
export async function cacheResolvedCount(id: string, count: number): Promise<void> {
  await segmentsCol().doc(id).update({
    lastResolvedCount: count,
    lastResolvedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Idempotency helper used by `scripts/seed-segments.ts`. Returns the first
 * segment whose `name` matches exactly (case-sensitive), or null.
 */
export async function findSegmentByName(
  name: string
): Promise<SegmentDoc | null> {
  const snap = await segmentsCol().where("name", "==", name).limit(1).get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as SegmentDoc;
}
