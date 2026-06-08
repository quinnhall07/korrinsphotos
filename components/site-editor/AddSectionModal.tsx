"use client";

// components/site-editor/AddSectionModal.tsx
// Guided modal gallery for inserting a new section. Replaces the old inline
// dropdown from AddSectionGap. Follows the same overlay/panel pattern as
// ConfirmDialog (z-index 8800, Escape + backdrop close).

import { useEffect } from "react";
import type { SectionType } from "@/lib/site-content/types";
import { SECTION_LABEL, SECTION_DESCRIPTION } from "./styles";

export function AddSectionModal({
  open,
  allowedSections,
  onPick,
  onClose,
}: {
  open: boolean;
  allowedSections: readonly SectionType[];
  onPick: (type: SectionType) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div onClick={onClose} style={overlay}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Add a section"
      >
        {/* Header */}
        <div style={headerRow}>
          <h3 style={modalTitle}>
            Add a <em>section</em>
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={closeBtn}
            aria-label="Close"
          >
            &#x2715;
          </button>
        </div>

        {/* Tile grid */}
        <div style={tileGrid}>
          {allowedSections.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onPick(type)}
              style={tile}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  "var(--olive)";
                (e.currentTarget as HTMLButtonElement).style.background =
                  "var(--olive-dim)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  "var(--border)";
                (e.currentTarget as HTMLButtonElement).style.background =
                  "var(--white)";
              }}
            >
              <span style={tileLabel}>{SECTION_LABEL[type] ?? type}</span>
              <span style={tileDesc}>
                {SECTION_DESCRIPTION[type] ?? ""}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(42,42,40,0.28)",
  zIndex: 8800,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1.5rem",
};

const panel: React.CSSProperties = {
  background: "var(--white)",
  border: "0.5px solid var(--border-strong)",
  borderRadius: 8,
  padding: "1.75rem",
  maxWidth: 680,
  width: "100%",
  maxHeight: "80vh",
  overflowY: "auto",
  boxShadow: "0 20px 50px rgba(0,0,0,0.18)",
};

const headerRow: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  marginBottom: "1.5rem",
};

const modalTitle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 300,
  fontSize: "1.6rem",
  margin: 0,
  color: "var(--charcoal)",
};

const closeBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  fontSize: "1rem",
  color: "var(--charcoal-muted)",
  cursor: "pointer",
  padding: "0.2rem 0.4rem",
  lineHeight: 1,
};

const tileGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
  gap: "0.75rem",
};

const tile: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "0.35rem",
  padding: "1rem 1rem 1rem",
  background: "var(--white)",
  border: "0.5px solid var(--border)",
  cursor: "pointer",
  textAlign: "left",
  transition: "border-color 0.15s ease, background 0.15s ease",
};

const tileLabel: React.CSSProperties = {
  display: "block",
  fontFamily: "'Jost', sans-serif",
  fontWeight: 500,
  fontSize: "0.88rem",
  color: "var(--charcoal)",
  letterSpacing: "0.02em",
};

const tileDesc: React.CSSProperties = {
  display: "block",
  fontFamily: "'Jost', sans-serif",
  fontWeight: 300,
  fontSize: "0.78rem",
  color: "var(--charcoal-muted)",
  lineHeight: 1.5,
};
