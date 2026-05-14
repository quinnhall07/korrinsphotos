"use server";

// app/questionnaire/[id]/actions.ts
// Server Actions for the public questionnaire flow.
//
// NOTE: These actions are intentionally *unauthenticated*. The questionnaire
// id in the URL is the credential — same posture as the Firebase magic
// link. We refuse to overwrite an already-completed submission and we mark
// admin separately via a `mail/` notification (NOT toast-only) so Korrin
// sees responses land in her inbox.

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import {
  getQuestionnaire,
  getTemplate,
  submitQuestionnaire as dbSubmit,
} from "@/lib/db/questionnaires";
import { getProject } from "@/lib/db/projects";
import { getClient } from "@/lib/db/clients";

type ActionResult = { success: true } | { success: false; error: string };

const ADMIN_NOTIFICATION_EMAIL =
  process.env.ADMIN_EMAILS?.split(",")[0]?.trim() ||
  process.env.ADMIN_EMAIL ||
  "";

/**
 * Persist the client's responses, flip status to COMPLETED, and notify
 * admin. Does NOT call requireAdmin — the URL is the credential.
 */
export async function submitQuestionnaireAction(
  questionnaireId: string,
  responses: Record<string, unknown>
): Promise<ActionResult> {
  try {
    const questionnaire = await getQuestionnaire(questionnaireId);
    if (!questionnaire) {
      return { success: false, error: "Questionnaire not found." };
    }
    if (questionnaire.status === "COMPLETED") {
      return {
        success: false,
        error: "This questionnaire has already been submitted.",
      };
    }

    const sanitised = sanitiseResponses(responses);

    await dbSubmit(questionnaireId, sanitised);

    // Notify admin in the background — best-effort. The trigger email
    // extension picks it up out of `mail/`.
    if (ADMIN_NOTIFICATION_EMAIL) {
      try {
        const [project, client, template] = await Promise.all([
          getProject(questionnaire.projectId),
          getClient(questionnaire.clientId).catch(() => null),
          getTemplate(questionnaire.templateId).catch(() => null),
        ]);
        const projectTitle = project?.title ?? "Unknown project";
        const clientName = client
          ? `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim() ||
            client.email
          : "Unknown client";
        const templateName = template?.name ?? "Questionnaire";

        const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
        const projectUrl = `${appUrl}/admin/projects/${questionnaire.projectId}`;

        const responsesHtml = renderResponsesHtml(
          sanitised,
          template?.questions ?? []
        );

        await adminDb.collection("mail").add({
          to: ADMIN_NOTIFICATION_EMAIL,
          message: {
            subject: `Questionnaire submitted — ${clientName} (${projectTitle})`,
            html: `<p><strong>${clientName}</strong> just submitted "${templateName}" for <em>${projectTitle}</em>.</p>${responsesHtml}<p><a href="${projectUrl}">Open project in admin</a></p>`,
            text: `${clientName} submitted "${templateName}" for ${projectTitle}. Open: ${projectUrl}`,
          },
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch (notifyErr) {
        console.error(
          "[submitQuestionnaireAction] Admin notification failed",
          notifyErr
        );
      }
    }

    revalidatePath(`/questionnaire/${questionnaireId}`);
    revalidatePath(`/admin/projects/${questionnaire.projectId}`);

    return { success: true };
  } catch (err) {
    console.error("[submitQuestionnaireAction]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to submit.",
    };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sanitiseResponses(
  input: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input ?? {})) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      out[k] = v.map(String);
    } else if (typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
    } else if (v == null) {
      out[k] = null;
    } else {
      out[k] = String(v);
    }
  }
  return out;
}

function renderResponsesHtml(
  responses: Record<string, unknown>,
  questions: { id: string; label: string }[]
): string {
  const byId = new Map(questions.map((q) => [q.id, q.label] as const));
  const rows = Object.entries(responses).map(([id, val]) => {
    const label = byId.get(id) ?? id;
    const display = Array.isArray(val)
      ? val.join(", ")
      : val == null
      ? ""
      : String(val);
    return `<tr><th align="left" style="padding:4px 12px 4px 0;color:#6B7845;font-weight:500;">${escapeHtml(
      label
    )}</th><td style="padding:4px 0;">${escapeHtml(display)}</td></tr>`;
  });
  return `<table style="border-collapse:collapse;margin:1rem 0;">${rows.join(
    ""
  )}</table>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
