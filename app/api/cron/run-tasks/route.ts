import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { runDueSequences } from "@/lib/sequences/engine";
import { dispatchPendingReviewRequests } from "@/lib/domain/reviews";
import { NextResponse } from "next/server";
import { createInboxItem } from "@/lib/db/inbox";
import { addProjectMessage } from "@/lib/db/projects";
import { buildCdnUrl } from "@/lib/storage/images";
import { enqueueTrackedMail } from "@/lib/email/tracking";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const now = new Date();
    const tasksSnap = await adminDb
      .collection("scheduledTasks")
      .where("status", "==", "PENDING")
      .where("runAt", "<=", now)
      .get();

    let processedCount = 0;

    for (const doc of tasksSnap.docs) {
      const task = doc.data();

      if (task.type === "SEND_REFERRAL") {
        const clientSnap = await adminDb.collection("clients").doc(task.clientId).get();
        if (clientSnap.exists) {
          const client = clientSnap.data()!;
          const referralLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://korrinsphotos.com'}/booking?ref=${client.referralCode}`;

          await enqueueTrackedMail({
            to: client.email,
            subject: "Share your love for Korrin's Photography & Earn $150!",
            html: `<p>Hi ${client.firstName},</p>
                   <p>I hope you are loving your photos! If you have a friend who might also like a session, share this link:</p>
                   <p><a href="${referralLink}">${referralLink}</a></p>
                   <p>If they book, you'll earn $150 in credit towards your next session!</p>
                   <p>Best,<br/>Korrin</p>`,
            recipientClientId: task.clientId,
            projectId: task.projectId ?? null,
            sendKind: "referral",
          });
        }
      }

      // Auto-Follow-Ups: dispatch by `recipeKey` to pick the correct nudge
      // template (proposal vs contract vs deposit). Legacy tasks queued before
      // recipeKey existed only handled the CONTRACT_SENT case, so a missing
      // recipeKey falls back to `expectedStatus` (if ever set) and ultimately
      // to the contract-sent path for safety.
      if (task.type === "AUTO_FOLLOW_UP") {
        try {
          await dispatchAutoFollowUp(task);
        } catch (err) {
          console.error("[cron] AUTO_FOLLOW_UP failed", doc.id, err);
        }
      }

      // SNEAK_PEEK: email the client 3–5 low-res preview photos N hours
      // (default 48) after `shootDate`. Scheduled at BOOKED by
      // `lib/project-transitions.ts > onProjectBooked` using
      // `shootDate + delayHours` for runAt — see Phase 2.10 of the
      // business-dashboard-roadmap. Side effects (skipReason write,
      // sneakPeekSentAt idempotency guard, message log) are owned by
      // `runSneakPeek` and merge into the COMPLETED update below.
      if (task.type === "SNEAK_PEEK") {
        try {
          await runSneakPeek(doc.id, doc.ref, task);
        } catch (err) {
          console.error("[cron] SNEAK_PEEK failed", doc.id, err);
        }
      }

      await doc.ref.update({ status: "COMPLETED", completedAt: new Date() });
      processedCount++;

      // Phase 1.3: surface completed cron task in the admin inbox (best-effort).
      await createInboxItem({
        type: "TASK_FIRED",
        projectId: task.projectId ?? null,
        clientId: task.clientId ?? null,
        title: `Automation fired: ${String(task.type ?? "TASK")}`,
        body: `Scheduled task ${doc.id} completed.`,
        link: task.projectId ? `/admin/projects/${task.projectId}` : null,
        read: false,
      }).catch(() => {});
    }

    // Phase 4.2: drain due sequence enrollments. Per-enrollment errors are
    // already caught inside runDueSequences, so a bad row cannot poison the
    // existing scheduledTasks behavior.
    let sequenceEnrollmentsProcessed = 0;
    try {
      const seqResult = await runDueSequences(now);
      sequenceEnrollmentsProcessed = seqResult.processed;
    } catch (seqErr) {
      console.error("Sequence engine error:", seqErr);
    }

    // Phase 4.6: drain due review requests (Google → Knot → Facebook
    // rotation, scheduled by `maybeScheduleReviewRequests` once a project
    // crosses clientNps >= 4). Per-row errors are caught inside the
    // dispatcher so one bad doc cannot poison the batch.
    let reviewRequestsProcessed = 0;
    let reviewRequestsSent = 0;
    try {
      const reviewResult = await dispatchPendingReviewRequests(now);
      reviewRequestsProcessed = reviewResult.processed;
      reviewRequestsSent = reviewResult.sent;
    } catch (reviewErr) {
      console.error("Review request dispatch error:", reviewErr);
    }

    return NextResponse.json({
      success: true,
      processed: processedCount,
      sequenceEnrollmentsProcessed,
      reviewRequestsProcessed,
      reviewRequestsSent,
    });
  } catch (err) {
    console.error("Cron Error:", err);
    return NextResponse.json({ success: false, error: "Cron Failed" }, { status: 500 });
  }
}

/**
 * Resolve which follow-up template to send. New tasks carry `recipeKey`
 * (e.g. `auto_follow_up_proposal`); legacy tasks may carry `expectedStatus`
 * (e.g. `PROPOSAL_SENT`); anything else defaults to the contract nudge.
 */
async function dispatchAutoFollowUp(task: FirebaseFirestore.DocumentData): Promise<void> {
  const recipeKey: string | undefined = task.recipeKey;
  const expectedStatus: string | undefined = task.expectedStatus;

  // Map recipeKey first, then fall through to expectedStatus for legacy rows.
  let resolved: "proposal" | "contract" | "deposit" = "contract";
  if (recipeKey === "auto_follow_up_proposal") resolved = "proposal";
  else if (recipeKey === "auto_follow_up_contract") resolved = "contract";
  else if (recipeKey === "auto_follow_up_deposit") resolved = "deposit";
  else if (!recipeKey && expectedStatus === "PROPOSAL_SENT") resolved = "proposal";
  else if (!recipeKey && expectedStatus === "DEPOSIT_PENDING") resolved = "deposit";

  if (resolved === "proposal") return sendProposalSentFollowUp(task);
  if (resolved === "deposit") return sendDepositPendingFollowUp(task);
  return sendContractSentFollowUp(task);
}

/**
 * Emit a "please sign your contract" nudge when a CONTRACT_SENT project has
 * sat too long. The cron task pre-resolves `projectId` and we look up the
 * most recent contract live, so the email always carries the freshest
 * signing token (Phase 1.7 URL shape: `/sign-contract/{id}?t={token}`).
 *
 * Silently skips if:
 *   - no projectId
 *   - project not in CONTRACT_SENT
 *   - no contract on file, or contract status !== SENT
 *   - signing token missing or expired (admin will need to resend)
 *   - client has no email
 */
async function sendContractSentFollowUp(task: FirebaseFirestore.DocumentData): Promise<void> {
  const projectId: string | undefined = task.projectId;
  if (!projectId) return;

  const projectSnap = await adminDb.collection("projects").doc(projectId).get();
  if (!projectSnap.exists) return;
  const project = projectSnap.data()!;
  if (project.status !== "CONTRACT_SENT") return;

  const contractsSnap = await adminDb
    .collection("contracts")
    .where("projectId", "==", projectId)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();
  if (contractsSnap.empty) return;

  const contractDoc = contractsSnap.docs[0];
  const contract = contractDoc.data();
  if (contract.status !== "SENT") return;
  const token: string | undefined = contract.signingToken ?? undefined;
  if (!token) return;
  if (contract.tokenExpiresAt?.toMillis && contract.tokenExpiresAt.toMillis() < Date.now()) {
    return;
  }

  const clientSnap = await adminDb.collection("clients").doc(project.clientId).get();
  const client = clientSnap.data();
  const clientEmail: string | undefined = client?.email;
  if (!clientEmail) return;

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://korrinsphotos.com").replace(/\/$/, "");
  const signUrl = `${appUrl}/sign-contract/${contractDoc.id}?t=${token}`;
  const firstName: string = client?.firstName ?? "there";

  await enqueueTrackedMail({
    to: clientEmail,
    subject: "A quick nudge — your contract is waiting",
    html: `<p>Hi ${firstName},</p>
           <p>Just a friendly nudge — your photography contract is still waiting for your signature. The link below is unique to you and will expire if not used in time.</p>
           <p><a href="${signUrl}">Review and sign your contract</a></p>
           <p>If anything looks off or you have questions, just reply to this email.</p>
           <p>Best,<br/>Korrin</p>`,
    recipientClientId: project.clientId,
    projectId,
    sendKind: "follow-up-contract",
  });
}

/**
 * Emit a "checking in on your proposal" nudge when a PROPOSAL_SENT project
 * has sat too long without movement. Silently skips when the project has
 * already advanced (or regressed) past PROPOSAL_SENT or the client lacks
 * an email on file.
 */
async function sendProposalSentFollowUp(task: FirebaseFirestore.DocumentData): Promise<void> {
  const projectId: string | undefined = task.projectId;
  if (!projectId) return;

  const projectSnap = await adminDb.collection("projects").doc(projectId).get();
  if (!projectSnap.exists) return;
  const project = projectSnap.data()!;
  if (project.status !== "PROPOSAL_SENT") return;

  const clientSnap = await adminDb.collection("clients").doc(project.clientId).get();
  const client = clientSnap.data();
  const clientEmail: string | undefined = client?.email;
  if (!clientEmail) return;
  const firstName: string = client?.firstName ?? "there";

  await enqueueTrackedMail({
    to: clientEmail,
    subject: "Just checking in on your proposal",
    html: `<p>Hi ${firstName},</p>
           <p>Just circling back on the proposal I sent over — happy to tweak the package, dates, or anything else if it'd help. Let me know what you're thinking!</p>
           <p>Best,<br/>Korrin</p>`,
    recipientClientId: project.clientId,
    projectId,
    sendKind: "follow-up-proposal",
  });
}

/**
 * Emit a "your deposit is still pending" nudge when a DEPOSIT_PENDING project
 * hasn't paid yet. Silently skips when status has moved on or the client
 * has no email on file.
 */
async function sendDepositPendingFollowUp(task: FirebaseFirestore.DocumentData): Promise<void> {
  const projectId: string | undefined = task.projectId;
  if (!projectId) return;

  const projectSnap = await adminDb.collection("projects").doc(projectId).get();
  if (!projectSnap.exists) return;
  const project = projectSnap.data()!;
  if (project.status !== "DEPOSIT_PENDING") return;

  const clientSnap = await adminDb.collection("clients").doc(project.clientId).get();
  const client = clientSnap.data();
  const clientEmail: string | undefined = client?.email;
  if (!clientEmail) return;
  const firstName: string = client?.firstName ?? "there";

  await enqueueTrackedMail({
    to: clientEmail,
    subject: "Your deposit is waiting to lock in your date",
    html: `<p>Hi ${firstName},</p>
           <p>Quick nudge — your deposit is still outstanding, and your shoot date isn't locked in until it lands. Let me know if the payment link isn't working and I'll re-send it.</p>
           <p>Best,<br/>Korrin</p>`,
    recipientClientId: project.clientId,
    projectId,
    sendKind: "follow-up-deposit",
  });
}

/**
 * Phase 2.10 — Sneak-peek auto-drop.
 *
 * Drains a `SNEAK_PEEK` scheduledTasks row. Pre-conditions are validated
 * defensively because the task was queued at BOOKED time, hours-to-days
 * before this handler runs:
 *
 *   - Project must still exist (admin may have hard-deleted it).
 *   - A matching `events` doc must exist (the BOOKED hook normally creates
 *     it; rare race conditions or manual project edits could break that).
 *   - At least one photo in `events/{id}/photos` must carry the reserved
 *     `sneakPeek` tag. Phase 2.10 expects 3–5; we cap at 5 and skip cleanly
 *     if zero. Tagging UI is a Phase 2.10 deliverable, so we also support
 *     the legacy `label === "sneakPeek"` shape until the new field lands.
 *   - Client must have an email on file (otherwise nothing to send to).
 *   - `project.sneakPeekSentAt` must be unset — guards against duplicate
 *     sends if cron fires the same row twice (Vercel retries, manual
 *     re-trigger, etc.).
 *
 * On any failed pre-condition we write `skipReason` to the scheduledTasks
 * doc so the outer loop's COMPLETED update preserves an audit trail.
 *
 * On success we:
 *   1. Enqueue an email in the `mail/` collection (Firebase Trigger Email
 *      delivers it). TODO: route through `lib/email/tracking.ts >
 *      enqueueTrackedMail` when Wave 3 email-tracking lands.
 *   2. Stamp `project.sneakPeekSentAt = serverTimestamp()` for idempotency.
 *   3. Append an OUTBOUND, isAutomatic message to
 *      `projects/{id}/messages` so the admin timeline reflects the drop.
 */
async function runSneakPeek(
  taskId: string,
  taskRef: FirebaseFirestore.DocumentReference,
  task: FirebaseFirestore.DocumentData
): Promise<void> {
  const projectId: string | undefined = task.projectId;
  if (!projectId) {
    await taskRef.update({ skipReason: "project_missing" });
    return;
  }

  // 1) Project lookup + idempotency guard.
  const projectRef = adminDb.collection("projects").doc(projectId);
  const projectSnap = await projectRef.get();
  if (!projectSnap.exists) {
    await taskRef.update({ skipReason: "project_missing" });
    return;
  }
  const project = projectSnap.data()!;
  if (project.sneakPeekSentAt) {
    await taskRef.update({ skipReason: "already_sent" });
    return;
  }

  // 2) Resolve the event for this project. SNEAK_PEEK photos live on
  //    `events/{id}/photos`, so without an event there is nothing to send.
  const eventsSnap = await adminDb
    .collection("events")
    .where("projectId", "==", projectId)
    .limit(1)
    .get();
  if (eventsSnap.empty) {
    await taskRef.update({ skipReason: "event_missing" });
    return;
  }
  const eventDoc = eventsSnap.docs[0];
  const eventId = eventDoc.id;

  // 3) Find sneakPeek-tagged photos. Phase 2.10 ships a `tags: string[]`
  //    field on PhotoDoc; until that UI lands, also accept the legacy
  //    `label === "sneakPeek"` shape so admins tagging by hand still work.
  const photosRef = adminDb
    .collection("events")
    .doc(eventId)
    .collection("photos");

  const collected: Array<{ id: string; cloudflareImageId: string }> = [];
  const seen = new Set<string>();

  // Primary query: tags array-contains "sneakPeek".
  try {
    const taggedSnap = await photosRef
      .where("tags", "array-contains", "sneakPeek")
      .orderBy("uploadedAt", "asc")
      .limit(5)
      .get();
    for (const p of taggedSnap.docs) {
      if (seen.has(p.id)) continue;
      const data = p.data();
      if (!data.cloudflareImageId) continue;
      seen.add(p.id);
      collected.push({ id: p.id, cloudflareImageId: data.cloudflareImageId });
    }
  } catch {
    // Index may not exist yet on first prod run; fall through to label fallback.
  }

  // Fallback: legacy `label == "sneakPeek"` shape, used only if the tags
  // query returned nothing (zero photos OR missing composite index).
  if (collected.length === 0) {
    try {
      const labelSnap = await photosRef
        .where("label", "==", "sneakPeek")
        .orderBy("uploadedAt", "asc")
        .limit(5)
        .get();
      for (const p of labelSnap.docs) {
        if (seen.has(p.id)) continue;
        const data = p.data();
        if (!data.cloudflareImageId) continue;
        seen.add(p.id);
        collected.push({
          id: p.id,
          cloudflareImageId: data.cloudflareImageId,
        });
      }
    } catch {
      // Same composite-index concern as above — treat as zero.
    }
  }

  if (collected.length === 0) {
    await taskRef.update({ skipReason: "no_sneak_peek_photos" });
    return;
  }

  // 4) Resolve client + email.
  const clientId: string | undefined = project.clientId;
  if (!clientId) {
    await taskRef.update({ skipReason: "client_no_email" });
    return;
  }
  const clientSnap = await adminDb.collection("clients").doc(clientId).get();
  if (!clientSnap.exists) {
    await taskRef.update({ skipReason: "client_no_email" });
    return;
  }
  const client = clientSnap.data()!;
  const clientEmail: string | undefined = client.email;
  if (!clientEmail) {
    await taskRef.update({ skipReason: "client_no_email" });
    return;
  }
  const firstName: string = client.firstName ?? "there";

  // 5) Compose the email. Inline `<img>` tags pull thumbnail variants from
  //    Cloudflare Images so the message stays light.
  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? "https://korrinsphotos.com"
  ).replace(/\/$/, "");
  const galleryUrl = `${appUrl}/gallery/${eventId}`;

  const imageRow = collected
    .map((p) => {
      const src = buildCdnUrl(p.cloudflareImageId, "thumbnail");
      return `<img src="${src}" alt="Sneak peek" style="width:48%;max-width:280px;margin:4px;border:0;display:inline-block;" />`;
    })
    .join("");

  const subject = "A little sneak peek from your shoot";
  const html = `<p>Hi ${firstName},</p>
                <p>A little preview before your full gallery — your full gallery will be ready in about 3 weeks.</p>
                <p style="text-align:center;">${imageRow}</p>
                <p><a href="${galleryUrl}">View these in your gallery</a> (you'll need to sign in).</p>
                <p>More to come — thank you for trusting me with your photos.</p>
                <p>Best,<br/>Korrin</p>`;

  // 6) Enqueue the email through the tracked-mail wrapper so opens/clicks
  // attribute back to the project. (Phase 1.6.)
  await enqueueTrackedMail({
    to: clientEmail,
    subject,
    html,
    recipientClientId: clientId,
    projectId,
    sendKind: "sneak-peek",
  });

  // 7) Idempotency guard — set BEFORE the message log so a partial failure
  // in step 8 won't cause a second email on retry.
  await projectRef.update({
    sneakPeekSentAt: FieldValue.serverTimestamp(),
  });

  // 8) Append an OUTBOUND message to the project timeline so the admin
  // sees the automated touch in the conversation history.
  try {
    await addProjectMessage(projectId, {
      direction: "OUTBOUND",
      channel: "EMAIL",
      subject,
      body: `Sent automated sneak-peek email (${collected.length} photo${
        collected.length === 1 ? "" : "s"
      }) to ${clientEmail}.`,
      isAutomatic: true,
    });
  } catch (err) {
    // Best-effort — the email is already out and the idempotency stamp is
    // written, so we don't want to throw here and trigger a retry.
    console.error("[cron] SNEAK_PEEK message log failed", taskId, err);
  }
}
