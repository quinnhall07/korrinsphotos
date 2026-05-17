// app/admin/broadcasts/page.tsx
// Lists every saved broadcast. Server Component fetches the docs, serialises
// Timestamps, and hands off to BroadcastsListClientPage.

import { requireAdmin } from "@/lib/session";
import { listBroadcasts, type BroadcastDoc } from "@/lib/db/broadcasts";
import { listSegments, type SegmentDoc } from "@/lib/db/segments";
import {
  BroadcastsListClientPage,
  type SerializedBroadcastRow,
  type SerializedSegmentOption,
} from "./BroadcastsListClientPage";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Broadcasts | Admin" };
export const dynamic = "force-dynamic";

function serialiseRow(doc: BroadcastDoc): SerializedBroadcastRow {
  return {
    id: doc.id,
    name: doc.name,
    subject: doc.subject,
    segmentId: doc.segmentId,
    status: doc.status,
    scheduledFor: doc.scheduledFor ? doc.scheduledFor.toDate().toISOString() : null,
    sentAt: doc.sentAt ? doc.sentAt.toDate().toISOString() : null,
    recipientCount: typeof doc.recipientCount === "number" ? doc.recipientCount : null,
    sentCount: typeof doc.sentCount === "number" ? doc.sentCount : null,
    createdAt: doc.createdAt.toDate().toISOString(),
    updatedAt: doc.updatedAt.toDate().toISOString(),
  };
}

function serialiseSegment(doc: SegmentDoc): SerializedSegmentOption {
  return {
    id: doc.id,
    name: doc.name,
    lastResolvedCount:
      typeof doc.lastResolvedCount === "number" ? doc.lastResolvedCount : null,
  };
}

export default async function BroadcastsPage() {
  await requireAdmin();

  let broadcasts: SerializedBroadcastRow[] = [];
  let segments: SerializedSegmentOption[] = [];
  let error: string | null = null;

  try {
    const [bDocs, sDocs] = await Promise.all([listBroadcasts(), listSegments()]);
    broadcasts = bDocs.map(serialiseRow);
    segments = sDocs.map(serialiseSegment);
  } catch (err) {
    console.error("Failed to load broadcasts:", err);
    error = err instanceof Error ? err.message : "Failed to load broadcasts.";
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
          <strong>Error loading broadcasts</strong>
          <br />
          {error}
        </div>
      </div>
    );
  }

  return (
    <BroadcastsListClientPage broadcasts={broadcasts} segments={segments} />
  );
}
