"use client";

// components/site-editor/RevisionsModal.tsx
// Lists the last 50 publish snapshots for a page and lets the admin restore
// any of them into the current draft. Same data as /admin/site/[pageId]/revisions
// but reachable without leaving the page.

import { useEffect, useState, useTransition } from "react";
import { toast } from "@/components/ui/Toaster";
import { listRevisionsAction, restoreRevisionAction, type RevisionSummary } from "@/app/admin/site/actions";

export function RevisionsModal({
  pageId,
  open,
  onClose,
  onRestored,
}: {
  pageId: string;
  open: boolean;
  onClose: () => void;
  onRestored: () => void;
}) {
  const [revisions, setRevisions] = useState<RevisionSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listRevisionsAction(pageId)
      .then((res) => {
        if (res.success) setRevisions(res.revisions);
        else toast(res.error);
      })
      .catch(() => toast("Failed to load revisions."))
      .finally(() => setLoading(false));
  }, [open, pageId]);

  if (!open) return null;

  function restore(revisionId: string) {
    if (!confirm("Restore this revision into the current draft? Any unsaved changes in the draft will be replaced.")) return;
    startTransition(async () => {
      const res = await restoreRevisionAction(pageId, revisionId);
      if (!res.success) {
        toast(res.error ?? "Restore failed.");
        return;
      }
      toast("Revision restored into draft.");
      onRestored();
      onClose();
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Revisions"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(42,42,40,0.6)",
        zIndex: 9100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--white)",
          width: "min(720px, 100%)",
          maxHeight: "82vh",
          overflow: "auto",
          padding: "1.5rem",
          border: "0.5px solid var(--border-strong)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1rem" }}>
          <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.6rem", fontWeight: 300, margin: 0 }}>
            Revisions
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "transparent", border: "none", fontSize: "0.72rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--charcoal-muted)", cursor: "pointer" }}
          >
            Close
          </button>
        </div>
        <p style={{ fontSize: "0.78rem", color: "var(--charcoal-muted)", marginTop: 0, marginBottom: "1.25rem", maxWidth: "44rem" }}>
          Every publish snapshots the live page. Restore copies that snapshot back into your draft — review and publish again to take it live. Last 50 publishes retained.
        </p>

        {loading && <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--charcoal-muted)" }}>Loading…</div>}
        {!loading && revisions !== null && revisions.length === 0 && (
          <div style={{ padding: "1.5rem", border: "0.5px dashed var(--border-strong)", textAlign: "center", color: "var(--charcoal-muted)" }}>
            No revisions yet — publish this page once to create the first snapshot.
          </div>
        )}
        {!loading && revisions !== null && revisions.length > 0 && (
          <div style={{ border: "0.5px solid var(--border)" }}>
            {revisions.map((r) => (
              <div
                key={r.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr auto",
                  gap: "1rem",
                  padding: "0.85rem 1rem",
                  borderBottom: "0.5px solid var(--border)",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.9rem", color: "var(--charcoal)" }}>
                    {r.publishedAtIso ? new Date(r.publishedAtIso).toLocaleString() : "—"}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--charcoal-muted)" }}>
                    {r.sectionCount} section{r.sectionCount === 1 ? "" : "s"}
                  </div>
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--charcoal-light)" }}>
                  {r.noteSummary ?? <em style={{ color: "var(--charcoal-muted)" }}>no note</em>}
                </div>
                <button
                  type="button"
                  onClick={() => restore(r.id)}
                  disabled={isPending}
                  style={{
                    padding: "0.5rem 1rem",
                    fontSize: "0.68rem",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    background: "transparent",
                    border: "0.5px solid var(--olive)",
                    color: "var(--olive)",
                    cursor: "pointer",
                  }}
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
