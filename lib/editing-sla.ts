// lib/editing-sla.ts
//
// Phase 3.13 — pure, isomorphic constants + helpers for the editing-workflow
// SLA. Lives outside `lib/db/projects.ts` so that client components can import
// these values without dragging in `firebase-admin` (which transitively
// requires Node-only modules like `fs` / `child_process` that Turbopack
// refuses to bundle for the browser).
//
// `lib/db/projects.ts` re-exports these symbols for server-side callers so
// existing import paths continue to work. New client-side call sites should
// prefer importing directly from `@/lib/editing-sla`.

/**
 * Sub-stages a project moves through while in `IN_EDITING`. The pipeline
 * status stays put while the sub-stage advances. When the sub-stage flips
 * to `DELIVERED`, the action layer transitions the project status to
 * `GALLERY_DELIVERED` via `updateProjectStatus`.
 */
export type EditingSubStage =
  | "INGESTION"
  | "CULLED"
  | "EDITED"
  | "EXPORTED"
  | "DELIVERED";

export const EDITING_SUB_STAGES: EditingSubStage[] = [
  "INGESTION",
  "CULLED",
  "EDITED",
  "EXPORTED",
  "DELIVERED",
];

/**
 * Per-`sessionType` editing SLA in days, measured from `shootDate`. Used by
 * `lib/editing-status.ts > computeEditingStatus` to compute the pill label
 * and at-risk/overdue status. Keys are case-sensitive against
 * `ProjectDoc.sessionType`.
 */
export const EDITING_SLA_DAYS_BY_SESSION_TYPE: Record<string, number> = {
  Wedding: 56, // 8 weeks
  Editorial: 28,
  Commercial: 21,
  Engagement: 14,
  Portrait: 10,
  Family: 10,
};

export const DEFAULT_EDITING_SLA_DAYS = 14;

export function getEditingSlaDays(sessionType: string): number {
  return EDITING_SLA_DAYS_BY_SESSION_TYPE[sessionType] ?? DEFAULT_EDITING_SLA_DAYS;
}
