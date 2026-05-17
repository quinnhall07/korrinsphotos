// app/admin/reports/referrals/page.tsx
// Phase 4.5 — Referral chain visualization.
//
// Server Component:
//   1. `requireAdmin()` guard.
//   2. Builds the referral graph cross-collection (clients + projects).
//   3. Passes the serialisable graph to the client component, which renders
//      the leaderboard table + hand-rolled radial SVG layout.

import { requireAdmin } from "@/lib/session";
import { buildReferralGraph } from "@/lib/domain/referral-graph";
import { ReferralChainClient } from "./ReferralChainClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Referrals | Reports" };
export const dynamic = "force-dynamic";

export default async function ReferralChainPage() {
  await requireAdmin();
  const graph = await buildReferralGraph();
  return <ReferralChainClient graph={graph} />;
}
