"use server";

// app/portal/[projectId]/actions.ts
// Client-facing Server Actions for the /portal/[projectId] workspace.
//
// Auth model (mirrors page.tsx):
//   1. requireSession() — must be signed in.
//   2. Session email must match the email of clients/{project.clientId}.
// If either check fails the action returns { success: false, error }.
//
// The only mutation exposed here is `sendPortalMessage`, which:
//   - writes an INBOUND message to projects/{id}/messages
//   - queues an admin-notification email through enqueueTrackedMail
//   - drops a CLIENT_MESSAGE row into inboxItems so Korrin sees it in /admin/inbox

import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireSession } from "@/lib/session";
import { addProjectMessage } from "@/lib/db/projects";
import { createInboxItem } from "@/lib/db/inbox";
import { enqueueTrackedMail } from "@/lib/email/tracking";

function adminRecipients(): string[] {
  const fromList = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromList.length > 0) return fromList;
  if (process.env.ADMIN_EMAIL) return [process.env.ADMIN_EMAIL];
  return [];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * sendPortalMessage — write a client → admin INBOUND message and notify Korrin.
 *
 * Auth: verifies session.email matches clients/{clientId}.email for the
 * project. ADMIN sessions are also allowed to send so previews work.
 */
export async function sendPortalMessage(
  projectId: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  const session = await requireSession();

  const trimmed = (body ?? "").trim();
  if (!projectId || !trimmed) {
    return { success: false, error: "Message body is required." };
  }
  if (trimmed.length > 10_000) {
    return { success: false, error: "Message is too long." };
  }

  try {
    const projectSnap = await adminDb.collection("projects").doc(projectId).get();
    if (!projectSnap.exists) return { success: false, error: "Project not found." };
    const project = projectSnap.data()!;

    const clientId: string | undefined = project.clientId;
    if (!clientId) return { success: false, error: "Project is not linked to a client." };

    const clientSnap = await adminDb.collection("clients").doc(clientId).get();
    if (!clientSnap.exists) return { success: false, error: "Client record missing." };
    const client = clientSnap.data()!;
    const clientEmail: string = (client.email ?? "").toLowerCase();

    const isAdmin = session.role === "ADMIN";
    const sessionEmail = (session.email ?? "").toLowerCase();
    if (!isAdmin && (!sessionEmail || sessionEmail !== clientEmail)) {
      return { success: false, error: "You don't have access to this project." };
    }

    // Persist the inbound message in the project subcollection.
    const subject = project.title ? `Portal message: ${project.title}` : "Portal message";
    await addProjectMessage(projectId, {
      direction: "INBOUND",
      channel: "EMAIL",
      subject,
      body: trimmed,
      adminUid: null,
      isAutomatic: false,
    });

    // Bump lastRespondedAt so admin views reflect client activity.
    await adminDb.collection("projects").doc(projectId).update({
      lastRespondedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Surface the message in the unified inbox (best-effort).
    const senderName =
      `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim() || clientEmail || "Client";
    await createInboxItem({
      type: "CLIENT_MESSAGE",
      projectId,
      clientId,
      title: `New message from ${senderName}`,
      body: trimmed.slice(0, 500),
      link: `/admin/projects/${projectId}`,
      read: false,
    }).catch((err) => {
      console.error("[sendPortalMessage] inbox write failed", err);
    });

    // Notify Korrin via tracked email (best-effort — not blocking the write).
    const admins = adminRecipients();
    if (admins.length > 0) {
      const safeBody = trimmed
        .split(/\n\n+/)
        .map((p) => `<p style="margin:0 0 1rem 0;">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
        .join("");
      const html = `
        <div style="font-family:'Jost',sans-serif;color:#2A2A28;line-height:1.6;">
          <p style="font-size:0.65rem;letter-spacing:0.2em;text-transform:uppercase;color:#6B7845;margin:0 0 0.5rem 0;">Client portal message</p>
          <p style="margin:0 0 1.5rem 0;color:#4A4A47;">From <strong>${escapeHtml(senderName)}</strong> &lt;${escapeHtml(clientEmail)}&gt; — project "${escapeHtml(project.title ?? projectId)}"</p>
          <div style="border-left:2px solid #6B7845;padding-left:1rem;margin:0 0 1.5rem 0;">${safeBody}</div>
          <p style="margin:0;"><a href="${(process.env.NEXT_PUBLIC_APP_URL ?? "https://korrinsphotos.com").replace(/\/$/, "")}/admin/projects/${projectId}" style="color:#6B7845;">Reply in the admin workspace →</a></p>
        </div>`;
      for (const to of admins) {
        try {
          await enqueueTrackedMail({
            to,
            subject: `[Portal] ${senderName}: ${subject}`,
            html,
            projectId,
            recipientClientId: null,
            sendKind: "portal-message-notification",
          });
        } catch (err) {
          console.error("[sendPortalMessage] tracked-mail failed", { to, err });
        }
      }
    }

    revalidatePath(`/portal/${projectId}`);
    revalidatePath(`/admin/projects/${projectId}`);
    revalidatePath(`/admin/inbox`);
    return { success: true };
  } catch (err) {
    console.error("[sendPortalMessage] error:", err);
    return { success: false, error: "Failed to send message." };
  }
}
