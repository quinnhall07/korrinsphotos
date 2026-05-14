import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getSequence } from "./sequences";

export type EnrollmentStatus = "ACTIVE" | "COMPLETED" | "CANCELED" | "FAILED";

export interface SequenceEnrollmentDoc {
  id: string;
  sequenceId: string;
  clientId: string;
  projectId?: string | null;
  currentStep: number;
  status: EnrollmentStatus;
  nextRunAt: Timestamp | null;
  lastError?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const sequenceEnrollmentsCol = () =>
  adminDb.collection("sequenceEnrollments");

export async function enrollInSequence(args: {
  sequenceId: string;
  clientId: string;
  projectId?: string | null;
}): Promise<SequenceEnrollmentDoc> {
  const sequence = await getSequence(args.sequenceId);
  if (!sequence) {
    throw new Error(`Sequence ${args.sequenceId} not found`);
  }
  if (!sequence.active) {
    throw new Error(`Sequence ${args.sequenceId} is not active`);
  }
  if (!sequence.steps || sequence.steps.length === 0) {
    throw new Error(`Sequence ${args.sequenceId} has no steps`);
  }

  const firstStep = sequence.steps[0];
  const delayMs = Math.max(0, firstStep.delayHours) * 60 * 60 * 1000;
  const nextRunAt = Timestamp.fromMillis(Date.now() + delayMs);

  const ref = sequenceEnrollmentsCol().doc();
  const now = Timestamp.now();
  const fullData: Omit<SequenceEnrollmentDoc, "id"> = {
    sequenceId: args.sequenceId,
    clientId: args.clientId,
    projectId: args.projectId ?? null,
    currentStep: 0,
    status: "ACTIVE",
    nextRunAt,
    lastError: null,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(fullData);
  return { id: ref.id, ...fullData } as SequenceEnrollmentDoc;
}

export async function listDueEnrollments(
  now: Date
): Promise<SequenceEnrollmentDoc[]> {
  const cutoff = Timestamp.fromDate(now);
  const snap = await sequenceEnrollmentsCol()
    .where("status", "==", "ACTIVE")
    .where("nextRunAt", "<=", cutoff)
    .get();
  return snap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as SequenceEnrollmentDoc)
  );
}

export async function advanceEnrollment(
  id: string,
  args:
    | { nextRunAt: Timestamp; currentStep: number; completed?: false }
    | { completed: true }
): Promise<void> {
  if ("completed" in args && args.completed) {
    await sequenceEnrollmentsCol().doc(id).update({
      status: "COMPLETED",
      nextRunAt: null,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return;
  }
  // Narrowed: not the completed branch.
  const adv = args as { nextRunAt: Timestamp; currentStep: number };
  await sequenceEnrollmentsCol().doc(id).update({
    currentStep: adv.currentStep,
    nextRunAt: adv.nextRunAt,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function cancelEnrollment(id: string): Promise<void> {
  await sequenceEnrollmentsCol().doc(id).update({
    status: "CANCELED",
    nextRunAt: null,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function failEnrollment(
  id: string,
  reason: string
): Promise<void> {
  await sequenceEnrollmentsCol().doc(id).update({
    status: "FAILED",
    lastError: reason,
    nextRunAt: null,
    updatedAt: FieldValue.serverTimestamp(),
  });
}
