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
