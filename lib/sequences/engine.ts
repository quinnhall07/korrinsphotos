import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { enqueueTrackedMail } from "@/lib/email/tracking";
import {
  getSequence,
  type SequenceDoc,
  type SequencePredicate,
  type SequenceStep,
} from "@/lib/db/sequences";
import {
  advanceEnrollment,
  cancelEnrollment,
  failEnrollment,
  listDueEnrollments,
  type SequenceEnrollmentDoc,
} from "@/lib/db/sequence-enrollments";
import { getProject, type ProjectDoc } from "@/lib/db/projects";
import { getClient, type ClientDoc } from "@/lib/db/clients";

export interface RunDueSequencesResult {
  processed: number;
  completed: number;
  canceled: number;
  failed: number;
  advanced: number;
}

/**
 * Evaluate a sequence step predicate against the current project + client.
 * - Undefined predicate → passes.
 * - status: passes if project.status is in the allow list (project required).
 * - tagsInclude: passes if every required tag is present on project.tags.
 * - tagsExclude: passes if none of the excluded tags are present on project.tags.
 * - clientLifecycleStage: passes if client.lifecycleStage is in the allow list.
 *   If the field is missing/undefined on the client, the check passes (best-effort).
 */
export function evaluatePredicate(
  predicate: SequencePredicate | null | undefined,
  ctx: { project?: ProjectDoc | null; client?: ClientDoc | null }
): boolean {
  if (!predicate) return true;

  if (predicate.status && predicate.status.length > 0) {
    if (!ctx.project) return false;
    if (!predicate.status.includes(ctx.project.status)) return false;
  }

  if (predicate.tagsInclude && predicate.tagsInclude.length > 0) {
    const tags = ctx.project?.tags ?? [];
    for (const required of predicate.tagsInclude) {
      if (!tags.includes(required)) return false;
    }
  }

  if (predicate.tagsExclude && predicate.tagsExclude.length > 0) {
    const tags = ctx.project?.tags ?? [];
    for (const banned of predicate.tagsExclude) {
      if (tags.includes(banned)) return false;
    }
  }

  if (
    predicate.clientLifecycleStage &&
    predicate.clientLifecycleStage.length > 0
  ) {
    const stage = ctx.client?.lifecycleStage;
    // Best-effort: if client has no lifecycleStage yet, do not block.
    if (stage && !predicate.clientLifecycleStage.includes(stage)) {
      return false;
    }
  }

  return true;
}

async function dispatchStep(args: {
  step: SequenceStep;
  sequence: SequenceDoc;
  stepIndex: number;
  client: ClientDoc | null;
  enrollment: SequenceEnrollmentDoc;
}): Promise<void> {
  const { step, sequence, stepIndex, client, enrollment } = args;
  const recipient = client?.email ?? null;
  if (!recipient) {
    throw new Error("No recipient email on client");
  }

  if (step.channel === "EMAIL") {
    await enqueueTrackedMail({
      to: recipient,
      subject: `Sequence step ${stepIndex + 1} from ${sequence.name}`,
      html: `<p>Template: ${step.templateId}</p>`,
      recipientClientId: enrollment.clientId,
      projectId: enrollment.projectId ?? null,
      sendKind: `sequence:${sequence.id}`,
    });
    return;
  }

  if (step.channel === "SMS") {
    // SMS provider integration is Phase 6. We only need the queue collection
    // to exist so downstream wiring has somewhere to drain from.
    await adminDb.collection("sms").add({
      to: recipient,
      message: {
        subject: `Sequence step ${stepIndex + 1} from ${sequence.name}`,
        body: `Template: ${step.templateId}`,
      },
      createdAt: FieldValue.serverTimestamp(),
    });
    return;
  }
}

async function processEnrollment(
  enrollment: SequenceEnrollmentDoc,
  result: RunDueSequencesResult
): Promise<void> {
  result.processed++;

  let sequence: SequenceDoc | null;
  try {
    sequence = await getSequence(enrollment.sequenceId);
  } catch (err) {
    await failEnrollment(
      enrollment.id,
      `Failed to load sequence: ${(err as Error).message}`
    );
    result.failed++;
    return;
  }

  if (!sequence) {
    await failEnrollment(enrollment.id, "Sequence not found");
    result.failed++;
    return;
  }

  if (!sequence.active) {
    await cancelEnrollment(enrollment.id);
    result.canceled++;
    return;
  }

  const stepIndex = enrollment.currentStep;
  const step = sequence.steps?.[stepIndex];
  if (!step) {
    // Already past the last step — mark completed.
    await advanceEnrollment(enrollment.id, { completed: true });
    result.completed++;
    return;
  }

  // Load context for predicate + dispatch.
  let project: ProjectDoc | null = null;
  let client: ClientDoc | null = null;
  try {
    if (enrollment.projectId) {
      project = await getProject(enrollment.projectId);
    }
    client = await getClient(enrollment.clientId);
  } catch (err) {
    await failEnrollment(
      enrollment.id,
      `Failed to load context: ${(err as Error).message}`
    );
    result.failed++;
    return;
  }

  // Evaluate predicate (cancel on fail).
  const passes = evaluatePredicate(step.conditionPredicate ?? null, {
    project,
    client,
  });
  if (!passes) {
    await cancelEnrollment(enrollment.id);
    result.canceled++;
    return;
  }

  // Dispatch.
  try {
    await dispatchStep({ step, sequence, stepIndex, client, enrollment });
  } catch (err) {
    await failEnrollment(
      enrollment.id,
      `Dispatch failed: ${(err as Error).message}`
    );
    result.failed++;
    return;
  }

  // Advance.
  const nextIndex = stepIndex + 1;
  if (nextIndex >= sequence.steps.length) {
    await advanceEnrollment(enrollment.id, { completed: true });
    result.completed++;
    return;
  }

  const nextStep = sequence.steps[nextIndex];
  const delayMs = Math.max(0, nextStep.delayHours) * 60 * 60 * 1000;
  const nextRunAt = Timestamp.fromMillis(Date.now() + delayMs);
  await advanceEnrollment(enrollment.id, {
    currentStep: nextIndex,
    nextRunAt,
  });
  result.advanced++;
}

/**
 * One-pass runner. Loads every ACTIVE enrollment with nextRunAt <= now,
 * evaluates the current step's predicate, dispatches via mail/ or sms/,
 * then advances or completes the enrollment.
 *
 * Errors are caught per-enrollment so one bad row cannot poison the run.
 */
export async function runDueSequences(
  now: Date
): Promise<RunDueSequencesResult> {
  const result: RunDueSequencesResult = {
    processed: 0,
    completed: 0,
    canceled: 0,
    failed: 0,
    advanced: 0,
  };

  let due: SequenceEnrollmentDoc[];
  try {
    due = await listDueEnrollments(now);
  } catch (err) {
    console.error("[runDueSequences] Failed to list due enrollments", err);
    return result;
  }

  for (const enrollment of due) {
    try {
      await processEnrollment(enrollment, result);
    } catch (err) {
      // Last-resort safety net — try to mark FAILED, swallow any further error.
      console.error(
        "[runDueSequences] Unhandled error processing enrollment",
        enrollment.id,
        err
      );
      try {
        await failEnrollment(
          enrollment.id,
          `Unhandled: ${(err as Error).message}`
        );
        result.failed++;
      } catch {
        // Give up on this row; the next cron pass will retry.
      }
    }
  }

  return result;
}
