"use client";

// components/site-editor/AddSectionGap.tsx
// Hover-revealed thin "+ Add section" line rendered between sections (and at
// top/bottom of the canvas). Clicking calls onRequestAdd(index); the modal
// logic lives in the parent (SectionsCanvas / AddSectionModal).

import { useState } from "react";

export function AddSectionGap({
  index,
  onRequestAdd,
}: {
  index: number;
  onRequestAdd: (index: number) => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        height: hover ? "2rem" : "0.5rem",
        transition: "height 0.18s ease",
        margin: "0 4rem",
      }}
    >
      {/* Thin horizontal line */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          right: 0,
          height: "0.5px",
          background: hover ? "var(--olive)" : "transparent",
          transform: "translateY(-50%)",
          transition: "background 0.15s ease",
        }}
      />

      {/* "+ Add section" pill — only visible on hover */}
      {hover && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          <button
            type="button"
            onClick={() => onRequestAdd(index)}
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
        </div>
      )}
    </div>
  );
}
