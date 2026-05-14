import { adminDb } from "@/lib/firebase-admin";
import { runDueSequences } from "@/lib/sequences/engine";
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

      // Auto-Follow-Ups (Proposal Sent > 7 days)
      if (task.type === "AUTO_FOLLOW_UP") {
        // Implementation for follow-ups
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

    return NextResponse.json({
      success: true,
      processed: processedCount,
      sequenceEnrollmentsProcessed,
    });
  } catch (err) {
    console.error("Cron Error:", err);
    return NextResponse.json({ success: false, error: "Cron Failed" }, { status: 500 });
  }
}
