"use server";

import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/session";
import { FieldValue } from "firebase-admin/firestore";
import { addProjectMessage, projectMessagesCol } from "@/lib/db/projects";
import { logActivity } from "@/lib/db/activity";
import { enqueueTrackedMail } from "@/lib/email/tracking";

/**
 * Append an outbound message to projects/{id}/messages and enqueue an email
 * for the Firebase Trigger Email extension. First line is requireAdmin().
 */
export async function sendProjectMessage(
  projectId: string,
  body: string,
  subject?: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await requireAdmin();

  if (!projectId || !body?.trim()) {
    return { success: false, error: "Message body is required." };
  }

  try {
    const projectSnap = await adminDb.collection("projects").doc(projectId).get();
    if (!projectSnap.exists) return { success: false, error: "Project not found." };
    const project = projectSnap.data()!;

    const clientSnap = await adminDb.collection("clients").doc(project.clientId).get();
    const client = clientSnap.data();
    const clientEmail: string | undefined = client?.email;

    const finalSubject =
      subject?.trim() ||
      (project.title ? `Re: ${project.title}` : "An update from Korrin's Photography");

    // Persist the message in the project subcollection.
    const message = await addProjectMessage(projectId, {
      direction: "OUTBOUND",
      channel: "EMAIL",
      subject: finalSubject,
      body: body.trim(),
      adminUid: session.uid ?? null,
      isAutomatic: false,
    });

    // Bump lastContactedAt so the pipeline view reflects activity.
    await adminDb.collection("projects").doc(projectId).update({
      lastContactedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Enqueue the outbound email through the tracked-mail wrapper. The
    // returned sendId is persisted on the message subcollection doc so the
    // workspace can render "opened 2×, clicked link" engagement chips.
    if (clientEmail) {
      const safeBody = body
        .trim()
        .split(/\n\n+/)
        .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
        .join("");

      const { sendId } = await enqueueTrackedMail({
        to: clientEmail,
        subject: finalSubject,
        html: `${safeBody}<p style="margin-top:2rem;color:#8A8A85;font-size:0.85rem;">— Korrin's Photography</p>`,
        recipientClientId: project.clientId,
        projectId,
        sendKind: "project-message",
      });
      try {
        await projectMessagesCol(projectId).doc(message.id).update({ sendId });
      } catch (err) {
        console.error("[sendProjectMessage] failed to stamp sendId on message", { projectId, messageId: message.id, err });
      }
    }

    await logActivity(
      "EMAIL_SENT",
      `Email sent for project "${project.title ?? projectId}"`,
      { projectId, subject: finalSubject },
    ).catch(() => {});

    revalidatePath(`/admin/projects/${projectId}`);
    return { success: true };
  } catch (err) {
    console.error("sendProjectMessage error:", err);
    return { success: false, error: "Failed to send message." };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
