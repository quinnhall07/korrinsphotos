"use client";

// components/site-editor/AddSectionGap.tsx
// Hover-revealed "+ Add section" between sections (and at top/bottom). Opens
// a tiny inline menu of allowedSections for the current page.

import { useState, useRef, useEffect } from "react";
import type { SectionType } from "@/lib/site-content/types";
import { SECTION_LABEL } from "./styles";

export function AddSectionGap({
  index,
  allowedSections,
  onInsert,
}: {
  index: number;
  allowedSections: readonly SectionType[];
  onInsert: (type: SectionType, atIndex: number) => void;
}) {
  const [hover, setHover] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [menuOpen]);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        height: hover || menuOpen ? "2rem" : "0.5rem",
        transition: "height 0.18s ease",
        margin: "0 4rem",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          right: 0,
          height: "0.5px",
          background: hover || menuOpen ? "var(--olive)" : "transparent",
          transform: "translateY(-50%)",
          transition: "background 0.15s ease",
        }}
      />
      {(hover || menuOpen) && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }} ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            style={{
              padding: "0.25rem 0.75rem",
              fontSize: "0.65rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              background: "var(--white)",
              border: "0.5px solid var(--olive)",
              color: "var(--olive)",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            + Add section
          </button>
          {menuOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 0.25rem)",
                left: "50%",
                transform: "translateX(-50%)",
                background: "var(--white)",
                border: "0.5px solid var(--border-strong)",
                boxShadow: "0 6px 22px rgba(42,42,40,0.14)",
                padding: "0.35rem",
                display: "flex",
                flexDirection: "column",
                minWidth: 180,
                zIndex: 8400,
              }}
            >
              {allowedSections.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    onInsert(t, index);
                    setMenuOpen(false);
                  }}
                  style={{
                    padding: "0.5rem 0.75rem",
                    background: "transparent",
                    border: "none",
                    textAlign: "left",
                    fontSize: "0.85rem",
                    color: "var(--charcoal)",
                    cursor: "pointer",
                  }}
                >
                  {SECTION_LABEL[t] ?? t}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
