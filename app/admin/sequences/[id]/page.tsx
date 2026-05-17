// app/admin/sequences/[id]/page.tsx
// Server Component for the sequence-builder detail route. Loads the sequence
// and delegates the form UI to the shared SequenceBuilder client component.

import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { getSequence, type SequenceDoc } from "@/lib/db/sequences";
import {
  SequenceBuilder,
  type SerializedSequenceDetail,
} from "../SequenceBuilder";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const seq = await getSequence(id);
  return {
    title: seq ? `${seq.name} | Sequences | Admin` : "Sequence | Admin",
  };
}

function serialise(doc: SequenceDoc): SerializedSequenceDetail {
  return {
    id: doc.id,
    name: doc.name,
    description: doc.description ?? null,
    trigger: doc.trigger,
    triggerStatus: doc.triggerStatus ?? null,
    dateAnchor: doc.dateAnchor ?? null,
    active: doc.active,
    steps: (doc.steps ?? []).map((s) => ({
      delayHours: s.delayHours,
      channel: s.channel,
      templateId: s.templateId,
    })),
    createdAt: doc.createdAt.toDate().toISOString(),
    updatedAt: doc.updatedAt.toDate().toISOString(),
  };
}

export default async function SequenceDetailPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  const sequence = await getSequence(id);
  if (!sequence) notFound();

  return (
    <div className="page-fade-in">
      <div style={{ marginBottom: "1.25rem" }}>
        <Link
          href="/admin/sequences"
          style={{
            fontSize: "0.7rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--charcoal-muted)",
            textDecoration: "none",
          }}
        >
          ← All sequences
        </Link>
      </div>

      <SequenceBuilder sequence={serialise(sequence)} />
    </div>
  );
}
