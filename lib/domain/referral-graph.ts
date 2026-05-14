// lib/domain/referral-graph.ts
// Phase 4.5 — Referral chain visualization (Wave 7).
//
// Server-only. Reads every `clients` doc and every `projects` doc, builds the
// referral graph (each client's `referredBy` points to the referrer's
// `clientId`), and computes transitive metrics for each subtree:
//
//   - directReferralCount      — # of clients with referredBy === this.clientId
//   - transitiveReferralCount  — full subtree size (descendants only)
//   - transitiveRevenueCents   — sum of all descendant projects' packagePriceUsd
//                                converted to cents; statuses LOST / ARCHIVED
//                                are excluded.
//
// Cycle-safe (DFS uses a visited set even though `referredBy` should be a tree).
// Empty database returns an all-zero / empty-array struct — never throws.
//
// Imports only from `lib/db/*` + `lib/firebase-admin`. Never import from a
// `"use client"` file.

import { adminDb } from "@/lib/firebase-admin";
import type { ClientDoc, ReferralTier } from "@/lib/db/clients";
import { clientsCol } from "@/lib/db/clients";
import type { ProjectDoc, ProjectStatus } from "@/lib/db/projects";

const EXCLUDED_PROJECT_STATUSES: ReadonlySet<ProjectStatus> = new Set<ProjectStatus>([
  "LOST",
  "ARCHIVED",
]);

export interface ReferralGraphNode {
  clientId: string;
  name: string;                      // "firstName lastName" or email fallback
  email: string;
  referredBy: string | null;         // referrer's clientId, or null for a root
  directReferralCount: number;       // # of clients directly referred by this one
  transitiveReferralCount: number;   // full subtree size (descendants)
  transitiveRevenueCents: number;    // sum of descendant projects (LOST/ARCHIVED excluded)
  tier?: ReferralTier;
}

export interface ReferralGraphEdge {
  from: string; // referrer clientId
  to: string;   // referree clientId
}

export interface ReferralGraph {
  nodes: ReferralGraphNode[];
  edges: ReferralGraphEdge[];
  leaderboardByTransitiveReferrals: ReferralGraphNode[]; // top 25, desc
  leaderboardByTransitiveRevenue: ReferralGraphNode[];   // top 25, desc
  totalAttributableRevenueCents: number;                 // sum across roots
  totalClientsInChains: number;                          // clients with any referredBy
}

const EMPTY_GRAPH: ReferralGraph = {
  nodes: [],
  edges: [],
  leaderboardByTransitiveReferrals: [],
  leaderboardByTransitiveRevenue: [],
  totalAttributableRevenueCents: 0,
  totalClientsInChains: 0,
};

function displayName(client: Pick<ClientDoc, "firstName" | "lastName" | "email">): string {
  const first = (client.firstName ?? "").trim();
  const last = (client.lastName ?? "").trim();
  const full = `${first} ${last}`.trim();
  if (full.length > 0) return full;
  return (client.email ?? "").trim() || "(unknown)";
}

/**
 * Build the referral graph across all clients + projects.
 *
 * Returns `EMPTY_GRAPH` (all-zero / empty-array) if no clients have referral
 * relationships. Tolerates concurrent writes (clients added between the
 * clients read and the projects read are simply absent from the result, not
 * an error).
 */
export async function buildReferralGraph(): Promise<ReferralGraph> {
  // 1. Read every client. `referralCode` is universally present, so we just
  //    list the collection — keep IDs and the small projection we need.
  let clientsSnap;
  try {
    clientsSnap = await clientsCol().get();
  } catch (err) {
    console.error("[referral-graph] clients fetch failed:", err);
    return EMPTY_GRAPH;
  }
  if (clientsSnap.empty) return EMPTY_GRAPH;

  // 2. Read every project. We aggregate package price by clientId (cents),
  //    skipping LOST / ARCHIVED.
  const revenueByClientCents = new Map<string, number>();
  try {
    const projectsSnap = await adminDb.collection("projects").get();
    for (const doc of projectsSnap.docs) {
      const data = doc.data() as Partial<ProjectDoc>;
      const status = (data.status ?? null) as ProjectStatus | null;
      if (status && EXCLUDED_PROJECT_STATUSES.has(status)) continue;
      const clientId = (data.clientId ?? "").trim();
      if (!clientId) continue;
      const priceUsd =
        typeof data.packagePriceUsd === "number" && Number.isFinite(data.packagePriceUsd)
          ? data.packagePriceUsd
          : 0;
      if (priceUsd <= 0) continue;
      const cents = Math.round(priceUsd * 100);
      revenueByClientCents.set(
        clientId,
        (revenueByClientCents.get(clientId) ?? 0) + cents,
      );
    }
  } catch (err) {
    console.error("[referral-graph] projects fetch failed:", err);
    // Continue with zero-revenue graph — chain structure is still useful.
  }

  // 3. Build the lightweight client map + adjacency list. Resolve `referredBy`
  //    to a `clientId` we actually have (Firestore writes occasionally store
  //    the referrer's email or referralCode by accident — best effort
  //    re-resolution happens here).
  interface RawClient {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    referralCode: string;
    referredByRaw: string | null;
    tier: ReferralTier | undefined;
  }

  const clients: RawClient[] = [];
  const byEmail = new Map<string, string>();
  const byReferralCode = new Map<string, string>();

  for (const doc of clientsSnap.docs) {
    const data = doc.data() as Partial<ClientDoc>;
    const c: RawClient = {
      id: doc.id,
      email: (data.email ?? "").trim(),
      firstName: (data.firstName ?? "").trim(),
      lastName: (data.lastName ?? "").trim(),
      referralCode: (data.referralCode ?? "").trim(),
      referredByRaw: (data.referredBy ?? null) as string | null,
      tier: data.referralTier as ReferralTier | undefined,
    };
    clients.push(c);
    if (c.email) byEmail.set(c.email.toLowerCase(), c.id);
    if (c.referralCode) byReferralCode.set(c.referralCode, c.id);
  }

  const byId = new Map(clients.map((c) => [c.id, c]));

  const resolveReferrerId = (raw: string | null): string | null => {
    if (!raw) return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (byId.has(trimmed)) return trimmed;
    if (trimmed.includes("@")) {
      const id = byEmail.get(trimmed.toLowerCase());
      if (id) return id;
    }
    const codeId = byReferralCode.get(trimmed);
    if (codeId) return codeId;
    return null;
  };

  // children[parentId] -> list of childIds
  const children = new Map<string, string[]>();
  const resolvedReferredBy = new Map<string, string | null>();
  const edges: ReferralGraphEdge[] = [];

  for (const c of clients) {
    const parentId = resolveReferrerId(c.referredByRaw);
    resolvedReferredBy.set(c.id, parentId);
    if (parentId && parentId !== c.id) {
      const arr = children.get(parentId);
      if (arr) arr.push(c.id);
      else children.set(parentId, [c.id]);
      edges.push({ from: parentId, to: c.id });
    }
  }

  // A client participates in a chain if either:
  //   - they have a (resolvable) referredBy, OR
  //   - they have at least one child (i.e. someone referred by them).
  const participatesInChain = (id: string): boolean => {
    if (resolvedReferredBy.get(id)) return true;
    const kids = children.get(id);
    return !!kids && kids.length > 0;
  };

  // 4. DFS each subtree to compute transitive metrics. Cycle guard via
  //    `visiting` set; cycles shouldn't occur but defensive coding stays.
  const transitiveReferralCount = new Map<string, number>();
  const transitiveRevenueCents = new Map<string, number>();
  const visiting = new Set<string>();
  const computed = new Set<string>();

  function dfs(id: string): { count: number; revenueCents: number } {
    if (computed.has(id)) {
      return {
        count: transitiveReferralCount.get(id) ?? 0,
        revenueCents: transitiveRevenueCents.get(id) ?? 0,
      };
    }
    if (visiting.has(id)) {
      // Cycle — return zeros to break it; values for the offending node will
      // settle on its first (non-cyclic) visit.
      return { count: 0, revenueCents: 0 };
    }
    visiting.add(id);

    const kids = children.get(id) ?? [];
    let count = 0;
    let revenueCents = 0;
    for (const childId of kids) {
      const sub = dfs(childId);
      // The child itself counts as 1 referral; plus their descendants.
      count += 1 + sub.count;
      revenueCents += (revenueByClientCents.get(childId) ?? 0) + sub.revenueCents;
    }

    transitiveReferralCount.set(id, count);
    transitiveRevenueCents.set(id, revenueCents);
    visiting.delete(id);
    computed.add(id);
    return { count, revenueCents };
  }

  // Drive DFS from every node (memoized) so we never miss anyone.
  for (const c of clients) {
    if (participatesInChain(c.id)) dfs(c.id);
  }

  // 5. Materialise node list — only clients that participate in a chain.
  const nodes: ReferralGraphNode[] = [];
  for (const c of clients) {
    if (!participatesInChain(c.id)) continue;
    const directCount = (children.get(c.id) ?? []).length;
    const node: ReferralGraphNode = {
      clientId: c.id,
      name: displayName(c),
      email: c.email,
      referredBy: resolvedReferredBy.get(c.id) ?? null,
      directReferralCount: directCount,
      transitiveReferralCount: transitiveReferralCount.get(c.id) ?? 0,
      transitiveRevenueCents: transitiveRevenueCents.get(c.id) ?? 0,
    };
    if (c.tier) node.tier = c.tier;
    nodes.push(node);
  }

  // 6. Totals + leaderboards.
  let totalClientsInChains = 0;
  for (const n of nodes) {
    if (n.referredBy) totalClientsInChains += 1;
  }

  // Total attributable revenue is the sum across roots — a root carries the
  // revenue of its entire subtree. Summing across roots double-counts nothing
  // because every non-root revenue dollar lives in exactly one root subtree.
  let totalAttributableRevenueCents = 0;
  for (const n of nodes) {
    if (!n.referredBy) totalAttributableRevenueCents += n.transitiveRevenueCents;
  }

  const leaderboardByTransitiveReferrals = [...nodes]
    .filter((n) => n.transitiveReferralCount > 0)
    .sort((a, b) => b.transitiveReferralCount - a.transitiveReferralCount)
    .slice(0, 25);

  const leaderboardByTransitiveRevenue = [...nodes]
    .filter((n) => n.transitiveRevenueCents > 0)
    .sort((a, b) => b.transitiveRevenueCents - a.transitiveRevenueCents)
    .slice(0, 25);

  return {
    nodes,
    edges,
    leaderboardByTransitiveReferrals,
    leaderboardByTransitiveRevenue,
    totalAttributableRevenueCents,
    totalClientsInChains,
  };
}
