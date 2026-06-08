"use client";

// components/site-editor/FocalPointPicker.tsx
// Click-to-set focal point control for a PhotoRef.
//
// Renders a small thumbnail of the photo (via the "thumbnail" CDN variant)
// with a draggable/clickable dot. Clicking anywhere on the image moves the
// dot and fires onChange(focalX, focalY) with values clamped to [0, 1].
// Drag is also supported: pointerdown → pointermove → pointerup.

import React, { useCallback, useRef } from "react";
import { buildCdnUrl } from "@/lib/cloudflare";

interface Props {
  cloudflareImageId: string;
  focalX?: number;
  focalY?: number;
  onChange: (focalX: number, focalY: number) => void;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function hitToFocal(e: React.PointerEvent<HTMLDivElement>): [number, number] {
  const rect = e.currentTarget.getBoundingClientRect();
  const x = clamp((e.clientX - rect.left) / rect.width);
  const y = clamp((e.clientY - rect.top) / rect.height);
  return [x, y];
}

export function FocalPointPicker({ cloudflareImageId, focalX = 0.5, focalY = 0.5, onChange }: Props) {
  const dragging = useRef(false);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      dragging.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      const [x, y] = hitToFocal(e);
      onChange(x, y);
    },
    [onChange]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      const [x, y] = hitToFocal(e);
      onChange(x, y);
    },
    [onChange]
  );

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          position: "relative",
          width: "100%",
          height: "72px",
          cursor: "crosshair",
          userSelect: "none",
          touchAction: "none",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={buildCdnUrl(cloudflareImageId, "thumbnail")}
          alt=""
          draggable={false}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", pointerEvents: "none" }}
        />
        {/* Focal dot */}
        <div
          style={{
            position: "absolute",
            left: `${focalX * 100}%`,
            top: `${focalY * 100}%`,
            transform: "translate(-50%, -50%)",
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "var(--olive)",
            border: "2px solid var(--white)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
            pointerEvents: "none",
          }}
        />
      </div>
      <p style={{ margin: 0, fontSize: "0.65rem", color: "var(--charcoal-muted)", letterSpacing: "0.04em" }}>
        Click or drag to set focal point
      </p>
    </div>
  );
}
