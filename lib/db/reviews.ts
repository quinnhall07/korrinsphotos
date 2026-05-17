// lib/db/reviews.ts
// Per-platform review request docs. One project that crosses the NPS gate
// (>= 4 stars) scheduling rotation fans out into exactly 3 docs — Google
// (T+0d), The Knot (T+7d), Facebook (T+14d). The cron worker drains every
// QUEUED doc with `scheduledFor <= now`, posts to `mail/`, and stamps the
// doc SENT. The click-tracker route bumps CLICKED. `status: SUBMITTED` is
// reserved for a future webhook from a review-platform API.

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export type ReviewPlatform = "GOOGLE" | "KNOT" | "FACEBOOK";

export type ReviewRequestStatus =
  | "QUEUED"
  | "SENT"
  | "CLICKED"
  | "SUBMITTED";

export interface ReviewRequestDoc {
  id: string;
  projectId: string;
  clientId: string;
  platform: ReviewPlatform;
  status: ReviewRequestStatus;
  scheduledFor: Timestamp;
  sentAt?: Timestamp;
  clickedAt?: Timestamp;
  submittedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const reviewRequestsCol = () => adminDb.collection("reviewRequests");

export async function getReviewRequest(
  id: string
): Promise<ReviewRequestDoc | null> {
  const snap = await reviewRequestsCol().doc(id).get();
  return snap.exists
    ? ({ id: snap.id, ...snap.data() } as ReviewRequestDoc)
    : null;
}

export async function listReviewRequestsForProject(
  projectId: string
): Promise<ReviewRequestDoc[]> {
  const snap = await reviewRequestsCol()
    .where("projectId", "==", projectId)
    .get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as ReviewRequestDoc))
    .sort((a, b) => {
      const am = a.scheduledFor?.toMillis?.() ?? 0;
      const bm = b.scheduledFor?.toMillis?.() ?? 0;
      return am - bm;
    });
}

export async function listDueReviewRequests(
  now: Date
): Promise<ReviewRequestDoc[]> {
  const snap = await reviewRequestsCol()
    .where("status", "==", "QUEUED")
    .where("scheduledFor", "<=", Timestamp.fromDate(now))
    .get();
  return snap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as ReviewRequestDoc)
  );
}

export async function createReviewRequest(
  data: Omit<ReviewRequestDoc, "id" | "createdAt" | "updatedAt">
): Promise<ReviewRequestDoc> {
  const ref = reviewRequestsCol().doc();
  const now = Timestamp.now();
  const full = { ...data, createdAt: now, updatedAt: now };
  await ref.set(full);
  return { id: ref.id, ...full } as ReviewRequestDoc;
}

export async function updateReviewRequest(
  id: string,
  data: Partial<Omit<ReviewRequestDoc, "id" | "createdAt" | "projectId" | "clientId">>
): Promise<void> {
  await reviewRequestsCol()
    .doc(id)
    .update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

/**
 * Idempotency guard: returns true if any review request already exists for
 * this project. The scheduler short-circuits when this returns true so a
 * project never accumulates more than the canonical 3 rotation docs.
 */
export async function hasAnyReviewRequestForProject(
  projectId: string
): Promise<boolean> {
  const snap = await reviewRequestsCol()
    .where("projectId", "==", projectId)
    .limit(1)
    .get();
  return !snap.empty;
}
