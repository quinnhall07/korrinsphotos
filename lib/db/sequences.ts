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
