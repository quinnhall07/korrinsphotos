"use client";

// components/site-editor/SectionToolbar.tsx
// Floating toolbar for the SELECTED section. Replaces the inline ↑↓/dup/del
// buttons that used to live inside SectionWrapper. Shown only when the section
// is selected (parent guards the render).
//
// The drag-handle button is the ONLY element that gets dnd-kit's pointer
// listeners (passed in via dragHandleProps / dragHandleRef), so plain clicks
// and contentEditable text editing are never swallowed.

import React from "react";
import { TOP_BAR_HEIGHT } from "./EditorTopBar";

interface Props {
  onDuplicate: () => void;
  onOpenSettings: () => void;
  onDelete: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  dragHandleRef?: (el: HTMLButtonElement | null) => void;
}

export function SectionToolbar({
  onDuplicate,
  onOpenSettings,
  onDelete,
  dragHandleProps,
  dragHandleRef,
}: Props) {
  return (
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
      {/* Drag handle — dnd-kit listeners attach ONLY here */}
      <ToolbarBtn
        label="Drag to reorder"
        ref={dragHandleRef}
        cursor="grab"
        {...dragHandleProps}
      >
        ⠿
      </ToolbarBtn>
      <ToolbarBtn label="Duplicate" onClick={onDuplicate}>
        ⎘
      </ToolbarBtn>
      <ToolbarBtn label="Edit section" onClick={onOpenSettings}>
        Edit
      </ToolbarBtn>
      <ToolbarBtn label="Delete" onClick={onDelete} danger>
        ×
      </ToolbarBtn>
    </div>
  );
}

// ─── ToolbarBtn ────────────────────────────────────────────────────────────────

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  danger?: boolean;
  cursor?: React.CSSProperties["cursor"];
  children: React.ReactNode;
}

const ToolbarBtn = React.forwardRef<HTMLButtonElement, BtnProps>(
  function ToolbarBtn(
    { label, danger, cursor, children, style, ...rest },
    ref
  ) {
    return (
      <button
        type="button"
        title={label}
        aria-label={label}
        ref={ref}
        style={{
          minWidth: 32,
          height: 32,
          padding: "0 6px",
          background: "transparent",
          border: "0.5px solid var(--border)",
          cursor: cursor ?? (rest.disabled ? "not-allowed" : "pointer"),
          fontSize: "0.95rem",
          color: danger ? "#a83232" : "var(--charcoal-light)",
          opacity: rest.disabled ? 0.35 : 1,
          userSelect: "none",
          touchAction: "none",
          ...style,
        }}
        {...rest}
      >
        {children}
      </button>
    );
  }
);
