import { adminDb } from "@/lib/firebase-admin";
import { NextResponse } from "next/server";

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
    }

    return NextResponse.json({ success: true, processed: processedCount });
  } catch (err) {
    console.error("Cron Error:", err);
    return NextResponse.json({ success: false, error: "Cron Failed" }, { status: 500 });
  }
}
