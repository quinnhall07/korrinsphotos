// lib/segments/resolver.ts
// Compiles a SegmentPredicate into the strongest Firestore query we can,
// then in-memory filters for predicate fields Firestore can't index.
//
// Server-only: reads adminDb directly via the projectsCol / clientsCol
// getters. Never import from a "use client" file.
//
// Returns BOTH `clientIds` and `projectIds` because downstream broadcasts
// can target either dimension (per-client emails, per-project drip).
//
// Hard cap at 5000 result docs to keep broadcast sends sane.

import { projectsCol, type ProjectDoc, type ProjectStatus } from "@/lib/db/projects";
import { clientsCol, type ClientDoc } from "@/lib/db/clients";
import type { SegmentPredicate } from "@/lib/db/segments";

const RESULT_CAP = 5000;
const FIRESTORE_IN_LIMIT = 10;

export interface SegmentResolution {
  clientIds: string[];
  projectIds: string[];
  count: number;
  /** True when the resolver hit the cap and stopped enumerating. */
  capped?: boolean;
}

/**
 * resolveSegment — runs the predicate against Firestore.
 *
 * Strategy:
 *   1. If the predicate touches project-only fields (projectStatus,
 *      sessionType, tagsInclude), query the `projects` collection first
 *      and hydrate the referenced clients in batches of 10.
 *   2. Otherwise, query the `clients` collection directly.
 *   3. In either case, apply remaining filters in memory (tagsExclude,
 *      score ranges, date ranges, hasReferred, totalSessionsBookedMin).
 */
export async function resolveSegment(
  predicate: SegmentPredicate
): Promise<SegmentResolution> {
  const projectFirst =
    (predicate.projectStatus && predicate.projectStatus.length > 0) ||
    (predicate.sessionType && predicate.sessionType.length > 0) ||
    (predicate.tagsInclude && predicate.tagsInclude.length > 0);

  if (projectFirst) {
    return resolveFromProjects(predicate);
  }
  return resolveFromClients(predicate);
}

// ─── Project-first path ──────────────────────────────────────────────────────

async function resolveFromProjects(
  predicate: SegmentPredicate
): Promise<SegmentResolution> {
  let query = projectsCol() as FirebaseFirestore.Query;

  // Firestore-side filters where they index cleanly.
  if (predicate.projectStatus && predicate.projectStatus.length > 0) {
    // `in` only supports up to 30 values (recent SDK); chunk if needed.
    if (predicate.projectStatus.length <= 30) {
      query = query.where("status", "in", predicate.projectStatus);
    }
  }
  if (predicate.sessionType && predicate.sessionType.length > 0) {
    if (predicate.sessionType.length <= 30) {
      query = query.where("sessionType", "in", predicate.sessionType);
    }
  }
  if (predicate.leadSource && predicate.leadSource.length > 0) {
    if (predicate.leadSource.length <= 30) {
      query = query.where("leadSource", "in", predicate.leadSource);
    }
  }
  if (predicate.tagsInclude && predicate.tagsInclude.length > 0) {
    // array-contains supports one value — first tag becomes the indexed
    // filter, the rest fall to the in-memory ALL-of check.
    query = query.where("tags", "array-contains", predicate.tagsInclude[0]);
  }

  const snap = await query.limit(RESULT_CAP + 1).get();
  const allProjects: ProjectDoc[] = snap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as ProjectDoc)
  );

  // Hydrate referenced clients in chunks of 10 (Firestore `in` limit).
  const referencedClientIds = Array.from(
    new Set(allProjects.map((p) => p.clientId).filter(Boolean))
  );
  const clientsById = await fetchClientsByIds(referencedClientIds);

  // In-memory filter pass.
  const matched: { project: ProjectDoc; client: ClientDoc | null }[] = [];
  for (const project of allProjects) {
    const client = clientsById.get(project.clientId) ?? null;
    if (matchesPredicate(predicate, project, client)) {
      matched.push({ project, client });
      if (matched.length > RESULT_CAP) break;
    }
  }

  const capped = matched.length > RESULT_CAP;
  const trimmed = capped ? matched.slice(0, RESULT_CAP) : matched;

  const clientIds = Array.from(
    new Set(trimmed.map((m) => m.client?.id).filter((v): v is string => !!v))
  );
  const projectIds = trimmed.map((m) => m.project.id);

  return {
    clientIds,
    projectIds,
    count: capped ? RESULT_CAP : trimmed.length,
    ...(capped ? { capped: true } : {}),
  };
}

// ─── Client-first path ───────────────────────────────────────────────────────

async function resolveFromClients(
  predicate: SegmentPredicate
): Promise<SegmentResolution> {
  let query = clientsCol() as FirebaseFirestore.Query;

  if (predicate.firstTouchSource && predicate.firstTouchSource.length > 0) {
    if (predicate.firstTouchSource.length <= 30) {
      query = query.where("firstTouchSource", "in", predicate.firstTouchSource);
    }
  }

  const snap = await query.limit(RESULT_CAP + 1).get();
  const allClients: ClientDoc[] = snap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as ClientDoc)
  );

  const matched: ClientDoc[] = [];
  for (const client of allClients) {
    if (matchesPredicate(predicate, null, client)) {
      matched.push(client);
      if (matched.length > RESULT_CAP) break;
    }
  }

  const capped = matched.length > RESULT_CAP;
  const trimmed = capped ? matched.slice(0, RESULT_CAP) : matched;

  return {
    clientIds: trimmed.map((c) => c.id),
    projectIds: [],
    count: capped ? RESULT_CAP : trimmed.length,
    ...(capped ? { capped: true } : {}),
  };
}

// ─── In-memory predicate ─────────────────────────────────────────────────────

function matchesPredicate(
  predicate: SegmentPredicate,
  project: ProjectDoc | null,
  client: ClientDoc | null
): boolean {
  // Project-side filters.
  if (project) {
    if (
      predicate.projectStatus &&
      predicate.projectStatus.length > 0 &&
      !predicate.projectStatus.includes(project.status as ProjectStatus)
    ) {
      return false;
    }
    if (
      predicate.sessionType &&
      predicate.sessionType.length > 0 &&
      !predicate.sessionType.includes(project.sessionType as string)
    ) {
      return false;
    }
    if (predicate.tagsInclude && predicate.tagsInclude.length > 0) {
      const projectTags = project.tags ?? [];
      const allIn = predicate.tagsInclude.every((t) => projectTags.includes(t));
      if (!allIn) return false;
    }
    if (predicate.tagsExclude && predicate.tagsExclude.length > 0) {
      const projectTags = project.tags ?? [];
      const anyHit = predicate.tagsExclude.some((t) => projectTags.includes(t));
      if (anyHit) return false;
    }
    if (typeof predicate.leadScoreMin === "number") {
      if ((project.leadScore ?? 0) < predicate.leadScoreMin) return false;
    }
    if (typeof predicate.leadScoreMax === "number") {
      if ((project.leadScore ?? 0) > predicate.leadScoreMax) return false;
    }
    if (predicate.leadSource && predicate.leadSource.length > 0) {
      if (!predicate.leadSource.includes(project.leadSource as string)) {
        return false;
      }
    }
  }

  // Client-side filters.
  if (client) {
    if (
      predicate.firstTouchSource &&
      predicate.firstTouchSource.length > 0 &&
      !predicate.firstTouchSource.includes(client.firstTouchSource as string)
    ) {
      return false;
    }
    if (typeof predicate.totalSessionsBookedMin === "number") {
      if ((client.totalSessionsBooked ?? 0) < predicate.totalSessionsBookedMin) {
        return false;
      }
    }
    if (typeof predicate.hasReferred === "boolean") {
      const count = client.referralCount ?? 0;
      if (predicate.hasReferred && count <= 0) return false;
      if (!predicate.hasReferred && count > 0) return false;
    }
  }

  // Date-range filters apply to either side (whichever is available).
  if (predicate.deliveredAfter) {
    const cutoff = parseIsoToMs(predicate.deliveredAfter);
    const deliveredMs = pickDeliveredMs(project, client);
    if (cutoff != null && (deliveredMs == null || deliveredMs < cutoff)) {
      return false;
    }
  }
  if (predicate.deliveredBefore) {
    const cutoff = parseIsoToMs(predicate.deliveredBefore);
    const deliveredMs = pickDeliveredMs(project, client);
    if (cutoff != null && (deliveredMs == null || deliveredMs > cutoff)) {
      return false;
    }
  }

  return true;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchClientsByIds(ids: string[]): Promise<Map<string, ClientDoc>> {
  const out = new Map<string, ClientDoc>();
  if (ids.length === 0) return out;

  for (let i = 0; i < ids.length; i += FIRESTORE_IN_LIMIT) {
    const chunk = ids.slice(i, i + FIRESTORE_IN_LIMIT);
    if (chunk.length === 0) continue;
    const snap = await clientsCol()
      .where("__name__", "in", chunk)
      .get();
    snap.docs.forEach((d) => {
      out.set(d.id, { id: d.id, ...d.data() } as ClientDoc);
    });
  }
  return out;
}

function parseIsoToMs(iso: string): number | null {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

function pickDeliveredMs(
  project: ProjectDoc | null,
  client: ClientDoc | null
): number | null {
  // Prefer per-project delivery; fall back to client.lastDeliveredAt if
  // present (the field is informal — clients today don't store it, but the
  // predicate spec includes it for future-compat).
  if (project?.deliveredAt) {
    try {
      return project.deliveredAt.toDate().getTime();
    } catch {
      /* swallow */
    }
  }
  const anyClient = client as unknown as { lastDeliveredAt?: { toDate(): Date } };
  if (anyClient?.lastDeliveredAt && typeof anyClient.lastDeliveredAt.toDate === "function") {
    try {
      return anyClient.lastDeliveredAt.toDate().getTime();
    } catch {
      /* swallow */
    }
  }
  return null;
}
