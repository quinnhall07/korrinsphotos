// lib/db/questionnaires.ts
// Persistence layer for the questionnaire engine (Phase 2.9).
//
// Two collections live here:
//   * questionnaireTemplates/{id} — reusable forms keyed by sessionType.
//   * questionnaires/{id}         — per-project instances issued to clients.
//
// Per CLAUDE.md > lib/db/CLAUDE.md, this module is server-only. Every
// helper goes through `adminDb`. Callers read/write via these helpers;
// no other file should touch the underlying collections directly.

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { SessionType } from "./projects";

// ─── Types ────────────────────────────────────────────────────────────────────

export type QuestionnaireQuestionType =
  | "text"
  | "longtext"
  | "multiselect"
  | "single"
  | "date"
  | "number";

export interface QuestionnaireQuestion {
  /** Stable per-template field id. Used as the response map key. */
  id: string;
  type: QuestionnaireQuestionType;
  label: string;
  /** Choices for `single` / `multiselect`. Required for those types. */
  options?: string[];
  required?: boolean;
  helpText?: string;
}

export interface QuestionnaireTemplate {
  id: string;
  name: string;
  /**
   * Matches `ProjectDoc.sessionType` for auto-dispatch on BOOKED. Free-form
   * string per the SessionType type — we don't constrain.
   */
  sessionType: SessionType;
  questions: QuestionnaireQuestion[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type QuestionnaireStatus = "PENDING" | "COMPLETED";

export interface QuestionnaireDoc {
  id: string;
  projectId: string;
  clientId: string;
  templateId: string;
  status: QuestionnaireStatus;
  /** Keys are `QuestionnaireQuestion.id` values; values are user-supplied. */
  responses: Record<string, unknown>;
  sentAt?: Timestamp | null;
  completedAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Collection refs (module-private getters) ────────────────────────────────

export const questionnaireTemplatesCol = () =>
  adminDb.collection("questionnaireTemplates");

export const questionnairesCol = () => adminDb.collection("questionnaires");

// ─── Templates ────────────────────────────────────────────────────────────────

export async function listTemplates(): Promise<QuestionnaireTemplate[]> {
  const snap = await questionnaireTemplatesCol()
    .orderBy("createdAt", "desc")
    .get();
  return snap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as QuestionnaireTemplate)
  );
}

export async function getTemplate(
  id: string
): Promise<QuestionnaireTemplate | null> {
  const snap = await questionnaireTemplatesCol().doc(id).get();
  return snap.exists
    ? ({ id: snap.id, ...snap.data() } as QuestionnaireTemplate)
    : null;
}

/**
 * Finds the first active template for the supplied sessionType. Used by the
 * BOOKED transition hook to pick a template automatically.
 */
export async function getTemplateBySessionType(
  sessionType: SessionType
): Promise<QuestionnaireTemplate | null> {
  const snap = await questionnaireTemplatesCol()
    .where("sessionType", "==", sessionType)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as QuestionnaireTemplate;
}

export async function createTemplate(
  data: Omit<QuestionnaireTemplate, "id" | "createdAt" | "updatedAt">
): Promise<QuestionnaireTemplate> {
  const ref = questionnaireTemplatesCol().doc();
  const now = Timestamp.now();
  const fullData = { ...data, createdAt: now, updatedAt: now };
  await ref.set(fullData);
  return { id: ref.id, ...fullData } as QuestionnaireTemplate;
}

export async function updateTemplate(
  id: string,
  data: Partial<Omit<QuestionnaireTemplate, "id" | "createdAt">>
): Promise<void> {
  await questionnaireTemplatesCol()
    .doc(id)
    .update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

/**
 * Idempotency helper used by the seed script. Returns the first template
 * whose `name` matches exactly (case-sensitive), or null.
 */
export async function findTemplateByName(
  name: string
): Promise<QuestionnaireTemplate | null> {
  const snap = await questionnaireTemplatesCol()
    .where("name", "==", name)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as QuestionnaireTemplate;
}

// ─── Per-project instances ────────────────────────────────────────────────────

export async function listQuestionnairesForProject(
  projectId: string
): Promise<QuestionnaireDoc[]> {
  const snap = await questionnairesCol()
    .where("projectId", "==", projectId)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as QuestionnaireDoc));
}

export async function getQuestionnaire(
  id: string
): Promise<QuestionnaireDoc | null> {
  const snap = await questionnairesCol().doc(id).get();
  return snap.exists
    ? ({ id: snap.id, ...snap.data() } as QuestionnaireDoc)
    : null;
}

export async function createQuestionnaire(
  data: Omit<
    QuestionnaireDoc,
    "id" | "createdAt" | "updatedAt" | "status" | "responses"
  > & {
    status?: QuestionnaireStatus;
    responses?: Record<string, unknown>;
  }
): Promise<QuestionnaireDoc> {
  const ref = questionnairesCol().doc();
  const now = Timestamp.now();
  const fullData: Omit<QuestionnaireDoc, "id"> = {
    projectId: data.projectId,
    clientId: data.clientId,
    templateId: data.templateId,
    status: data.status ?? "PENDING",
    responses: data.responses ?? {},
    sentAt: data.sentAt ?? null,
    completedAt: data.completedAt ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(fullData);
  return { id: ref.id, ...fullData } as QuestionnaireDoc;
}

/**
 * Writes responses, marks the questionnaire COMPLETED, and stamps
 * completedAt. Idempotent in the sense that re-submission overwrites — but
 * callers should refuse to write twice (see the public page).
 */
export async function submitQuestionnaire(
  id: string,
  responses: Record<string, unknown>
): Promise<void> {
  await questionnairesCol()
    .doc(id)
    .update({
      responses,
      status: "COMPLETED",
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
}

/**
 * Stamp `sentAt` when a questionnaire is dispatched to a client. Used by the
 * BOOKED hook and by the admin "Send" button on the project workspace.
 */
export async function markQuestionnaireSent(id: string): Promise<void> {
  await questionnairesCol().doc(id).update({
    sentAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}
