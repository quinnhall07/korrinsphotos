// app/admin/segments/[id]/page.tsx
// Server Component for the segment-builder route. Loads the segment, resolves
// a live count (best-effort), and delegates the form UI to the client page.

import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { getSegment, type SegmentDoc } from "@/lib/db/segments";
import { resolveSegment } from "@/lib/segments/resolver";
import {
  SegmentBuilderClientPage,
  type SerializedSegmentDetail,
} from "./SegmentBuilderClientPage";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const seg = await getSegment(id);
  return { title: seg ? `${seg.name} | Segments | Admin` : "Segment | Admin" };
}

function serialise(doc: SegmentDoc): SerializedSegmentDetail {
  return {
    id: doc.id,
    name: doc.name,
    description: doc.description ?? null,
    predicate: doc.predicate,
    lastResolvedCount:
      typeof doc.lastResolvedCount === "number" ? doc.lastResolvedCount : null,
    lastResolvedAt: doc.lastResolvedAt ? doc.lastResolvedAt.toDate().toISOString() : null,
    createdAt: doc.createdAt.toDate().toISOString(),
    updatedAt: doc.updatedAt.toDate().toISOString(),
  };
}

export default async function SegmentDetailPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  const segment = await getSegment(id);
  if (!segment) notFound();

  // Resolve a live count for the builder header. Best-effort — if it fails
  // we just fall back to the cached count.
  let initialCount: number | null = segment.lastResolvedCount ?? null;
  let initialCapped = false;
  try {
    const resolution = await resolveSegment(segment.predicate);
    initialCount = resolution.count;
    initialCapped = !!resolution.capped;
  } catch (err) {
    console.error("SegmentDetailPage: resolveSegment failed:", err);
  }

  return (
    <div className="page-fade-in">
      <div style={{ marginBottom: "1.25rem" }}>
        <Link
          href="/admin/segments"
          style={{
            fontSize: "0.7rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--charcoal-muted)",
            textDecoration: "none",
          }}
        >
          ← All segments
        </Link>
      </div>

      <SegmentBuilderClientPage
        segment={serialise(segment)}
        initialCount={initialCount}
        initialCapped={initialCapped}
      />
    </div>
  );
}
