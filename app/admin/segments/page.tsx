// app/admin/segments/page.tsx
// Lists every saved segment. Server Component fetches the docs, serialises
// Timestamps to ISO strings, and hands off to SegmentsClientPage.

import { requireAdmin } from "@/lib/session";
import { listSegments, type SegmentDoc } from "@/lib/db/segments";
import { SegmentsClientPage, type SerializedSegment } from "./SegmentsClientPage";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Segments | Admin" };
export const dynamic = "force-dynamic";

function serialiseSegment(doc: SegmentDoc): SerializedSegment {
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

export default async function SegmentsPage() {
  await requireAdmin();

  let segments: SerializedSegment[] = [];
  let error: string | null = null;

  try {
    const docs = await listSegments();
    segments = docs.map(serialiseSegment);
  } catch (err) {
    console.error("Failed to list segments:", err);
    error = err instanceof Error ? err.message : "Failed to load segments.";
  }

  if (error) {
    return (
      <div className="page-fade-in">
        <div
          style={{
            padding: "2rem",
            border: "0.5px solid #FCA5A5",
            background: "#FEF2F2",
            color: "#991B1B",
            fontSize: "0.88rem",
            lineHeight: 1.7,
          }}
        >
          <strong>Error loading segments</strong>
          <br />
          {error}
        </div>
      </div>
    );
  }

  return <SegmentsClientPage segments={segments} />;
}
