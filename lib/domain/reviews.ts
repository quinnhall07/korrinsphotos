// lib/domain/reviews.ts
// Phase 4.6 — Multi-step review request scheduler + cron dispatcher.
//
// The NPS gate fires once per project: when `clientNps >= 4` is captured,
// we fan out 3 QUEUED `reviewRequests` docs on a Google (T+0) → The Knot
// (T+7d) → Facebook (T+14d) rotation. The cron worker drains the QUEUED
// docs whose `scheduledFor <= now`, posts an email into `mail/`, and stamps
// the row SENT. Click attribution lives in the `/r/review/[id]` redirector.
//
// Idempotency: re-running the scheduler for a project that already has any
// review request doc is a no-op. Re-dispatching a SENT row is impossible
// because the cron query filters by `status == "QUEUED"`.

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { enqueueTrackedMail } from "@/lib/email/tracking";
import { getClient } from "@/lib/db/clients";
import { getProject } from "@/lib/db/projects";
import {
  createReviewRequest,
  hasAnyReviewRequestForProject,
  listDueReviewRequests,
  reviewRequestsCol,
  type ReviewPlatform,
  type ReviewRequestDoc,
} from "@/lib/db/reviews";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Canonical rotation. Order = send order. Delay = days after the gate fires.
 * If Korrin ever wants to reorder/extend platforms, this is the single
 * source of truth.
 */
export const REVIEW_ROTATION: { platform: ReviewPlatform; delayDays: number }[] = [
  { platform: "GOOGLE", delayDays: 0 },
  { platform: "KNOT", delayDays: 7 },
  { platform: "FACEBOOK", delayDays: 14 },
];

const PLATFORM_LABEL: Record<ReviewPlatform, string> = {
  GOOGLE: "Google",
  KNOT: "The Knot",
  FACEBOOK: "Facebook",
};

const PLATFORM_ENV: Record<ReviewPlatform, string> = {
  GOOGLE: "REVIEW_LINK_GOOGLE",
  KNOT: "REVIEW_LINK_KNOT",
  FACEBOOK: "REVIEW_LINK_FACEBOOK",
};

const PLATFORM_FALLBACK: Record<ReviewPlatform, string> = {
  GOOGLE: "https://www.google.com/maps",
  KNOT: "https://www.theknot.com",
  FACEBOOK: "https://www.facebook.com",
};

function resolvePlatformUrl(platform: ReviewPlatform): string {
  const envKey = PLATFORM_ENV[platform];
  const url = process.env[envKey];
  if (!url) {
    console.warn(
      `[reviews] Missing env ${envKey} — falling back to placeholder ${PLATFORM_FALLBACK[platform]}. ` +
        `Set ${envKey} in Vercel/.env.local to send real review links.`
    );
    return PLATFORM_FALLBACK[platform];
  }
  return url;
}

/**
 * Scheduler entry point. Called from `submitClientNps` once the NPS write
 * succeeds. No-ops when:
 *   - the project doesn't exist, OR
 *   - `clientNps < 4`, OR
 *   - any review request already exists for this project (idempotency).
 *
 * Returns the count of newly-scheduled docs (0 on no-op, 3 on success).
 */
export async function maybeScheduleReviewRequests(
  projectId: string
): Promise<number> {
  const project = await getProject(projectId);
  if (!project) return 0;
  if (!project.clientNps || project.clientNps < 4) return 0;
  if (!project.clientId) return 0;

  const already = await hasAnyReviewRequestForProject(projectId);
  if (already) return 0;

  const now = Date.now();
  let count = 0;
  for (const step of REVIEW_ROTATION) {
    const scheduledForMs = now + step.delayDays * DAY_MS;
    try {
      await createReviewRequest({
        projectId,
        clientId: project.clientId,
        platform: step.platform,
        status: "QUEUED",
        scheduledFor: Timestamp.fromMillis(scheduledForMs),
      });
      count++;
    } catch (err) {
      console.error("[maybeScheduleReviewRequests] Failed to schedule step", {
        projectId,
        platform: step.platform,
        err,
      });
    }
  }
  return count;
}

export interface DispatchResult {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://korrinsphotos.com").replace(/\/$/, "");
}

function buildEmailBody(args: {
  firstName: string;
  platformLabel: string;
  trackingUrl: string;
}): { subject: string; html: string } {
  const { firstName, platformLabel, trackingUrl } = args;
  const safeName = firstName?.trim() || "there";
  const subject = `A quick favor — leave a ${platformLabel} review?`;
  const html = `
    <p>Hi ${safeName},</p>
    <p>Loved the photos? It'd mean the world if you left a quick review on <strong>${platformLabel}</strong>.</p>
    <p><a href="${trackingUrl}">${trackingUrl}</a></p>
    <p>Thank you so much,<br/>Korrin</p>
  `.trim();
  return { subject, html };
}

async function dispatchOne(req: ReviewRequestDoc): Promise<"sent" | "skipped" | "failed"> {
  try {
    // Re-read at write time to keep idempotent — a concurrent run could have
    // flipped the status. Cheap because we already have the id.
    const liveSnap = await reviewRequestsCol().doc(req.id).get();
    if (!liveSnap.exists) return "skipped";
    const live = liveSnap.data() as ReviewRequestDoc;
    if (live.status !== "QUEUED") return "skipped";

    const client = await getClient(req.clientId);
    if (!client?.email) {
      // Mark FAILED-style: flip to SENT so we don't infinite-retry, but log.
      console.warn("[dispatchPendingReviewRequests] No client email — marking SENT to break loop", {
        reviewRequestId: req.id,
        clientId: req.clientId,
      });
      await reviewRequestsCol().doc(req.id).update({
        status: "SENT",
        sentAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return "skipped";
    }

    const targetUrl = resolvePlatformUrl(req.platform);
    const trackingUrl = `${appUrl()}/r/review/${req.id}?target=${encodeURIComponent(targetUrl)}`;
    const { subject, html } = buildEmailBody({
      firstName: client.firstName ?? "",
      platformLabel: PLATFORM_LABEL[req.platform],
      trackingUrl,
    });

    // NOTE: the `trackingUrl` above already points at our own `/r/review/{id}`
    // route, which is itself a click tracker. `enqueueTrackedMail`'s rewrite
    // regex skips internal URLs (shouldRewriteHref → same host as
    // NEXT_PUBLIC_APP_URL → no rewrite) so we won't double-wrap it.
    await enqueueTrackedMail({
      to: client.email,
      subject,
      html,
      recipientClientId: req.clientId,
      projectId: req.projectId,
      sendKind: "review-request",
    });

    await reviewRequestsCol().doc(req.id).update({
      status: "SENT",
      sentAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return "sent";
  } catch (err) {
    console.error("[dispatchPendingReviewRequests] dispatch failed", {
      reviewRequestId: req.id,
      err,
    });
    return "failed";
  }
}

/**
 * Cron entry point. Drains every QUEUED review request whose `scheduledFor`
 * is in the past. Errors are caught per-row so one bad doc can't poison the
 * batch. Returns a summary the cron route uses in its JSON response.
 */
export async function dispatchPendingReviewRequests(
  now: Date
): Promise<DispatchResult> {
  const result: DispatchResult = { processed: 0, sent: 0, skipped: 0, failed: 0 };

  let due: ReviewRequestDoc[];
  try {
    due = await listDueReviewRequests(now);
  } catch (err) {
    console.error("[dispatchPendingReviewRequests] listDueReviewRequests failed", err);
    return result;
  }

  for (const req of due) {
    result.processed++;
    const outcome = await dispatchOne(req);
    if (outcome === "sent") result.sent++;
    else if (outcome === "skipped") result.skipped++;
    else result.failed++;
  }
  return result;
}
