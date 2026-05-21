"use client";

// components/site-editor/EditBar.tsx
// Sticky top toolbar — Save Draft / Publish / Discard / Revisions / Exit.

import { editorStyles } from "./styles";

export const EDIT_BAR_HEIGHT = 56;

export function EditBar({
  pageLabel,
  dirty,
  saving,
  onSaveDraft,
  onPublish,
  onDiscard,
  onOpenRevisions,
  onExit,
}: {
  pageLabel: string;
  dirty: boolean;
  saving: boolean;
  onSaveDraft: () => void;
  onPublish: () => void;
  onDiscard: () => void;
  onOpenRevisions: () => void;
  onExit: () => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Site editor"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 8600,
        height: EDIT_BAR_HEIGHT,
        background: "var(--white)",
        borderBottom: "0.5px solid var(--border-strong)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 1.25rem",
        gap: "1rem",
        boxShadow: "0 1px 0 rgba(42,42,40,0.04)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", minWidth: 0 }}>
        <span
          style={{
            fontSize: "0.62rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--olive)",
          }}
        >
          Editing
        </span>
        <span
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "1.1rem",
            fontWeight: 300,
            color: "var(--charcoal)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {pageLabel}
        </span>
        <span
          style={{
            fontSize: "0.7rem",
            color: dirty ? "var(--olive)" : "var(--charcoal-muted)",
            letterSpacing: "0.06em",
          }}
        >
          {dirty ? "• Unsaved changes" : "• Saved"}
        </span>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button type="button" onClick={onOpenRevisions} style={editorStyles.secondaryBtn}>
          Revisions
        </button>
        <button type="button" onClick={onDiscard} disabled={saving} style={editorStyles.secondaryBtn}>
          Discard
        </button>
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={saving || !dirty}
          style={{ ...editorStyles.primaryBtn, opacity: saving || !dirty ? 0.55 : 1 }}
        >
          {saving ? "Saving…" : "Save draft"}
        </button>
        <button
          type="button"
          onClick={onPublish}
          disabled={saving || dirty}
          style={{ ...editorStyles.publishBtn, opacity: saving || dirty ? 0.55 : 1 }}
          title={dirty ? "Save the draft first" : "Publish current draft"}
        >
          Publish
        </button>
        <button type="button" onClick={onExit} style={editorStyles.secondaryBtn}>
          Exit
        </button>
      </div>
    </div>
  );
}
