// lib/editing-status.ts
//
// Phase 3.13 — pure helper for the editing-workflow tracker.
//
// Computes a pill label + status ("ON_TRACK" / "AT_RISK" / "OVERDUE") for any
// project that is mid-edit (i.e. has been shot but not yet delivered). The
// underlying SLA is per-sessionType and lives in `lib/db/projects.ts` so the
// values are server- and client-readable from a single source of truth.
//
// This module is intentionally pure (no Firestore, no fetch). It can be
// imported from Server Components, Server Actions, OR client components.
//
// Re-import path: `@/lib/editing-status`.

import { getEditingSlaDays, type EditingSubStage } from "./editing-sla";

export type EditingStatusKind = "ON_TRACK" | "AT_RISK" | "OVERDUE";

export interface EditingStatusInfo {
  /** Days elapsed since `shootDate` (rounded down). >= 0. */
  daysIn: number;
  /** Per-sessionType SLA in days. */
  slaDays: number;
  /** `daysIn / slaDays`, clamped to [0, 2]. */
  pct: number;
  /** ON_TRACK if pct <= 0.7, AT_RISK if <= 1.0, OVERDUE otherwise. */
  status: EditingStatusKind;
  /** Human-readable pill — e.g. "Editing — Day 18 of 28" / "Overdue by 4 days". */
  pillLabel: string;
  /** Current sub-stage (or null if none set yet). */
  currentStage: EditingSubStage | null;
}

export interface ComputeEditingStatusInput {
  shootDate: Date | null;
  deliveredAt: Date | null;
  sessionType: string;
  editingSubStage: EditingSubStage | null;
  /** Optional injection point for tests; defaults to `new Date()`. */
  now?: Date;
}

/**
 * Returns null when the project is not currently in the editing window — i.e.
 * no shootDate, sub-stage is already DELIVERED, or `deliveredAt` is set.
 *
 * Otherwise returns a fully-resolved `EditingStatusInfo`. The pct value is
 * clamped to [0, 2] so a runaway overdue can never blow out a progress bar.
 */
export function computeEditingStatus(
  input: ComputeEditingStatusInput
): EditingStatusInfo | null {
  const { shootDate, deliveredAt, sessionType, editingSubStage } = input;
  const now = input.now ?? new Date();

  // Already delivered or nothing to track.
  if (!shootDate) return null;
  if (deliveredAt) return null;
  if (editingSubStage === "DELIVERED") return null;

  const slaDays = getEditingSlaDays(sessionType);
  const elapsedMs = now.getTime() - shootDate.getTime();
  const daysIn = Math.max(0, Math.floor(elapsedMs / 86_400_000));
  const rawPct = slaDays > 0 ? daysIn / slaDays : 0;
  const pct = Math.max(0, Math.min(2, rawPct));

  let status: EditingStatusKind;
  if (rawPct <= 0.7) status = "ON_TRACK";
  else if (rawPct <= 1.0) status = "AT_RISK";
  else status = "OVERDUE";

  let pillLabel: string;
  if (status === "OVERDUE") {
    const over = daysIn - slaDays;
    pillLabel =
      over <= 0
        ? `Editing — Day ${daysIn} of ${slaDays}`
        : `Overdue by ${over} day${over === 1 ? "" : "s"}`;
  } else {
    pillLabel = `Editing — Day ${daysIn} of ${slaDays}`;
  }

  return {
    daysIn,
    slaDays,
    pct,
    status,
    pillLabel,
    currentStage: editingSubStage ?? null,
  };
}

/**
 * Convenience: maps an `EditingStatusKind` to the CSS color used by the pill
 * dot + table accents. Single source of truth so the pipeline table and the
 * workspace stepper stay in sync.
 */
export function editingStatusColor(kind: EditingStatusKind): string {
  switch (kind) {
    case "ON_TRACK":
      return "var(--olive)";
    case "AT_RISK":
      return "#D97706"; // amber-600
    case "OVERDUE":
      return "#DC2626"; // red-600
  }
}
