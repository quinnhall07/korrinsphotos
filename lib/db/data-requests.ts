// lib/db/data-requests.ts
// Phase 3.10 — GDPR / CCPA data-subject requests collection. One top-level
// collection `dataRequests/{id}` recording deletion, access, and portability
// requests submitted by clients (or by an admin on behalf of a client).
//
// The 30-day `dueBy` is set automatically in `createDataRequest` and is the
// regulatory deadline both GDPR Art. 12(3) and CCPA §1798.130(a)(2) impose.
// Overdue rows (status in {OPEN, IN_PROGRESS} AND dueBy <= now) surface on
// the compliance dashboard.
//
// Server-only — imports `adminDb`.

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export type DataRequestType = "DELETE" | "ACCESS" | "PORTABILITY";
export type DataRequestStatus = "OPEN" | "IN_PROGRESS" | "FULFILLED" | "REJECTED";

export const DATA_REQUEST_TYPE_LABELS: Record<DataRequestType, string> = {
  DELETE: "Right to erasure",
  ACCESS: "Right of access",
  PORTABILITY: "Right to portability",
};

export const DATA_REQUEST_STATUS_LABELS: Record<DataRequestStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  FULFILLED: "Fulfilled",
  REJECTED: "Rejected",
};

/** GDPR / CCPA fulfilment deadline in days from submission. */
export const DATA_REQUEST_DEADLINE_DAYS = 30;

export interface DataRequestDoc {
  id: string;
  type: DataRequestType;
  status: DataRequestStatus;
  subjectEmail: string;
  subjectClientId?: string | null;
  submittedAt: Timestamp;
  dueBy: Timestamp;
  fulfilledAt?: Timestamp | null;
  rejectedReason?: string | null;
  notes?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const dataRequestsCol = () => adminDb.collection("dataRequests");

export async function getDataRequest(id: string): Promise<DataRequestDoc | null> {
  const snap = await dataRequestsCol().doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as DataRequestDoc) : null;
}

/**
 * List all data-requests, newest first. Optionally filter by status.
 * Filtering is done in-process to avoid composite-index requirements.
 */
export async function listDataRequests(status?: DataRequestStatus): Promise<DataRequestDoc[]> {
  const snap = await dataRequestsCol()
    .orderBy("submittedAt", "desc")
    .limit(500)
    .get();
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DataRequestDoc));
  return status ? rows.filter((r) => r.status === status) : rows;
}

/**
 * Overdue = status in {OPEN, IN_PROGRESS} AND dueBy <= now.
 * Sorted by dueBy ascending so the most overdue surfaces first.
 */
export async function listOverdueDataRequests(now: Date = new Date()): Promise<DataRequestDoc[]> {
  const snap = await dataRequestsCol()
    .orderBy("submittedAt", "desc")
    .limit(500)
    .get();
  const cutoffMs = now.getTime();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as DataRequestDoc))
    .filter((r) => (r.status === "OPEN" || r.status === "IN_PROGRESS") && r.dueBy.toMillis() <= cutoffMs)
    .sort((a, b) => a.dueBy.toMillis() - b.dueBy.toMillis());
}

export interface CreateDataRequestInput {
  type: DataRequestType;
  subjectEmail: string;
  subjectClientId?: string | null;
  notes?: string | null;
  /** Optional override; defaults to `new Date()`. */
  submittedAt?: Date;
  /** Optional override; defaults to `submittedAt + DATA_REQUEST_DEADLINE_DAYS`. */
  dueBy?: Date;
  status?: DataRequestStatus;
}

export async function createDataRequest(input: CreateDataRequestInput): Promise<DataRequestDoc> {
  const submittedAtDate = input.submittedAt ?? new Date();
  const dueByDate =
    input.dueBy ??
    new Date(submittedAtDate.getTime() + DATA_REQUEST_DEADLINE_DAYS * 24 * 60 * 60 * 1000);

  const ref = dataRequestsCol().doc();
  const now = Timestamp.now();

  const doc = {
    type: input.type,
    status: input.status ?? "OPEN",
    subjectEmail: input.subjectEmail,
    subjectClientId: input.subjectClientId ?? null,
    submittedAt: Timestamp.fromDate(submittedAtDate),
    dueBy: Timestamp.fromDate(dueByDate),
    fulfilledAt: null,
    rejectedReason: null,
    notes: input.notes ?? null,
    createdAt: now,
    updatedAt: now,
  };

  await ref.set(doc);
  return { id: ref.id, ...doc } as DataRequestDoc;
}

export async function updateDataRequest(
  id: string,
  patch: Partial<Omit<DataRequestDoc, "id" | "createdAt">>
): Promise<void> {
  await dataRequestsCol()
    .doc(id)
    .update({ ...patch, updatedAt: FieldValue.serverTimestamp() });
}
