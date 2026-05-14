// lib/db/press-submissions.ts
// Wave 7 Phase 4.7 — per-project press submission tracker.
//
// Each row records a single submission of a project (e.g. a wedding gallery)
// to a publication (e.g. Carolina Bride, Junebug Weddings) and tracks the
// downstream lifecycle (acknowledgement, publication, rejection). Once a
// submission is PUBLISHED with a publishedUrl, the daily cron's monthly
// backlink monitor (`lib/domain/press-backlinks.ts`) sweeps the published
// articles to verify the links still resolve.
//
// Subcollection: `projects/{projectId}/pressSubmissions/{id}`.
//
// Composite index required: a collectionGroup query is used by
// `listAllPublishedSubmissionsForBacklinkCheck`. We intentionally keep the
// indexed-field count to 1 (`status == "PUBLISHED"`) and filter
// `publishedUrl != null` in memory to avoid the composite-index burden.

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PressSubmissionStatus =
  | "SUBMITTED"
  | "ACKNOWLEDGED"
  | "PUBLISHED"
  | "REJECTED"
  | "WITHDRAWN";

export interface PressSubmissionDoc {
  id: string;
  publicationName: string;
  /** Publication homepage (not the article — that's `publishedUrl`). */
  publicationUrl?: string;
  contactName?: string;
  contactEmail?: string;
  submittedAt: Timestamp;
  status: PressSubmissionStatus;
  statusChangedAt: Timestamp;
  /** Article URL once status === "PUBLISHED". */
  publishedUrl?: string;
  publishedAt?: Timestamp;

  // Backlink monitoring — filled by `lib/domain/press-backlinks.ts`.
  lastLinkCheckAt?: Timestamp;
  linkAlive?: boolean;
  linkLastHttpStatus?: number;
  consecutiveLinkFailures?: number;

  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Collection ref ──────────────────────────────────────────────────────────

export const pressSubmissionsCol = (projectId: string) =>
  adminDb.collection("projects").doc(projectId).collection("pressSubmissions");

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function getPressSubmission(
  projectId: string,
  id: string
): Promise<PressSubmissionDoc | null> {
  const snap = await pressSubmissionsCol(projectId).doc(id).get();
  return snap.exists
    ? ({ id: snap.id, ...snap.data() } as PressSubmissionDoc)
    : null;
}

export async function listPressSubmissionsForProject(
  projectId: string
): Promise<PressSubmissionDoc[]> {
  const snap = await pressSubmissionsCol(projectId)
    .orderBy("submittedAt", "desc")
    .get();
  return snap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as PressSubmissionDoc)
  );
}

/**
 * Cron-side reader for the monthly backlink monitor.
 *
 * Composite index required: collectionGroup("pressSubmissions") with status ASC + publishedUrl ASC
 *   (or use a single where + client-side filter on publishedUrl).
 *
 * We chose the **in-memory filter** path: fetch every row whose status is
 * `PUBLISHED` (single equality filter — no composite index needed), then
 * drop rows missing a `publishedUrl` client-side. At Korrin's scale the
 * PUBLISHED set is tiny (single-digit rows for the foreseeable future),
 * so the over-fetch is negligible and we save the index slot.
 */
export async function listAllPublishedSubmissionsForBacklinkCheck(): Promise<
  Array<{ projectId: string; submission: PressSubmissionDoc }>
> {
  const snap = await adminDb
    .collectionGroup("pressSubmissions")
    .where("status", "==", "PUBLISHED")
    .get();

  const out: Array<{ projectId: string; submission: PressSubmissionDoc }> = [];
  for (const d of snap.docs) {
    const data = d.data() as Omit<PressSubmissionDoc, "id">;
    if (!data.publishedUrl) continue;
    // Subcollection parent path: projects/{projectId}/pressSubmissions/{id}.
    // The doc ref's `parent.parent` is the project doc reference.
    const projectId = d.ref.parent.parent?.id;
    if (!projectId) continue;
    out.push({
      projectId,
      submission: { id: d.id, ...data } as PressSubmissionDoc,
    });
  }
  return out;
}

// ─── Writes ───────────────────────────────────────────────────────────────────

export async function createPressSubmission(
  projectId: string,
  input: {
    publicationName: string;
    publicationUrl?: string;
    contactName?: string;
    contactEmail?: string;
    submittedAt?: Date;
    status?: PressSubmissionStatus;
    publishedUrl?: string;
    publishedAt?: Date;
    notes?: string;
  }
): Promise<PressSubmissionDoc> {
  const ref = pressSubmissionsCol(projectId).doc();
  const now = Timestamp.now();
  const submittedAt = input.submittedAt
    ? Timestamp.fromDate(input.submittedAt)
    : now;
  const status: PressSubmissionStatus = input.status ?? "SUBMITTED";

  const data: Omit<PressSubmissionDoc, "id"> = {
    publicationName: input.publicationName.trim() || "Untitled publication",
    status,
    submittedAt,
    statusChangedAt: now,
    createdAt: now,
    updatedAt: now,
    ...(input.publicationUrl ? { publicationUrl: input.publicationUrl } : {}),
    ...(input.contactName ? { contactName: input.contactName } : {}),
    ...(input.contactEmail ? { contactEmail: input.contactEmail } : {}),
    ...(input.publishedUrl ? { publishedUrl: input.publishedUrl } : {}),
    ...(input.publishedAt
      ? { publishedAt: Timestamp.fromDate(input.publishedAt) }
      : {}),
    ...(input.notes ? { notes: input.notes } : {}),
  };

  await ref.set(data);
  return { id: ref.id, ...data } as PressSubmissionDoc;
}

/**
 * Patch a press-submission row. Auto-stamps `updatedAt` and, when `status`
 * is part of the patch, `statusChangedAt`. Pass `null` for an optional
 * field to clear it.
 */
export async function updatePressSubmission(
  projectId: string,
  id: string,
  patch: Partial<{
    publicationName: string;
    publicationUrl: string | null;
    contactName: string | null;
    contactEmail: string | null;
    submittedAt: Date;
    status: PressSubmissionStatus;
    publishedUrl: string | null;
    publishedAt: Date | null;
    notes: string | null;
    // Backlink-monitor fields — written by the cron sweep, exposed here so
    // the same `update` path can serve both UI edits and cron writes.
    lastLinkCheckAt: Date | null;
    linkAlive: boolean;
    linkLastHttpStatus: number;
    consecutiveLinkFailures: number;
  }>
): Promise<void> {
  const update: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  const setOrClear = (key: string, value: unknown, isDate = false) => {
    if (value === undefined) return;
    if (value === null) {
      update[key] = FieldValue.delete();
      return;
    }
    if (isDate && value instanceof Date) {
      update[key] = Timestamp.fromDate(value);
      return;
    }
    update[key] = value;
  };

  if (patch.publicationName !== undefined) {
    update.publicationName =
      patch.publicationName.trim() || "Untitled publication";
  }
  setOrClear("publicationUrl", patch.publicationUrl);
  setOrClear("contactName", patch.contactName);
  setOrClear("contactEmail", patch.contactEmail);
  if (patch.submittedAt !== undefined) {
    update.submittedAt = Timestamp.fromDate(patch.submittedAt);
  }
  if (patch.status !== undefined) {
    update.status = patch.status;
    update.statusChangedAt = FieldValue.serverTimestamp();
  }
  setOrClear("publishedUrl", patch.publishedUrl);
  setOrClear("publishedAt", patch.publishedAt, true);
  setOrClear("notes", patch.notes);
  setOrClear("lastLinkCheckAt", patch.lastLinkCheckAt, true);
  if (patch.linkAlive !== undefined) update.linkAlive = patch.linkAlive;
  if (patch.linkLastHttpStatus !== undefined) {
    update.linkLastHttpStatus = patch.linkLastHttpStatus;
  }
  if (patch.consecutiveLinkFailures !== undefined) {
    update.consecutiveLinkFailures = patch.consecutiveLinkFailures;
  }

  await pressSubmissionsCol(projectId).doc(id).update(update);
}

export async function deletePressSubmission(
  projectId: string,
  id: string
): Promise<void> {
  await pressSubmissionsCol(projectId).doc(id).delete();
}
