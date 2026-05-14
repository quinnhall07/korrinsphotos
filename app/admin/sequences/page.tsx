// app/admin/sequences/page.tsx
// Lists every sequence. Server Component fetches the docs, serialises
// Timestamps to ISO strings, and hands off to SequencesListClientPage.

import { requireAdmin } from "@/lib/session";
import { listSequences, type SequenceDoc } from "@/lib/db/sequences";
import {
  SequencesListClientPage,
  type SerializedSequenceRow,
} from "./SequencesListClientPage";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sequences | Admin" };
export const dynamic = "force-dynamic";

function serialiseRow(doc: SequenceDoc): SerializedSequenceRow {
  return {
    id: doc.id,
    name: doc.name,
    description: doc.description ?? null,
    trigger: doc.trigger,
    triggerStatus: doc.triggerStatus ?? null,
    dateAnchor: doc.dateAnchor ?? null,
    active: doc.active,
    stepCount: Array.isArray(doc.steps) ? doc.steps.length : 0,
    createdAt: doc.createdAt.toDate().toISOString(),
    updatedAt: doc.updatedAt.toDate().toISOString(),
  };
}

export default async function SequencesPage() {
  await requireAdmin();

  let sequences: SerializedSequenceRow[] = [];
  let error: string | null = null;

  try {
    const docs = await listSequences();
    sequences = docs.map(serialiseRow);
  } catch (err) {
    console.error("Failed to list sequences:", err);
    error = err instanceof Error ? err.message : "Failed to load sequences.";
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
          <strong>Error loading sequences</strong>
          <br />
          {error}
        </div>
      </div>
    );
  }

  return <SequencesListClientPage sequences={sequences} />;
}
