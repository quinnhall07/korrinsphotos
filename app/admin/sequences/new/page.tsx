// app/admin/sequences/new/page.tsx
// Server Component for the "new sequence" route. Renders the shared
// SequenceBuilder with `sequence={null}` so it knows to use the create action.

import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { SequenceBuilder } from "../SequenceBuilder";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "New sequence | Admin" };
export const dynamic = "force-dynamic";

export default async function NewSequencePage() {
  await requireAdmin();

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

      <SequenceBuilder sequence={null} />
    </div>
  );
}
