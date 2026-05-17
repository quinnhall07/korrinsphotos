// lib/far-future-risk.ts
//
// Phase 13.16 — far-future-date risk flag.
//
// A pure, isomorphic helper. Given a project's shoot / deposit / contact
// signals, returns a `FarFutureRiskInfo` describing whether the shoot is far
// enough out (and stale enough / unfunded enough) to warrant operator
// attention.
//
// This module MUST NOT import `firebase-admin` or any server-only code — it
// is consumed by both server callers (the cron sweep) and client components
// (pipeline table, capacity heatmap side panel).
//
// Thresholds:
//   - NONE  : monthsOut < 9, OR status is terminal (LOST / ARCHIVED / COMPLETED).
//   - WATCH : 9 <= monthsOut < 14.
//   - FLAG  : monthsOut >= 14 AND deposit not locked.
//   - STALE : monthsOut >= 14 AND lastContactedDaysAgo > 60.
//
// Precedence (most severe wins): STALE > FLAG > WATCH > NONE.
//
// `reason` is a short human-readable string composed from the active signals.

import type { ProjectStatus } from "@/lib/db/projects";

export type FarFutureRisk = "NONE" | "WATCH" | "FLAG" | "STALE";

export interface FarFutureRiskInfo {
  risk: FarFutureRisk;
  /** Whole months from `now` to `shootDate` (floor). 0 if shootDate is null/past. */
  monthsOut: number;
  /** `depositPaidAt != null`. */
  depositLocked: boolean;
  /** Whole days since the most recent of `lastContactedAt` / `lastRespondedAt`. */
  lastContactedDaysAgo: number | null;
  /** Human-readable summary, e.g. "Booked 18 months out · deposit unpaid · no contact in 90+ days". */
  reason: string;
}

const TERMINAL_STATUSES: ReadonlySet<ProjectStatus> = new Set<ProjectStatus>([
  "LOST",
  "ARCHIVED",
  "COMPLETED",
]);

const MS_PER_DAY = 86_400_000;
/** Average month length used for the months-out estimate (30.44 days). */
const MS_PER_MONTH = 30.44 * MS_PER_DAY;

const WATCH_FLOOR_MONTHS = 9;
const FAR_FUTURE_FLOOR_MONTHS = 14;
const STALE_CONTACT_DAYS = 60;

export interface AssessFarFutureRiskInput {
  shootDate: Date | null;
  depositPaidAt: Date | null;
  lastContactedAt: Date | null;
  lastRespondedAt: Date | null;
  status: ProjectStatus;
  /** Defaults to `new Date()`. Override for deterministic tests / cron pinning. */
  now?: Date;
}

function isValidDate(d: Date | null): d is Date {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

/** Floor of (shootDate - now) in months, using 30.44 days/month. 0 if shoot is past. */
function computeMonthsOut(shootDate: Date | null, now: Date): number {
  if (!isValidDate(shootDate)) return 0;
  const diff = shootDate.getTime() - now.getTime();
  if (diff <= 0) return 0;
  return Math.floor(diff / MS_PER_MONTH);
}

/** Whole days since the more recent of two timestamps. `null` when neither exists. */
function computeLastContactedDaysAgo(
  a: Date | null,
  b: Date | null,
  now: Date
): number | null {
  let mostRecent: number | null = null;
  if (isValidDate(a)) mostRecent = a.getTime();
  if (isValidDate(b)) {
    mostRecent = mostRecent === null ? b.getTime() : Math.max(mostRecent, b.getTime());
  }
  if (mostRecent === null) return null;
  const diff = now.getTime() - mostRecent;
  if (diff <= 0) return 0;
  return Math.floor(diff / MS_PER_DAY);
}

export function assessFarFutureRisk(input: AssessFarFutureRiskInput): FarFutureRiskInfo {
  const now = input.now ?? new Date();
  const monthsOut = computeMonthsOut(input.shootDate, now);
  const depositLocked = isValidDate(input.depositPaidAt);
  const lastContactedDaysAgo = computeLastContactedDaysAgo(
    input.lastContactedAt,
    input.lastRespondedAt,
    now
  );

  const isTerminal = TERMINAL_STATUSES.has(input.status);

  // Default — no risk for terminal projects or shoots inside 9 months.
  if (isTerminal || monthsOut < WATCH_FLOOR_MONTHS) {
    return {
      risk: "NONE",
      monthsOut,
      depositLocked,
      lastContactedDaysAgo,
      reason: "",
    };
  }

  // 9 ≤ monthsOut < 14 → WATCH.
  if (monthsOut < FAR_FUTURE_FLOOR_MONTHS) {
    return {
      risk: "WATCH",
      monthsOut,
      depositLocked,
      lastContactedDaysAgo,
      reason: composeReason("WATCH", monthsOut, depositLocked, lastContactedDaysAgo),
    };
  }

  // monthsOut >= 14 → escalate to STALE if contact is cold, FLAG if deposit
  // missing, else WATCH-equivalent for the far-future bucket.
  const contactCold =
    lastContactedDaysAgo !== null && lastContactedDaysAgo > STALE_CONTACT_DAYS;
  const depositMissing = !depositLocked;

  if (contactCold) {
    return {
      risk: "STALE",
      monthsOut,
      depositLocked,
      lastContactedDaysAgo,
      reason: composeReason("STALE", monthsOut, depositLocked, lastContactedDaysAgo),
    };
  }
  if (depositMissing) {
    return {
      risk: "FLAG",
      monthsOut,
      depositLocked,
      lastContactedDaysAgo,
      reason: composeReason("FLAG", monthsOut, depositLocked, lastContactedDaysAgo),
    };
  }

  // Far-future shoot with deposit locked and warm contact: still WATCH so the
  // operator can keep an eye on it, but no urgent action needed.
  return {
    risk: "WATCH",
    monthsOut,
    depositLocked,
    lastContactedDaysAgo,
    reason: composeReason("WATCH", monthsOut, depositLocked, lastContactedDaysAgo),
  };
}

function composeReason(
  risk: Exclude<FarFutureRisk, "NONE">,
  monthsOut: number,
  depositLocked: boolean,
  lastContactedDaysAgo: number | null
): string {
  const parts: string[] = [`Booked ${monthsOut} month${monthsOut === 1 ? "" : "s"} out`];
  if (!depositLocked) parts.push("deposit unpaid");
  if (lastContactedDaysAgo === null) {
    parts.push("no contact on file");
  } else if (lastContactedDaysAgo > STALE_CONTACT_DAYS) {
    parts.push(`no contact in ${lastContactedDaysAgo}+ days`);
  }
  // Prefix with the severity bucket for quick scanning.
  return `${risk}: ${parts.join(" · ")}`;
}

/**
 * Tiny helper so consumers don't have to repeat the palette. Olive for WATCH,
 * amber for FLAG, red for STALE; null for NONE so callers can render nothing.
 */
export function farFutureRiskColor(risk: FarFutureRisk): string | null {
  switch (risk) {
    case "WATCH":
      return "var(--olive)";
    case "FLAG":
      return "#D97706";
    case "STALE":
      return "#DC2626";
    default:
      return null;
  }
}
