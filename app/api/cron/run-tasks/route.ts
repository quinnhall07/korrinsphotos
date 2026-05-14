import { adminDb } from "@/lib/firebase-admin";
import { runDueSequences } from "@/lib/sequences/engine";
import { dispatchPendingReviewRequests } from "@/lib/domain/reviews";
import { NextResponse } from "next/server";
import { createInboxItem } from "@/lib/db/inbox";

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

          await adminDb.collection("mail").add({
            to: client.email,
            message: {
              subject: "Share your love for Korrin's Photography & Earn $150!",
              html: `<p>Hi ${client.firstName},</p>
                     <p>I hope you are loving your photos! If you have a friend who might also like a session, share this link:</p>
                     <p><a href="${referralLink}">${referralLink}</a></p>
                     <p>If they book, you'll earn $150 in credit towards your next session!</p>
                     <p>Best,<br/>Korrin</p>`
            }
          });
        }
      }

      // Auto-Follow-Ups (e.g. CONTRACT_SENT projects with no signature after N days).
      // The task doc carries `projectId` so we can look up the live contract,
      // pull the freshest signing token, and embed a token-aware URL in the
      // email. If the contract is already SIGNED or VOIDED, skip silently.
      if (task.type === "AUTO_FOLLOW_UP") {
        try {
          await sendContractSentFollowUp(task);
        } catch (err) {
          console.error("[cron] AUTO_FOLLOW_UP failed", doc.id, err);
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

  await adminDb.collection("mail").add({
    to: clientEmail,
    message: {
      subject: "A quick nudge — your contract is waiting",
      html: `<p>Hi ${firstName},</p>
             <p>Just a friendly nudge — your photography contract is still waiting for your signature. The link below is unique to you and will expire if not used in time.</p>
             <p><a href="${signUrl}">Review and sign your contract</a></p>
             <p>If anything looks off or you have questions, just reply to this email.</p>
             <p>Best,<br/>Korrin</p>`,
    },
  });
}
