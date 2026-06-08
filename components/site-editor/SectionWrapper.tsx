"use client";

// components/site-editor/SectionWrapper.tsx
// Hover outline + click-to-select + per-section floating toolbar (move up /
// move down / duplicate / delete). Wraps every rendered section in edit mode.

import { useState } from "react";
import { TOP_BAR_HEIGHT } from "./EditorTopBar";

interface Props {
  sectionId: string;
  selected: boolean;
  isFirst: boolean;
  isLast: boolean;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}

export function SectionWrapper({
  sectionId,
  selected,
  isFirst,
  isLast,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
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
      {selected && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "sticky",
            top: `calc(${TOP_BAR_HEIGHT}px + 0.5rem)`,
            marginTop: "-2.5rem",
            float: "right",
            zIndex: 8400,
            display: "flex",
            gap: "0.25rem",
            padding: "0.25rem",
            background: "var(--white)",
            border: "0.5px solid var(--olive)",
            boxShadow: "0 4px 14px rgba(42,42,40,0.12)",
            marginRight: "0.5rem",
          }}
        >
          <ToolbarBtn label="Move up" onClick={onMoveUp} disabled={isFirst}>↑</ToolbarBtn>
          <ToolbarBtn label="Move down" onClick={onMoveDown} disabled={isLast}>↓</ToolbarBtn>
          <ToolbarBtn label="Duplicate" onClick={onDuplicate}>⎘</ToolbarBtn>
          <ToolbarBtn label="Delete" onClick={onDelete} danger>×</ToolbarBtn>
        </div>
      )}
    </div>
  );
}

function ToolbarBtn({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 32,
        height: 32,
        background: "transparent",
        border: "0.5px solid var(--border)",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: "0.95rem",
        color: danger ? "#a83232" : "var(--charcoal-light)",
        opacity: disabled ? 0.35 : 1,
      }}
    >
      {children}
    </button>
  );
}
