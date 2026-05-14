// lib/domain/press-backlinks.ts
//
// Wave 7 Phase 4.7 — monthly backlink monitor for press submissions.
//
// Server-only. Walks every `pressSubmissions` row in PUBLISHED state with a
// `publishedUrl`, fetches the URL, and writes the result back onto the row
// (`lastLinkCheckAt`, `linkAlive`, `linkLastHttpStatus`,
// `consecutiveLinkFailures`). On the third *consecutive* failure for a row
// we enqueue a single PRESS_LINK_DOWN inbox item.
//
// Idempotency: the inbox item is enqueued only on the transition into a
// failure-streak length of 3 (i.e. the prior `consecutiveLinkFailures` was
// < 3 and the new value is exactly 3). Subsequent runs with the streak
// already at 3+ skip the inbox write — admin can re-enqueue manually if the
// counter is reset back to 0 by a successful check and then climbs again.
//
// Best-effort: every per-row body is wrapped in try/catch so one bad row
// can never poison the sweep.

import {
  listAllPublishedSubmissionsForBacklinkCheck,
  updatePressSubmission,
  type PressSubmissionDoc,
} from "@/lib/db/press-submissions";
import { createInboxItem } from "@/lib/db/inbox";

// ─── Public API ──────────────────────────────────────────────────────────────

export interface CheckPressBacklinksResult {
  checked: number;
  alive: number;
  dead: number;
  errors: number;
}

const DEFAULT_CHECK_INTERVAL_HOURS = 720; // 30 days
const FETCH_TIMEOUT_MS = 10_000;
const FAILURE_STREAK_THRESHOLD = 3;

/**
 * Sweep every PUBLISHED press submission and verify its `publishedUrl`
 * still resolves. Rows whose `lastLinkCheckAt` is within
 * `opts.checkOlderThanHours` (default 720h / 30 days) are skipped — we
 * never want to hit publication sites more than once a month.
 *
 * Returns a counter summary for the cron-response JSON.
 */
export async function checkPressBacklinks(opts?: {
  now?: Date;
  checkOlderThanHours?: number;
}): Promise<CheckPressBacklinksResult> {
  const now = opts?.now ?? new Date();
  const intervalMs =
    (opts?.checkOlderThanHours ?? DEFAULT_CHECK_INTERVAL_HOURS) *
    60 *
    60 *
    1_000;
  const summary: CheckPressBacklinksResult = {
    checked: 0,
    alive: 0,
    dead: 0,
    errors: 0,
  };

  let rows: Array<{ projectId: string; submission: PressSubmissionDoc }> = [];
  try {
    rows = await listAllPublishedSubmissionsForBacklinkCheck();
  } catch (err) {
    console.error("[press-backlinks] list query failed", err);
    return summary;
  }

  for (const row of rows) {
    try {
      const { projectId, submission } = row;
      const url = submission.publishedUrl;
      if (!url) continue;

      // Skip if last check is fresher than the cadence interval.
      const lastMs = submission.lastLinkCheckAt?.toMillis?.() ?? 0;
      if (lastMs && now.getTime() - lastMs < intervalMs) {
        continue;
      }

      summary.checked++;
      const probe = await probeUrl(url);

      const wasDead = !probe.alive;
      const prevFailures =
        typeof submission.consecutiveLinkFailures === "number"
          ? submission.consecutiveLinkFailures
          : 0;
      const newFailures = probe.alive ? 0 : prevFailures + 1;

      if (probe.alive) summary.alive++;
      else summary.dead++;

      await updatePressSubmission(projectId, submission.id, {
        lastLinkCheckAt: now,
        linkAlive: probe.alive,
        ...(typeof probe.status === "number"
          ? { linkLastHttpStatus: probe.status }
          : {}),
        consecutiveLinkFailures: newFailures,
      });

      // Idempotent inbox enqueue: only on the *transition* into a 3+ streak.
      if (
        wasDead &&
        newFailures >= FAILURE_STREAK_THRESHOLD &&
        prevFailures < FAILURE_STREAK_THRESHOLD
      ) {
        try {
          await createInboxItem({
            type: "PRESS_LINK_DOWN",
            projectId,
            clientId: null,
            title: `Press link down: ${submission.publicationName}`,
            body: `${submission.publicationName}: article URL returned ${
              probe.status ?? "no response"
            } ${FAILURE_STREAK_THRESHOLD}x in a row`,
            link: `/admin/projects/${projectId}`,
            read: false,
          });
        } catch (inboxErr) {
          console.error(
            "[press-backlinks] inbox enqueue failed",
            submission.id,
            inboxErr
          );
        }
      }
    } catch (err) {
      console.error(
        "[press-backlinks] per-row check failed",
        row.submission?.id,
        err
      );
      summary.errors++;
    }
  }

  return summary;
}

// ─── URL probe ───────────────────────────────────────────────────────────────

interface ProbeResult {
  alive: boolean;
  /** HTTP status from the final response, or undefined if the request threw. */
  status?: number;
}

/**
 * Probe a URL. HEAD first; if the publication returns 405 / 501 (HEAD not
 * allowed) we retry once with GET. Any 2xx / 3xx is alive; any other
 * response or thrown error is dead.
 *
 * 10s timeout via `AbortSignal.timeout` (with `AbortController` fallback
 * for older Node typings).
 */
async function probeUrl(url: string): Promise<ProbeResult> {
  // Phase 1: HEAD.
  const head = await safeFetch(url, "HEAD");
  if (head.threw) {
    return { alive: false };
  }
  if (head.status === 405 || head.status === 501) {
    const get = await safeFetch(url, "GET");
    if (get.threw) return { alive: false };
    return {
      alive: get.status! >= 200 && get.status! < 400,
      status: get.status,
    };
  }
  return {
    alive: head.status! >= 200 && head.status! < 400,
    status: head.status,
  };
}

async function safeFetch(
  url: string,
  method: "HEAD" | "GET"
): Promise<{ status?: number; threw: boolean }> {
  let signal: AbortSignal;
  let controller: AbortController | null = null;
  // Prefer the native helper if available, otherwise polyfill via controller.
  const ts: ((ms: number) => AbortSignal) | undefined =
    (AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal })
      .timeout;
  if (typeof ts === "function") {
    signal = ts(FETCH_TIMEOUT_MS);
  } else {
    controller = new AbortController();
    setTimeout(() => controller!.abort(), FETCH_TIMEOUT_MS);
    signal = controller.signal;
  }

  try {
    const resp = await fetch(url, {
      method,
      redirect: "follow",
      signal,
      // Pretend to be a real browser — some publications gate bots aggressively.
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; KorrinsPhotosBacklinkMonitor/1.0)",
      },
    });
    return { status: resp.status, threw: false };
  } catch {
    return { threw: true };
  }
}
