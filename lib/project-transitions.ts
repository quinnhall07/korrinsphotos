import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { ProjectStatus } from "./db/projects";
import { listSequencesByStatusTrigger } from "./db/sequences";
import { enrollInSequence } from "./db/sequence-enrollments";
import { applyReferralAttribution } from "./domain/referrals";
import {
  getEffectiveAutomationConfig,
  isRecipeEnabled,
  readNumberParam,
  type ResolvedAutomationConfig,
} from "./automations/recipes";

// Called when project status changes
export async function handleProjectTransition(projectId: string, fromStatus: ProjectStatus, toStatus: ProjectStatus) {
  if (fromStatus === toStatus) return;

  // Resolve the admin's automation overrides once per transition. Each
  // recipe hook below reads from this resolved map; missing keys fall
  // back to catalog defaults so transitions stay safe even if the
  // config doc is empty or corrupt.
  const automationConfig = await getEffectiveAutomationConfig();

  if (toStatus === "BOOKED") {
    await onProjectBooked(projectId, automationConfig);
  } else if (toStatus === "PROPOSAL_SENT") {
    await onProposalSent(projectId, automationConfig);
  } else if (toStatus === "CONTRACT_SENT") {
    await onContractSent(projectId, automationConfig);
  } else if (toStatus === "DEPOSIT_PENDING") {
    await onDepositPending(projectId, automationConfig);
  } else if (toStatus === "GALLERY_DELIVERED") {
    await onGalleryDelivered(projectId, automationConfig);
  }

  // Status-trigger sequence enrollment. Runs regardless of which status we
  // advanced into — every active STATUS_CHANGE sequence with a matching
  // triggerStatus gets its own enrollment. Each enrollment is wrapped in a
  // try/catch so one bad sequence cannot abort the transition.
  await enrollMatchingStatusSequences(projectId, toStatus);
}

async function enrollMatchingStatusSequences(
  projectId: string,
  toStatus: ProjectStatus
) {
  let sequences;
  try {
    sequences = await listSequencesByStatusTrigger(toStatus);
  } catch (err) {
    console.error("[enrollMatchingStatusSequences] Failed to list sequences", {
      projectId,
      toStatus,
      err,
    });
    return;
  }
  if (sequences.length === 0) return;

  let clientId: string | null = null;
  try {
    const projectSnap = await adminDb
      .collection("projects")
      .doc(projectId)
      .get();
    if (projectSnap.exists) {
      clientId = (projectSnap.data()?.clientId as string | undefined) ?? null;
    }
  } catch (err) {
    console.error("[enrollMatchingStatusSequences] Failed to load project", {
      projectId,
      err,
    });
    return;
  }
  if (!clientId) return;

  for (const sequence of sequences) {
    try {
      await enrollInSequence({
        sequenceId: sequence.id,
        clientId,
        projectId,
      });
    } catch (err) {
      console.error("[enrollMatchingStatusSequences] Enrollment failed", {
        projectId,
        sequenceId: sequence.id,
        err,
      });
    }
  }
}

async function onProjectBooked(
  projectId: string,
  automationConfig: ResolvedAutomationConfig
) {
  const projectSnap = await adminDb.collection("projects").doc(projectId).get();
  if (!projectSnap.exists) return;
  const project = projectSnap.data()!;
  
  const clientSnap = await adminDb.collection("clients").doc(project.clientId).get();
  if (!clientSnap.exists) return;
  const client = clientSnap.data()!;

  // 1. Auto-create Event (no manual step)
  const eventRef = adminDb.collection("events").doc();
  await eventRef.set({
    projectId: projectId,
    clientId: project.clientId,
    title: project.title,
    shootDate: project.shootDate,
    status: "UPCOMING",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // 2. Auto-grant client portal access
  // Resolve (or provision) the Firebase Auth user for this client so the
  // eventAccess doc is keyed by the real Auth UID — not the Firestore client
  // doc id. See ADR-009: `${userId}_${eventId}` where `userId` is the Auth UID.
  const displayName = `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim();
  let uid: string;
  try {
    const existing = await adminAuth.getUserByEmail(client.email);
    uid = existing.uid;
  } catch (err: any) {
    if (err?.code === "auth/user-not-found") {
      try {
        const created = await adminAuth.createUser({
          email: client.email,
          ...(displayName ? { displayName } : {}),
        });
        uid = created.uid;
      } catch (createErr) {
        console.error("[onProjectBooked] Failed to create Firebase Auth user", {
          projectId,
          clientId: project.clientId,
          email: client.email,
          error: createErr,
        });
        throw createErr;
      }
    } else {
      console.error("[onProjectBooked] Failed to resolve Firebase Auth user", {
        projectId,
        clientId: project.clientId,
        email: client.email,
        error: err,
      });
      throw err;
    }
  }

  // Upsert the users/{uid} mirror doc so the client can sign in as CLIENT.
  await adminDb.collection("users").doc(uid).set({
    email: client.email,
    role: "CLIENT",
    ...(displayName ? { displayName } : {}),
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  const accessId = `${uid}_${eventRef.id}`;
  await adminDb.collection("eventAccess").doc(accessId).set({
    userId: uid,
    eventId: eventRef.id,
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  // 3. Increment client's session count
  await adminDb.collection("clients").doc(project.clientId).update({
    totalSessionsBooked: FieldValue.increment(1),
  });

  // 3b. Tiered referral engine (Phase 4.4).
  //
  // If this client was attributed to a referrer at booking time, credit the
  // referrer now. `applyReferralAttribution` is idempotent — re-running the
  // BOOKED hook (Stripe retry, manual re-trigger) is safe. Best-effort: any
  // failure here must not abort the rest of the BOOKED transition.
  if (client.referredBy) {
    try {
      await applyReferralAttribution(client.referredBy as string, projectId);
    } catch (err) {
      console.error("[onProjectBooked] Referral attribution failed", {
        projectId,
        clientId: project.clientId,
        referredBy: client.referredBy,
        err,
      });
    }
  }

  // 4. Auto-send questionnaire (Placeholder for mail trigger) — gated.
  if (isRecipeEnabled(automationConfig, "auto_send_questionnaire")) {
    await adminDb.collection("mail").add({
      to: client.email,
      message: {
        subject: `Questionnaire for your upcoming ${project.sessionType}`,
        text: `Please fill out your questionnaire at /questionnaire/${projectId}`,
      },
      createdAt: FieldValue.serverTimestamp()
    });
  }

  // 4b. Auto-send welcome packet — placeholder body until the PDF
  // generator lands; toggle controls whether we send at all.
  if (isRecipeEnabled(automationConfig, "auto_send_welcome_packet")) {
    await adminDb.collection("mail").add({
      to: client.email,
      message: {
        subject: `Welcome — your ${project.sessionType} prep guide`,
        text: `Hi ${client.firstName ?? ""}, here's everything you need to prep for our shoot. (Welcome packet PDF coming soon.)`,
      },
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  // 5. Create balance invoice — gated. Roadmap (§1.9) targets
  // IN_EDITING for this; current behavior fires on BOOKED to maintain
  // backwards compatibility. Toggle covers both placements.
  if (
    isRecipeEnabled(automationConfig, "auto_create_balance_invoice") &&
    project.packagePriceUsd
  ) {
    const invoiceRef = adminDb.collection("invoices").doc();
    await invoiceRef.set({
      projectId,
      clientId: project.clientId,
      type: "BALANCE",
      status: "DRAFT",
      amountCents: (project.packagePriceUsd * 0.5) * 100, // Remaining 50%
      dueDate: project.shootDate ? new Date(project.shootDate.toMillis() - 14 * 24 * 60 * 60 * 1000) : null,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  // 6. Sneak-peek email N hours after the shoot. We schedule a task
  // here (at BOOKED) rather than at shoot time so it's always queued
  // ahead of the actual shoot. The cron worker (`/api/cron/run-tasks`)
  // will drain it on/after the scheduled runAt.
  if (
    isRecipeEnabled(automationConfig, "sneak_peek_drop_hours") &&
    project.shootDate
  ) {
    const delayHours = readNumberParam(
      automationConfig,
      "sneak_peek_drop_hours",
      "delay_hours",
      48
    );
    const shootMs =
      project.shootDate instanceof Timestamp
        ? project.shootDate.toMillis()
        : new Date(project.shootDate as unknown as string | number).getTime();
    const runAt = new Date(shootMs + delayHours * 60 * 60 * 1000);
    await adminDb.collection("scheduledTasks").add({
      type: "SNEAK_PEEK",
      projectId,
      clientId: project.clientId,
      runAt,
      status: "PENDING",
      createdAt: FieldValue.serverTimestamp(),
    });
  }
}

async function onProposalSent(
  projectId: string,
  automationConfig: ResolvedAutomationConfig
) {
  const projectSnap = await adminDb.collection("projects").doc(projectId).get();
  if (!projectSnap.exists) return;
  const project = projectSnap.data()!;

  // Create deposit invoice (DRAFT)
  if (project.packagePriceUsd) {
    const invoiceRef = adminDb.collection("invoices").doc();
    await invoiceRef.set({
      projectId,
      clientId: project.clientId,
      type: "DEPOSIT",
      status: "DRAFT",
      amountCents: (project.packagePriceUsd * 0.5) * 100, // 50% deposit
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Due in 7 days
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  // Auto follow-up nudge if proposal sits without movement.
  await maybeScheduleFollowUp(
    projectId,
    project.clientId,
    automationConfig,
    "auto_follow_up_proposal"
  );
}

async function onContractSent(
  projectId: string,
  automationConfig: ResolvedAutomationConfig
) {
  const projectSnap = await adminDb.collection("projects").doc(projectId).get();
  if (!projectSnap.exists) return;
  const project = projectSnap.data()!;

  await maybeScheduleFollowUp(
    projectId,
    project.clientId,
    automationConfig,
    "auto_follow_up_contract"
  );
}

async function onDepositPending(
  projectId: string,
  automationConfig: ResolvedAutomationConfig
) {
  const projectSnap = await adminDb.collection("projects").doc(projectId).get();
  if (!projectSnap.exists) return;
  const project = projectSnap.data()!;

  await maybeScheduleFollowUp(
    projectId,
    project.clientId,
    automationConfig,
    "auto_follow_up_deposit"
  );
}

async function onGalleryDelivered(
  projectId: string,
  automationConfig: ResolvedAutomationConfig
) {
  const projectSnap = await adminDb.collection("projects").doc(projectId).get();
  if (!projectSnap.exists) return;
  const project = projectSnap.data()!;

  // Send gallery notification email (handled elsewhere or by trigger)

  // Schedule referral email — gated + delay configurable.
  if (!isRecipeEnabled(automationConfig, "referral_send_after_delivery")) return;

  const delayDays = readNumberParam(
    automationConfig,
    "referral_send_after_delivery",
    "delay_days",
    7
  );
  const runAtDate = new Date();
  runAtDate.setDate(runAtDate.getDate() + delayDays);

  await adminDb.collection("scheduledTasks").add({
    type: "SEND_REFERRAL",
    projectId,
    clientId: project.clientId,
    runAt: runAtDate,
    status: "PENDING",
    createdAt: FieldValue.serverTimestamp()
  });
}

/**
 * Shared helper for the three auto-follow-up recipes. Each one queues a
 * single `AUTO_FOLLOW_UP` scheduled task with the configured delay.
 * The cron worker (`/api/cron/run-tasks`) processes the task type;
 * implementation of the actual nudge email lives there.
 */
async function maybeScheduleFollowUp(
  projectId: string,
  clientId: string,
  automationConfig: ResolvedAutomationConfig,
  recipeKey: string
) {
  if (!isRecipeEnabled(automationConfig, recipeKey)) return;
  const delayDays = readNumberParam(
    automationConfig,
    recipeKey,
    "delay_days",
    3
  );
  const runAt = new Date();
  runAt.setDate(runAt.getDate() + delayDays);

  await adminDb.collection("scheduledTasks").add({
    type: "AUTO_FOLLOW_UP",
    recipeKey,
    projectId,
    clientId,
    runAt,
    status: "PENDING",
    createdAt: FieldValue.serverTimestamp(),
  });
}
