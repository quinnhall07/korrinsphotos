// lib/domain/recurring-revenue.ts
// Phase 13.6 — Recurring revenue layer.
//
// Walks every client whose `recurringCadence in ["ANNUAL", "SEMI_ANNUAL"]`
// has a `recurringNextPromptAt <= now`, queues a `RE_ENGAGEMENT_DUE` inbox
// item, advances the next-prompt window, and stamps an idempotency guard.
//
// Server-only. Reads `clients`, `projects`; writes `clients`, `inboxItems`.

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { createInboxItem } from "@/lib/db/inbox";

/**
 * Default re-engagement email body. Surfaced (read-only) on the inbox
 * detail panel; Korrin can copy/override before clicking "Send now".
 *
 * Kept here so the inbox UI can import the same string for the textarea
 * default. Plain-text with linebreaks — the inbox UI HTML-escapes / wraps
 * it before passing to `enqueueTrackedMail`.
 */
export const DEFAULT_REENGAGEMENT_BODY = (firstName: string) =>
  `Hi ${firstName},\n\n` +
  `It's been about a year since our last session — I was just thinking about your photos and wanted to say hi.\n\n` +
  `If you've been considering updated portraits, refreshing your family photos, or marking another milestone, I'd love to plan something with you. I'm holding a complimentary 15-minute call this season for past clients to chat about ideas — no pressure, just a chance to dream up the next set.\n\n` +
  `Let me know if you'd like to grab a time.\n\n` +
  `Warmly,\nKorrin`;

export const DEFAULT_REENGAGEMENT_SUBJECT = "It's been a year — let's plan the next one";

/** 30 days — minimum gap between two `RE_ENGAGEMENT_DUE` inbox items for the same client. */
const REENGAGEMENT_IDEMPOTENCY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Months to advance `recurringNextPromptAt` after a successful enqueue. */
function monthsForCadence(cadence: string): number {
  if (cadence === "SEMI_ANNUAL") return 6;
  // ANNUAL (and any unknown future cadence) defaults to 12 months.
  return 12;
}

export interface RecurringSweepResult {
  /** Total client rows examined that matched the cadence + due-by filters. */
  swept: number;
  /** Inbox items actually enqueued. */
  queued: number;
  /** Rows skipped due to the idempotency window or other guards. */
  skipped: number;
}

/**
 * Walk every client whose cadence is ANNUAL or SEMI_ANNUAL and whose
 * `recurringNextPromptAt <= now`. For each:
 *   1. If `lastReengagementInboxItemAt` is within 30 days, skip + advance.
 *   2. Otherwise look up the client's most-recently delivered project
 *      (for body context), enqueue an `inboxItems` row, advance
 *      `recurringNextPromptAt`, stamp `lastReengagementInboxItemAt`,
 *      and increment `recurringPromptsSent`.
 *
 * Errors on a single client are caught + logged so one bad row cannot
 * poison the sweep.
 */
export async function sweepRecurringClientPrompts(
  now: Date
): Promise<RecurringSweepResult> {
  const nowMs = now.getTime();
  const nowTs = Timestamp.fromDate(now);

  let swept = 0;
  let queued = 0;
  let skipped = 0;

  // Firestore `in` query supports up to 30 values; we have two. Pairing
  // with a Timestamp range filter and no orderBy keeps the index footprint
  // minimal (single composite index on
  // (recurringCadence, recurringNextPromptAt) at most).
  let snap: FirebaseFirestore.QuerySnapshot;
  try {
    snap = await adminDb
      .collection("clients")
      .where("recurringCadence", "in", ["ANNUAL", "SEMI_ANNUAL"])
      .where("recurringNextPromptAt", "<=", nowTs)
      .get();
  } catch (err) {
    console.error("[sweepRecurringClientPrompts] query failed", err);
    return { swept: 0, queued: 0, skipped: 0 };
  }

  for (const doc of snap.docs) {
    swept += 1;
    const clientId = doc.id;
    const c = doc.data() ?? {};

    try {
      const cadence: string =
        typeof c.recurringCadence === "string" ? c.recurringCadence : "ANNUAL";

      // 1) Idempotency — if we already prompted within the past 30 days,
      // simply advance the window forward and skip the enqueue.
      const lastAt: Timestamp | undefined = c.lastReengagementInboxItemAt;
      if (
        lastAt &&
        typeof lastAt.toMillis === "function" &&
        nowMs - lastAt.toMillis() < REENGAGEMENT_IDEMPOTENCY_WINDOW_MS
      ) {
        const advanced = advanceMonths(now, monthsForCadence(cadence));
        await doc.ref.update({
          recurringNextPromptAt: Timestamp.fromDate(advanced),
          updatedAt: FieldValue.serverTimestamp(),
        });
        skipped += 1;
        continue;
      }

      // 2) Resolve the most-recently delivered project for the body context.
      let lastProjectTitle: string | null = null;
      let lastProjectSessionType: string | null = null;
      try {
        const projSnap = await adminDb
          .collection("projects")
          .where("clientId", "==", clientId)
          .where("deliveredAt", "!=", null)
          .orderBy("deliveredAt", "desc")
          .limit(1)
          .get();
        if (!projSnap.empty) {
          const p = projSnap.docs[0].data();
          lastProjectTitle =
            typeof p.title === "string" && p.title.trim().length > 0
              ? p.title.trim()
              : null;
          lastProjectSessionType =
            typeof p.sessionType === "string" ? p.sessionType : null;
        }
      } catch (err) {
        // Index for (clientId == X, deliveredAt != null, orderBy deliveredAt desc)
        // may not exist yet on first prod run; fall through with null title.
        console.error(
          "[sweepRecurringClientPrompts] last-project lookup failed",
          { clientId, err }
        );
      }

      const firstName: string =
        typeof c.firstName === "string" ? c.firstName.trim() : "";
      const lastName: string =
        typeof c.lastName === "string" ? c.lastName.trim() : "";
      const displayName =
        [firstName, lastName].filter((s) => s.length > 0).join(" ") || "this client";

      const monthsAgo = cadence === "SEMI_ANNUAL" ? 6 : 11;
      const isWedding = lastProjectSessionType === "Wedding";

      const title = isWedding
        ? `Anniversary nudge: ${displayName}'s wedding was about a year ago`
        : `Re-engage ${displayName}: it's been ${monthsAgo} months since their last shoot`;

      const subjectPiece = lastProjectTitle ? ` "${lastProjectTitle}"` : "";
      const body = isWedding
        ? `It's been about a year since the${subjectPiece} wedding. ` +
          `Send a quick anniversary note and offer a planning chat for portraits.`
        : `It's been ${monthsAgo} months since the${subjectPiece} shoot. ` +
          `Send a re-engagement note and offer a complimentary planning chat?`;

      await createInboxItem({
        type: "RE_ENGAGEMENT_DUE",
        clientId,
        projectId: null,
        title,
        body,
        link: `/admin/clients/${clientId}`,
        read: false,
      });

      // 3) Advance window + stamp idempotency guard + bump counter.
      const advanced = advanceMonths(now, monthsForCadence(cadence));
      const previousCount =
        typeof c.recurringPromptsSent === "number" ? c.recurringPromptsSent : 0;
      await doc.ref.update({
        recurringNextPromptAt: Timestamp.fromDate(advanced),
        lastReengagementInboxItemAt: nowTs,
        recurringPromptsSent: previousCount + 1,
        updatedAt: FieldValue.serverTimestamp(),
      });

      queued += 1;
    } catch (err) {
      console.error("[sweepRecurringClientPrompts] per-client failure", {
        clientId,
        err,
      });
      // Do not advance the window on hard failure — admin can re-run.
    }
  }

  return { swept, queued, skipped };
}

/**
 * Add `months` calendar months to `from`. Uses JS `Date.setMonth`, which
 * correctly handles year rollover. Returns a new Date.
 */
function advanceMonths(from: Date, months: number): Date {
  const next = new Date(from.getTime());
  next.setMonth(next.getMonth() + months);
  return next;
}
