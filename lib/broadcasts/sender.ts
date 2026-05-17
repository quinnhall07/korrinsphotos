// lib/broadcasts/sender.ts
// Phase 4.3 — Resolves a broadcast's target segment, enqueues one tracked
// email per recipient via `enqueueTrackedMail`, and stamps the broadcast doc
// with `sendIdsByRecipient` + `sentCount` + `recipientCount`.
//
// Used by:
//   - `app/admin/broadcasts/[id]/actions.ts > sendBroadcastAction` (immediate send)
//   - `dispatchScheduledBroadcasts(now)` in `app/api/cron/run-tasks/route.ts`
//
// Server-only. Uses adminDb (transitively).

import { adminDb } from "@/lib/firebase-admin";
import {
  getBroadcast,
  markBroadcastSending,
  markBroadcastSent,
  renderBroadcastHtml,
  listDueScheduledBroadcasts,
  type BroadcastDoc,
} from "@/lib/db/broadcasts";
import { getSegment } from "@/lib/db/segments";
import { resolveSegment } from "@/lib/segments/resolver";
import { enqueueTrackedMail } from "@/lib/email/tracking";

/**
 * Safety rail per roadmap §4.3 — a single broadcast can never fan out to more
 * than 500 clients. If the segment resolves to more, we trim and tag the
 * broadcast doc so admins know the audience was clipped.
 */
export const BROADCAST_RECIPIENT_CAP = 500;

export interface SendBroadcastResult {
  success: boolean;
  recipientCount: number;
  sentCount: number;
  error?: string;
  /** True if the audience exceeded the cap and was trimmed. */
  capped?: boolean;
  /** True if the broadcast was already SENDING/SENT and the call was a no-op. */
  skipped?: boolean;
}

/**
 * Send a broadcast end-to-end. The flow is:
 *   1. Mark SENDING (transactional idempotency guard).
 *   2. Resolve the target segment, clip to cap.
 *   3. Hydrate each clientId → email.
 *   4. Render shared HTML once, then for each recipient call
 *      `enqueueTrackedMail` so every send mints its own `sendId`.
 *   5. Stamp SENT + counts + `sendIdsByRecipient` on the broadcast doc.
 *
 * Per-recipient failures are caught individually so one bad email doesn't
 * abort the rest.
 */
export async function sendBroadcastById(
  id: string
): Promise<SendBroadcastResult> {
  const broadcast = await getBroadcast(id);
  if (!broadcast) {
    return { success: false, recipientCount: 0, sentCount: 0, error: "Broadcast not found" };
  }

  // 1) Transactional flip to SENDING — if this fails the broadcast is already
  // in flight (or finished). Treat as a no-op.
  const accepted = await markBroadcastSending(id);
  if (!accepted) {
    return {
      success: false,
      recipientCount: 0,
      sentCount: 0,
      error: "Broadcast is already SENDING or SENT",
      skipped: true,
    };
  }

  try {
    return await runSend(broadcast);
  } catch (err) {
    console.error("[broadcasts] send failed:", err);
    return {
      success: false,
      recipientCount: 0,
      sentCount: 0,
      error: err instanceof Error ? err.message : "Send failed",
    };
  }
}

async function runSend(broadcast: BroadcastDoc): Promise<SendBroadcastResult> {
  // 2) Resolve segment.
  const segment = await getSegment(broadcast.segmentId);
  if (!segment) {
    return {
      success: false,
      recipientCount: 0,
      sentCount: 0,
      error: "Segment not found for broadcast",
    };
  }
  const resolution = await resolveSegment(segment.predicate);

  const capped = resolution.clientIds.length > BROADCAST_RECIPIENT_CAP;
  const targetClientIds = capped
    ? resolution.clientIds.slice(0, BROADCAST_RECIPIENT_CAP)
    : resolution.clientIds;

  // 3) Hydrate clients in chunks of 10 (Firestore `in` limit).
  const emailsByClientId = await fetchClientEmails(targetClientIds);

  // 4) Pre-render once. enqueueTrackedMail rewrites links + injects pixel per send.
  const html = renderBroadcastHtml({
    subject: broadcast.subject,
    blocks: broadcast.blocks,
  });

  const sendIdsByRecipient: Record<string, string> = {};
  let sentCount = 0;

  for (const clientId of targetClientIds) {
    const email = emailsByClientId.get(clientId);
    if (!email) continue;
    try {
      const { sendId } = await enqueueTrackedMail({
        to: email,
        subject: broadcast.subject,
        html,
        recipientClientId: clientId,
        sendKind: `broadcast:${broadcast.id}`,
      });
      sendIdsByRecipient[clientId] = sendId;
      sentCount++;
    } catch (err) {
      console.error(
        "[broadcasts] enqueueTrackedMail failed for clientId",
        clientId,
        err
      );
    }
  }

  // 5) Stamp SENT.
  await markBroadcastSent(broadcast.id, {
    recipientCount: targetClientIds.length,
    sentCount,
    sendIdsByRecipient,
  });

  return {
    success: true,
    recipientCount: targetClientIds.length,
    sentCount,
    ...(capped ? { capped: true } : {}),
  };
}

async function fetchClientEmails(
  ids: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const CHUNK = 10;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    if (chunk.length === 0) continue;
    const snap = await adminDb
      .collection("clients")
      .where("__name__", "in", chunk)
      .get();
    snap.docs.forEach((d) => {
      const email = (d.data() as { email?: string }).email;
      if (email) out.set(d.id, email);
    });
  }
  return out;
}

// ─── Cron drain ──────────────────────────────────────────────────────────────

export interface DispatchScheduledBroadcastsResult {
  processed: number;
  sent: number;
}

/**
 * Cron drain — picks up `broadcasts` rows with `status == "SCHEDULED"` and
 * `scheduledFor <= now`, then runs the standard send flow. Per-row failures
 * are caught locally so a single bad broadcast cannot poison the batch.
 *
 * Wired into `app/api/cron/run-tasks/route.ts`.
 */
export async function dispatchScheduledBroadcasts(
  now: Date
): Promise<DispatchScheduledBroadcastsResult> {
  let processed = 0;
  let sent = 0;

  try {
    const due = await listDueScheduledBroadcasts(now);
    for (const broadcast of due) {
      processed++;
      try {
        const result = await sendBroadcastById(broadcast.id);
        if (result.success) sent++;
      } catch (err) {
        console.error(
          "[broadcasts] dispatchScheduledBroadcasts row failed",
          broadcast.id,
          err
        );
      }
    }
  } catch (err) {
    console.error("[broadcasts] dispatchScheduledBroadcasts failed:", err);
  }

  return { processed, sent };
}
