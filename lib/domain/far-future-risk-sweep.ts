// lib/domain/far-future-risk-sweep.ts
//
// Phase 13.16 — cron sweep that surfaces FAR_FUTURE_RISK inbox items for
// shoots booked 14+ months out that are either unfunded or stale.
//
// Server-only. Reads every active project with a `shootDate`, runs the pure
// `assessFarFutureRisk` helper, and ensures a single OPEN inbox item exists
// for any project whose risk is FLAG or STALE. Idempotent — we never queue a
// second OPEN row while the first is still open.
//
// The pure helper lives in `lib/far-future-risk.ts` so client surfaces (the
// pipeline table, capacity heatmap side panel) can share the same logic
// without dragging in Admin SDK code.

import { adminDb } from "@/lib/firebase-admin";
import type { Timestamp } from "firebase-admin/firestore";
import { assessFarFutureRisk, type FarFutureRiskInfo } from "@/lib/far-future-risk";
import type { ProjectStatus } from "@/lib/db/projects";
import { createInboxItem, inboxItemsCol } from "@/lib/db/inbox";

export interface SweepFarFutureRiskResult {
  scanned: number;
  watch: number;
  flag: number;
  stale: number;
  inboxItemsQueued: number;
}

/** Statuses excluded from the sweep — they're terminal and never carry risk. */
const EXCLUDED_STATUSES: ProjectStatus[] = ["LOST", "ARCHIVED", "COMPLETED"];

function tsToDate(ts: Timestamp | undefined | null): Date | null {
  if (!ts) return null;
  if (typeof (ts as { toDate?: () => Date }).toDate === "function") {
    try {
      const d = (ts as Timestamp).toDate();
      return Number.isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Sweep every active project, compute its far-future risk, and enqueue an
 * inbox item for any project that landed in FLAG or STALE (and doesn't
 * already have an open one).
 *
 * Returns a counter summary suitable for the cron JSON response.
 */
export async function sweepFarFutureRiskInboxItems(
  now: Date = new Date()
): Promise<SweepFarFutureRiskResult> {
  const summary: SweepFarFutureRiskResult = {
    scanned: 0,
    watch: 0,
    flag: 0,
    stale: 0,
    inboxItemsQueued: 0,
  };

  // `not-in` accepts up to 10 values — we use 3. Single not-in filter is
  // allowed without an inequality on a different field.
  let snap: FirebaseFirestore.QuerySnapshot;
  try {
    snap = await adminDb
      .collection("projects")
      .where("status", "not-in", EXCLUDED_STATUSES)
      .get();
  } catch (err) {
    console.error("[far-future-risk-sweep] project query failed", err);
    return summary;
  }

  for (const doc of snap.docs) {
    try {
      const data = doc.data();
      const shootDate = tsToDate(data.shootDate as Timestamp | undefined);
      if (!shootDate) continue;

      summary.scanned++;

      const info: FarFutureRiskInfo = assessFarFutureRisk({
        shootDate,
        depositPaidAt: tsToDate(data.depositPaidAt as Timestamp | undefined),
        lastContactedAt: tsToDate(data.lastContactedAt as Timestamp | undefined),
        lastRespondedAt: tsToDate(data.lastRespondedAt as Timestamp | undefined),
        status: String(data.status ?? "INQUIRY") as ProjectStatus,
        now,
      });

      if (info.risk === "WATCH") summary.watch++;
      else if (info.risk === "FLAG") summary.flag++;
      else if (info.risk === "STALE") summary.stale++;

      if (info.risk !== "FLAG" && info.risk !== "STALE") continue;

      // Idempotency: check for an existing OPEN inbox row for this project +
      // FAR_FUTURE_RISK type. `archiveInboxItem` deletes the row outright, so
      // "OPEN" is modelled as "the row still exists". A snoozed row is still
      // open from the operator's perspective — we don't re-enqueue it.
      const existing = await inboxItemsCol()
        .where("type", "==", "FAR_FUTURE_RISK")
        .where("projectId", "==", doc.id)
        .limit(1)
        .get();
      if (!existing.empty) continue;

      try {
        await createInboxItem({
          type: "FAR_FUTURE_RISK",
          projectId: doc.id,
          clientId: typeof data.clientId === "string" ? data.clientId : null,
          title: `Far-future risk: ${String(data.title ?? "Untitled")}`,
          body: info.reason,
          link: `/admin/projects/${doc.id}`,
          read: false,
        });
        summary.inboxItemsQueued++;
      } catch (inboxErr) {
        console.error(
          "[far-future-risk-sweep] inbox enqueue failed",
          doc.id,
          inboxErr
        );
      }
    } catch (rowErr) {
      console.error("[far-future-risk-sweep] per-row check failed", doc.id, rowErr);
    }
  }

  return summary;
}
