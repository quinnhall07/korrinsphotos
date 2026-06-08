"use client";

// components/site-editor/SectionWrapper.tsx
// Hover outline + click-to-select. Wraps every rendered section in edit mode.
//
// The per-section action toolbar (drag / duplicate / edit / delete) is now
// provided externally via the `toolbar` prop and rendered by the canvas /
// SortableSection when the section is selected. This keeps the wrapper slim
// and decoupled from the dnd-kit wiring.

import { useState } from "react";

interface Props {
  sectionId: string;
  selected: boolean;
  onSelect: () => void;
  /** Optional toolbar node rendered when the section is selected. */
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}

export function SectionWrapper({
  sectionId,
  selected,
  onSelect,
  toolbar,
  children,
}: Props) {
  const [hover, setHover] = useState(false);
  const outlineVisible = selected || hover;

  return (
    <div
      data-editable-section-id={sectionId}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={(e) => {
        // If the click is inside a contentEditable element (EditableText in
        // edit mode), let the browser place the caret — do not select/intercept.
        const target = e.target as HTMLElement;
        if (target.closest('[contenteditable="true"]')) {
          return;
        }
        // Block internal links inside the section from navigating during edit
        // mode — instead, treat any click as a section-select.
        const link = target.closest("a");
        if (link) {
          e.preventDefault();
          e.stopPropagation();
        }
        onSelect();
      }}
      style={{
        position: "relative",
        outline: outlineVisible
          ? `2px solid ${selected ? "var(--olive)" : "rgba(107,120,69,0.4)"}`
          : "2px solid transparent",
        outlineOffset: "-2px",
        transition: "outline-color 0.15s ease",
        cursor: "pointer",
      }}
    >
      {children}
      {selected && toolbar}
    </div>
  );
}
