import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { buildCapacityHeatmap, WEEKLY_CAP } from "@/lib/domain/capacity";
import { CapacityHeatmapClient } from "./CapacityHeatmapClient";

export const metadata: Metadata = { title: "Capacity | Admin" };
export const dynamic = "force-dynamic";

export default async function AdminCalendarPage() {
  await requireAdmin();
  const buckets = await buildCapacityHeatmap();
  return <CapacityHeatmapClient buckets={buckets} weeklyCap={WEEKLY_CAP} />;
}
