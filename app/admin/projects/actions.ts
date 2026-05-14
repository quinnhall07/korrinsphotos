"use server";

import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/session";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { ProjectStatus, StatusHistoryEntry } from "@/lib/db/projects";
import { handleProjectTransition } from "@/lib/project-transitions";
import { logActivity } from "@/lib/db/activity";

export async function updateProjectStatus(
  projectId: string,
  newStatus: ProjectStatus
): Promise<{ success: boolean; error?: string }> {
  const session = await requireAdmin();

  try {
    const doc = await adminDb.collection("projects").doc(projectId).get();
    if (!doc.exists) return { success: false, error: "Project not found" };

    const project = doc.data()!;
    const oldStatus = project.status as ProjectStatus;

    if (oldStatus === newStatus) return { success: true };

    const historyEntry: StatusHistoryEntry = {
      status: newStatus,
      at: Timestamp.now(),
      ...(session.uid ? { byUid: session.uid } : {}),
    };

    await adminDb.collection("projects").doc(projectId).update({
      status: newStatus,
      statusHistory: FieldValue.arrayUnion(historyEntry),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Handle lifecycle hooks
    await handleProjectTransition(projectId, oldStatus, newStatus);

    await logActivity(
      "STATUS_CHANGED",
      `Project "${project.title}" moved to ${newStatus.replace(/_/g, " ").toLowerCase()}`,
      { projectId, oldStatus, newStatus }
    ).catch(() => {});

    revalidatePath("/admin/projects");
    revalidatePath(`/admin/projects/${projectId}`);
    return { success: true };
  } catch (err) {
    console.error("updateProjectStatus error:", err);
    return { success: false, error: "Failed to update status." };
  }
}

export async function updateProjectDetails(
  projectId: string,
  updates: { notes?: string; estimatedValue?: number; packagePriceUsd?: number }
) {
  await requireAdmin();
  try {
    await adminDb.collection("projects").doc(projectId).update({
      ...updates,
      updatedAt: FieldValue.serverTimestamp()
    });
    revalidatePath(`/admin/projects/${projectId}`);
    return { success: true };
  } catch (err) {
    console.error(err);
    return { success: false, error: "Failed to update project" };
  }
}

/**
 * Bulk-archive a set of projects from the pipeline table view.
 *
 * Sets status: "ARCHIVED" and appends a statusHistory entry on each project
 * via a single batched write. Does NOT run handleProjectTransition (archive
 * is a terminal off-ramp with no lifecycle side effects).
 */
export async function bulkArchiveProjects(
  ids: string[]
): Promise<{ success: boolean; error?: string; archivedCount?: number }> {
  const session = await requireAdmin();

  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: false, error: "No projects selected." };
  }

  try {
    const batch = adminDb.batch();
    const historyEntry: StatusHistoryEntry = {
      status: "ARCHIVED" as ProjectStatus,
      at: Timestamp.now(),
      ...(session.uid ? { byUid: session.uid } : {}),
    };

    for (const id of ids) {
      const ref = adminDb.collection("projects").doc(id);
      batch.update(ref, {
        status: "ARCHIVED",
        statusHistory: FieldValue.arrayUnion(historyEntry),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();

    await logActivity(
      "STATUS_CHANGED",
      `Bulk archived ${ids.length} project${ids.length === 1 ? "" : "s"}`,
      { projectIds: ids, newStatus: "ARCHIVED" }
    ).catch(() => {});

    revalidatePath("/admin/projects");
    return { success: true, archivedCount: ids.length };
  } catch (err) {
    console.error("bulkArchiveProjects error:", err);
    return { success: false, error: "Failed to archive projects." };
  }
}

/**
 * Archive a single project from the workspace header. Terminal off-ramp,
 * no lifecycle hook is fired (mirrors bulkArchiveProjects behaviour).
 */
export async function archiveProject(
  projectId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await requireAdmin();

  if (!projectId) return { success: false, error: "Missing project id." };

  try {
    const ref = adminDb.collection("projects").doc(projectId);
    const snap = await ref.get();
    if (!snap.exists) return { success: false, error: "Project not found." };

    const historyEntry: StatusHistoryEntry = {
      status: "ARCHIVED" as ProjectStatus,
      at: Timestamp.now(),
      ...(session.uid ? { byUid: session.uid } : {}),
    };

    await ref.update({
      status: "ARCHIVED",
      statusHistory: FieldValue.arrayUnion(historyEntry),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await logActivity(
      "STATUS_CHANGED",
      `Archived project "${snap.data()?.title ?? projectId}"`,
      { projectId, newStatus: "ARCHIVED" },
    ).catch(() => {});

    revalidatePath("/admin/projects");
    revalidatePath(`/admin/projects/${projectId}`);
    return { success: true };
  } catch (err) {
    console.error("archiveProject error:", err);
    return { success: false, error: "Failed to archive project." };
  }
}
