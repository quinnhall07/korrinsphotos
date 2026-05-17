"use server";

// app/admin/questionnaires/templates/actions.ts
// Server Actions for managing questionnaire templates. Mirrors the shape
// used by /admin/sequences/actions.ts. Every export starts with
// `await requireAdmin()` per repo convention.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { logActivity } from "@/lib/db/activity";
import { adminDb } from "@/lib/firebase-admin";
import { enqueueTrackedMail } from "@/lib/email/tracking";
import {
  createTemplate as dbCreateTemplate,
  updateTemplate as dbUpdateTemplate,
  getQuestionnaire,
  getTemplate,
  createQuestionnaire,
  markQuestionnaireSent,
  listQuestionnairesForProject,
  type QuestionnaireQuestion,
  type QuestionnaireTemplate,
} from "@/lib/db/questionnaires";
import { getProject } from "@/lib/db/projects";
import { getClient } from "@/lib/db/clients";

type ActionResult<T = void> =
  | (T extends void ? { success: true } : { success: true; data: T })
  | { success: false; error: string };

// ─── Form input shape (mirrored by TemplateEditor.tsx) ───────────────────────

export interface TemplateFormInput {
  name: string;
  sessionType: string;
  questions: QuestionnaireQuestion[];
}

function normaliseInput(
  input: TemplateFormInput
): Omit<QuestionnaireTemplate, "id" | "createdAt" | "updatedAt"> {
  const name = input.name?.trim() || "Untitled template";
  const sessionType = input.sessionType?.trim() || "Portrait";
  const questions: QuestionnaireQuestion[] = (input.questions ?? [])
    .filter((q) => q && q.id && q.label?.trim())
    .map((q) => ({
      id: q.id.trim(),
      type: q.type,
      label: q.label.trim(),
      ...(q.options && q.options.length
        ? { options: q.options.map((o) => o.trim()).filter(Boolean) }
        : {}),
      ...(q.required ? { required: true } : {}),
      ...(q.helpText?.trim() ? { helpText: q.helpText.trim() } : {}),
    }));

  return { name, sessionType, questions };
}

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createTemplateAction(
  input: TemplateFormInput
): Promise<void> {
  await requireAdmin();

  const data = normaliseInput(input);
  const created = await dbCreateTemplate(data);

  await logActivity(
    "NOTE_ADDED",
    `Questionnaire template created: ${data.name}`,
    { templateId: created.id }
  ).catch(() => {});

  revalidatePath("/admin/questionnaires/templates");
  redirect(`/admin/questionnaires/templates/${created.id}`);
}

// ─── Update ──────────────────────────────────────────────────────────────────

export async function updateTemplateAction(
  id: string,
  input: TemplateFormInput
): Promise<ActionResult> {
  await requireAdmin();
  try {
    const data = normaliseInput(input);
    await dbUpdateTemplate(id, data);

    await logActivity(
      "NOTE_ADDED",
      `Questionnaire template updated: ${data.name}`,
      { templateId: id }
    ).catch(() => {});

    revalidatePath("/admin/questionnaires/templates");
    revalidatePath(`/admin/questionnaires/templates/${id}`);
    return { success: true };
  } catch (err) {
    console.error("updateTemplateAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to save template.",
    };
  }
}

// ─── Send a questionnaire manually (from project workspace) ──────────────────

export async function sendQuestionnaireForProjectAction(
  projectId: string
): Promise<ActionResult<{ questionnaireId: string }>> {
  await requireAdmin();
  try {
    const project = await getProject(projectId);
    if (!project) return { success: false, error: "Project not found." };

    const client = await getClient(project.clientId);
    if (!client) return { success: false, error: "Client not found." };

    // Re-use any existing instance — don't double-issue.
    const existing = await listQuestionnairesForProject(projectId);
    let questionnaireId: string;
    if (existing.length > 0) {
      questionnaireId = existing[0].id;
      await markQuestionnaireSent(questionnaireId);
    } else {
      const tplSnap = await adminDb
        .collection("questionnaireTemplates")
        .where("sessionType", "==", project.sessionType)
        .limit(1)
        .get();
      if (tplSnap.empty) {
        return {
          success: false,
          error: `No questionnaire template for ${project.sessionType}. Create one in /admin/questionnaires/templates.`,
        };
      }
      const templateId = tplSnap.docs[0].id;
      const questionnaire = await createQuestionnaire({
        projectId,
        clientId: project.clientId,
        templateId,
      });
      questionnaireId = questionnaire.id;
      await markQuestionnaireSent(questionnaireId);
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
    const link = `${appUrl}/questionnaire/${questionnaireId}`;

    await enqueueTrackedMail({
      to: client.email,
      subject: `Questionnaire for your upcoming ${project.sessionType}`,
      text: `Please fill out your questionnaire: ${link}`,
      html: `<p>Hi ${client.firstName ?? "there"},</p><p>Please take a few minutes to fill out the questionnaire for your upcoming ${String(
        project.sessionType
      ).toLowerCase()}.</p><p><a href="${link}">${link}</a></p>`,
      recipientClientId: client.id,
      projectId,
      sendKind: "questionnaire-manual",
    });

    await logActivity(
      "EMAIL_SENT",
      `Questionnaire sent for project ${project.title}`,
      { projectId, questionnaireId }
    ).catch(() => {});

    revalidatePath(`/admin/projects/${projectId}`);
    return { success: true, data: { questionnaireId } };
  } catch (err) {
    console.error("sendQuestionnaireForProjectAction error:", err);
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to send questionnaire.",
    };
  }
}

// ─── Expose helpers re-export for the editor (read templates) ────────────────

export async function getTemplateForEdit(
  id: string
): Promise<QuestionnaireTemplate | null> {
  await requireAdmin();
  return getTemplate(id);
}

export async function getQuestionnaireSummary(id: string) {
  await requireAdmin();
  return getQuestionnaire(id);
}
