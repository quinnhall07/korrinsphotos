"use client";

// components/site-editor/EditableImage.tsx
// Dual-mode image primitive used by the site-editor render layer.
//
// Read mode  — identical <img> output to the pre-edit render.tsx path.
// Edit mode  — same <img> but wrapped with a hover overlay so clicking it
//              calls onClick() (opens the photo picker).
//
// Also exports AddImageTile: a dashed placeholder shown in edit mode when
// no photo has been set yet, or as an "append" affordance at the end of a
// photo array.

import React, { useState } from "react";

// ─── EditableImage ──────────────────────────────────────────────────────────

export interface EditableImageProps {
  src: string;
  alt: string;
  editing: boolean;
  onClick: () => void;
  style?: React.CSSProperties;
  /** Style applied to the outer wrapper div in edit mode. */
  wrapperStyle?: React.CSSProperties;
  /** Text shown in the replace overlay. Defaults to "⇄ Replace". */
  overlayLabel?: string;
}

export function EditableImage({
  src,
  alt,
  editing,
  onClick,
  style,
  wrapperStyle,
  overlayLabel = "⇄ Replace",
}: EditableImageProps) {
  const [hover, setHover] = useState(false);

  if (!editing) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        onContextMenu={(e) => e.preventDefault()}
        draggable={false}
        style={style}
      />
    );
  }

  return (
    <div
      style={{ position: "relative", display: "inline-block", cursor: "pointer", ...wrapperStyle }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onContextMenu={(e) => e.preventDefault()}
        draggable={false}
        style={style}
      />
      {hover && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(42,42,40,0.5)",
            color: "var(--white)",
            fontSize: "0.72rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontFamily: "'Jost', sans-serif",
            cursor: "pointer",
            pointerEvents: "none",
          }}
        >
          {overlayLabel}
        </div>
      )}
    </div>
  );
}

// ─── AddImageTile ────────────────────────────────────────────────────────────
// Shown in edit mode as an append affordance when there is no image yet,
// or at the tail of a photo array. Invisible in read mode — only rendered
// when editing is true.

export interface AddImageTileProps {
  onClick: () => void;
  label?: string;
  style?: React.CSSProperties;
}

export function AddImageTile({
  onClick,
  label = "＋ Add image",
  style,
}: AddImageTileProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        minHeight: "8rem",
        border: "1px dashed var(--border-strong)",
        background: "transparent",
        color: "var(--charcoal-muted)",
        fontFamily: "'Jost', sans-serif",
        fontSize: "0.8rem",
        letterSpacing: "0.1em",
        cursor: "pointer",
        ...style,
      }}
    >
      {label}
    </button>
  );
}
