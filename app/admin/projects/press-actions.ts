"use server";

// Wave 7 Phase 4.7 — Server Actions for the per-project press-submission
// tracker. Co-located with `actions.ts` / `contract-actions.ts` /
// `invoice-actions.ts`. Every mutation guards with `requireAdmin()` and
// revalidates `/admin/projects/[id]`.

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import {
  createPressSubmission,
  updatePressSubmission,
  deletePressSubmission,
  type PressSubmissionStatus,
} from "@/lib/db/press-submissions";
import { logActivity } from "@/lib/db/activity";

const STATUSES: PressSubmissionStatus[] = [
  "SUBMITTED",
  "ACKNOWLEDGED",
  "PUBLISHED",
  "REJECTED",
  "WITHDRAWN",
];

function isStatus(value: unknown): value is PressSubmissionStatus {
  return typeof value === "string" && STATUSES.includes(value as PressSubmissionStatus);
}

function toDateOrUndefined(iso: string | null | undefined): Date | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function toDateOrNull(
  iso: string | null | undefined
): Date | null | undefined {
  if (iso === undefined) return undefined;
  if (iso === null || iso === "") return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export interface CreatePressSubmissionInput {
  publicationName: string;
  publicationUrl?: string;
  contactName?: string;
  contactEmail?: string;
  /** ISO date string. Defaults to "now" server-side if absent. */
  submittedAt?: string;
  status?: PressSubmissionStatus;
  publishedUrl?: string;
  publishedAt?: string;
  notes?: string;
}

export async function createPressSubmissionAction(
  projectId: string,
  input: CreatePressSubmissionInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  await requireAdmin();
  if (!projectId) return { success: false, error: "Missing project id." };
  if (!input?.publicationName?.trim()) {
    return { success: false, error: "Publication name is required." };
  }
  if (input.status !== undefined && !isStatus(input.status)) {
    return { success: false, error: "Invalid status." };
  }
  try {
    const created = await createPressSubmission(projectId, {
      publicationName: input.publicationName,
      publicationUrl: input.publicationUrl?.trim() || undefined,
      contactName: input.contactName?.trim() || undefined,
      contactEmail: input.contactEmail?.trim() || undefined,
      submittedAt: toDateOrUndefined(input.submittedAt),
      status: input.status,
      publishedUrl: input.publishedUrl?.trim() || undefined,
      publishedAt: toDateOrUndefined(input.publishedAt),
      notes: input.notes?.trim() || undefined,
    });

    await logActivity(
      "NOTE_ADDED",
      `Press submission logged: ${created.publicationName}`,
      { projectId, pressSubmissionId: created.id, status: created.status }
    ).catch(() => {});

    revalidatePath(`/admin/projects/${projectId}`);
    return { success: true, id: created.id };
  } catch (err) {
    console.error("createPressSubmissionAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create submission.",
    };
  }
}

export interface UpdatePressSubmissionInput {
  publicationName?: string;
  publicationUrl?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  /** ISO date string. */
  submittedAt?: string;
  status?: PressSubmissionStatus;
  publishedUrl?: string | null;
  publishedAt?: string | null;
  notes?: string | null;
}

export async function updatePressSubmissionAction(
  projectId: string,
  id: string,
  patch: UpdatePressSubmissionInput
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  if (!projectId || !id) {
    return { success: false, error: "Missing identifiers." };
  }
  if (patch.status !== undefined && !isStatus(patch.status)) {
    return { success: false, error: "Invalid status." };
  }
  try {
    const submittedAt = toDateOrUndefined(patch.submittedAt);
    const publishedAt = toDateOrNull(patch.publishedAt);

    await updatePressSubmission(projectId, id, {
      ...(patch.publicationName !== undefined
        ? { publicationName: patch.publicationName }
        : {}),
      ...(patch.publicationUrl !== undefined
        ? {
            publicationUrl:
              patch.publicationUrl === null || patch.publicationUrl === ""
                ? null
                : patch.publicationUrl.trim(),
          }
        : {}),
      ...(patch.contactName !== undefined
        ? {
            contactName:
              patch.contactName === null || patch.contactName === ""
                ? null
                : patch.contactName.trim(),
          }
        : {}),
      ...(patch.contactEmail !== undefined
        ? {
            contactEmail:
              patch.contactEmail === null || patch.contactEmail === ""
                ? null
                : patch.contactEmail.trim(),
          }
        : {}),
      ...(submittedAt ? { submittedAt } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.publishedUrl !== undefined
        ? {
            publishedUrl:
              patch.publishedUrl === null || patch.publishedUrl === ""
                ? null
                : patch.publishedUrl.trim(),
          }
        : {}),
      ...(publishedAt !== undefined ? { publishedAt } : {}),
      ...(patch.notes !== undefined
        ? {
            notes:
              patch.notes === null || patch.notes === ""
                ? null
                : patch.notes.trim(),
          }
        : {}),
    });

    revalidatePath(`/admin/projects/${projectId}`);
    return { success: true };
  } catch (err) {
    console.error("updatePressSubmissionAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update submission.",
    };
  }
}

export async function deletePressSubmissionAction(
  projectId: string,
  id: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  if (!projectId || !id) {
    return { success: false, error: "Missing identifiers." };
  }
  try {
    await deletePressSubmission(projectId, id);
    revalidatePath(`/admin/projects/${projectId}`);
    return { success: true };
  } catch (err) {
    console.error("deletePressSubmissionAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete submission.",
    };
  }
}
