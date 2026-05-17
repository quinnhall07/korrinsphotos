// app/admin/broadcasts/[id]/page.tsx
// Server Component shell for the broadcast composer. Loads the broadcast, the
// available segments (for the picker), and aggregate engagement events
// (opens + clicks) so the BroadcastComposerClientPage can render the report
// card without further fetches.

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import {
  getBroadcast,
  type BroadcastBlock,
  type BroadcastDoc,
} from "@/lib/db/broadcasts";
import { listSegments, type SegmentDoc } from "@/lib/db/segments";
import { emailEventsCol } from "@/lib/db/email-events";
import {
  BroadcastComposerClientPage,
  type SerializedBroadcastDetail,
  type SerializedSegmentOption,
  type BroadcastEngagementStats,
} from "./BroadcastComposerClientPage";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const b = await getBroadcast(id);
  return { title: b ? `${b.name} | Broadcasts | Admin` : "Broadcast | Admin" };
}

function serialiseBroadcast(doc: BroadcastDoc): SerializedBroadcastDetail {
  return {
    id: doc.id,
    name: doc.name,
    subject: doc.subject,
    segmentId: doc.segmentId,
    blocks: doc.blocks as BroadcastBlock[],
    status: doc.status,
    scheduledFor: doc.scheduledFor ? doc.scheduledFor.toDate().toISOString() : null,
    sentAt: doc.sentAt ? doc.sentAt.toDate().toISOString() : null,
    recipientCount: typeof doc.recipientCount === "number" ? doc.recipientCount : null,
    sentCount: typeof doc.sentCount === "number" ? doc.sentCount : null,
    sendIdsByRecipient: doc.sendIdsByRecipient ?? null,
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

/**
 * Aggregate engagement for a broadcast.
 *
 * Strategy: pull every emailEvents row whose `sendId` is in the broadcast's
 * `sendIdsByRecipient` values, then count opens / clicks / unique opens.
 * Firestore `in` queries cap at 30 ids per call so we chunk.
 *
 * For broadcasts with > 30 sends we run multiple chunked queries. For very
 * large broadcasts (~500 recipients) this is ~17 queries — well under the
 * cron / page-load budget.
 */
async function computeEngagementStats(
  broadcast: BroadcastDoc
): Promise<BroadcastEngagementStats> {
  const sendIds = Object.values(broadcast.sendIdsByRecipient ?? {});
  if (sendIds.length === 0) {
    return { totalOpens: 0, uniqueOpens: 0, totalClicks: 0 };
  }

  let totalOpens = 0;
  let totalClicks = 0;
  const uniqueOpenSendIds = new Set<string>();

  const CHUNK = 30;
  for (let i = 0; i < sendIds.length; i += CHUNK) {
    const chunk = sendIds.slice(i, i + CHUNK);
    if (chunk.length === 0) continue;
    try {
      // Pull both opened and clicked in a single query — keeps reads cheap.
      const snap = await emailEventsCol()
        .where("sendId", "in", chunk)
        .where("type", "in", ["opened", "clicked"])
        .get();
      for (const d of snap.docs) {
        const data = d.data() as { type: string; sendId: string };
        if (data.type === "opened") {
          totalOpens++;
          uniqueOpenSendIds.add(data.sendId);
        } else if (data.type === "clicked") {
          totalClicks++;
        }
      }
    } catch (err) {
      console.error(
        "[broadcasts] engagement stats query failed for chunk",
        chunk,
        err
      );
    }
  }

  return {
    totalOpens,
    uniqueOpens: uniqueOpenSendIds.size,
    totalClicks,
  };
}

export default async function BroadcastDetailPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  const broadcast = await getBroadcast(id);
  if (!broadcast) notFound();

  const [segmentDocs, stats] = await Promise.all([
    listSegments(),
    computeEngagementStats(broadcast),
  ]);

  return (
    <div className="page-fade-in">
      <div style={{ marginBottom: "1.25rem" }}>
        <Link
          href="/admin/broadcasts"
          style={{
            fontSize: "0.7rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--charcoal-muted)",
            textDecoration: "none",
          }}
        >
          ← All broadcasts
        </Link>
      </div>

      <BroadcastComposerClientPage
        broadcast={serialiseBroadcast(broadcast)}
        segments={segmentDocs.map(serialiseSegment)}
        stats={stats}
      />
    </div>
  );
}
