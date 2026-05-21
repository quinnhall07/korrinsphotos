// app/admin/site/[pageId]/revisions/page.tsx
// Revisions list with one-click restore-to-draft.

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { getPageDefinition } from "@/lib/site-content/page-registry";
import { listRevisions } from "@/lib/db/site-content";
import { formatDateTime } from "@/lib/date";
import { RestoreButton } from "./RestoreButton";

export const dynamic = "force-dynamic";

export default async function RevisionsPage({ params }: { params: Promise<{ pageId: string }> }) {
  await requireAdmin();
  const { pageId } = await params;
  const def = getPageDefinition(pageId);
  if (!def) notFound();

  const revisions = await listRevisions(pageId);

  return (
    <div>
      <header style={{ marginBottom: "1.5rem" }}>
        <Link href={`/admin/site/${pageId}`} style={{ fontSize: "0.7rem", color: "var(--charcoal-muted)", textDecoration: "none", letterSpacing: "0.12em" }}>
          ← Back to {def.label} editor
        </Link>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "2rem", fontWeight: 300, margin: "0.4rem 0 0" }}>
          Revisions — {def.label}
        </h1>
        <p style={{ fontSize: "0.78rem", color: "var(--charcoal-muted)", marginTop: "0.3rem", maxWidth: "44rem" }}>
          Every publish snapshots the live page. Restore copies that snapshot back into your draft — review and publish again to take it live. Last 50 publishes are retained.
        </p>
      </header>

      {revisions.length === 0 ? (
        <div style={{ padding: "2rem", border: "0.5px dashed var(--border-strong)", textAlign: "center", color: "var(--charcoal-muted)" }}>
          No revisions yet — publish this page once to create the first snapshot.
        </div>
      ) : (
        <div style={{ border: "0.5px solid var(--border)", background: "var(--white)" }}>
          {revisions.map((r) => (
            <div
              key={r.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr 0.4fr 0.4fr",
                gap: "1rem",
                padding: "0.85rem 1rem",
                borderBottom: "0.5px solid var(--border)",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: "0.9rem", color: "var(--charcoal)" }}>{formatDateTime(r.publishedAt)}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--charcoal-muted)" }}>by {r.publishedByUid}</div>
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--charcoal-light)" }}>
                {r.noteSummary ?? <em style={{ color: "var(--charcoal-muted)" }}>no note</em>}
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--charcoal-muted)" }}>
                {r.sections.length} section{r.sections.length === 1 ? "" : "s"}
              </div>
              <div style={{ textAlign: "right" }}>
                <RestoreButton pageId={pageId} revisionId={r.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
