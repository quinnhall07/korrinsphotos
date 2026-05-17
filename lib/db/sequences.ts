import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { ProjectStatus } from "./projects";

export type SequenceChannel = "EMAIL" | "SMS";

export type SequenceTrigger =
  | "MANUAL"
  | "STATUS_CHANGE"
  | "DATE_RELATIVE_TO_SHOOT"
  | "BOOKING_CREATED"
  | "GALLERY_DELIVERED";

export interface SequencePredicate {
  status?: ProjectStatus[];
  tagsInclude?: string[];
  tagsExclude?: string[];
  clientLifecycleStage?: string[];
}

export interface SequenceStep {
  delayHours: number;
  channel: SequenceChannel;
  templateId: string;
  conditionPredicate?: SequencePredicate | null;
}

export interface SequenceDoc {
  id: string;
  name: string;
  description?: string;
  trigger: SequenceTrigger;
  triggerStatus?: ProjectStatus | null;
  dateAnchor?: "shootDate" | "deliveredAt" | null;
  active: boolean;
  steps: SequenceStep[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const sequencesCol = () => adminDb.collection("sequences");

export async function getSequence(id: string): Promise<SequenceDoc | null> {
  const snap = await sequencesCol().doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as SequenceDoc) : null;
}

export async function listSequences(
  opts: { activeOnly?: boolean } = {}
): Promise<SequenceDoc[]> {
  let query = sequencesCol().orderBy("createdAt", "desc") as FirebaseFirestore.Query;
  if (opts.activeOnly) query = query.where("active", "==", true);
  const snap = await query.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SequenceDoc));
}

export async function createSequence(
  data: Omit<SequenceDoc, "id" | "createdAt" | "updatedAt">
): Promise<SequenceDoc> {
  const ref = sequencesCol().doc();
  const now = Timestamp.now();
  const fullData = { ...data, createdAt: now, updatedAt: now };
  await ref.set(fullData);
  return { id: ref.id, ...fullData } as SequenceDoc;
}

export async function updateSequence(
  id: string,
  data: Partial<Omit<SequenceDoc, "id" | "createdAt">>
): Promise<void> {
  await sequencesCol()
    .doc(id)
    .update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

export async function deactivateSequence(id: string): Promise<void> {
  await sequencesCol()
    .doc(id)
    .update({ active: false, updatedAt: FieldValue.serverTimestamp() });
}

/**
 * Returns every active sequence whose trigger is STATUS_CHANGE and whose
 * triggerStatus matches the supplied status. Used by the status-trigger hook
 * in `lib/project-transitions.ts` to fan enrollments out on every status
 * advance — keeping the composite Firestore query inside the db layer.
 */
export async function listSequencesByStatusTrigger(
  status: ProjectStatus
): Promise<SequenceDoc[]> {
  const snap = await sequencesCol()
    .where("trigger", "==", "STATUS_CHANGE")
    .where("triggerStatus", "==", status)
    .where("active", "==", true)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SequenceDoc));
}

/**
 * Idempotency helper used by the seed script. Returns the first sequence
 * whose `name` matches exactly (case-sensitive), or null.
 */
export async function findSequenceByName(
  name: string
): Promise<SequenceDoc | null> {
  const snap = await sequencesCol().where("name", "==", name).limit(1).get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as SequenceDoc;
}
