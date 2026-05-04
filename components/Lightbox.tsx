"use client";

// components/Lightbox.tsx
// Full-screen lightbox driven by React state — no vanilla JS global functions.
// Keyboard navigation (←, →, Escape), click-outside to close.
// Images protected: no context menu, no drag.

import { useEffect, useCallback, useState } from "react";
import type { MasonryPhoto } from "@/components/MasonryGrid";

interface LightboxProps {
  photos: MasonryPhoto[];
  initialIndex: number;
  eventName?: string;
  onClose: () => void;
}

export function Lightbox({
  photos,
  initialIndex,
  eventName,
  onClose,
}: LightboxProps) {
  const [index, setIndex] = useState(initialIndex);

  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + photos.length) % photos.length);
  }, [photos.length]);

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % photos.length);
  }, [photos.length]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    // Prevent body scroll while lightbox is open
    document.body.classList.add("lightbox-open");
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.classList.remove("lightbox-open");
    };
  }, [prev, next, onClose]);

  const current = photos[index];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(20,20,18,0.96)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: 1,
        animation: "fadeIn 0.35s ease",
      }}
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        style={navButtonStyle}
        aria-label="Close lightbox"
        onContextMenu={(e) => e.preventDefault()}
        {...{ style: { ...navButtonStyle, position: "fixed", top: "1.5rem", right: "2rem" } }}
      >
        ✕
      </button>

      {/* Prev */}
      {photos.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); prev(); }}
          style={{ ...navButtonStyle, position: "fixed", top: "50%", left: "1.5rem", transform: "translateY(-50%)" }}
          aria-label="Previous photo"
        >
          ←
        </button>
      )}

      {/* Image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={current.src}
        alt={current.label ?? ""}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
        draggable={false}
        style={{
          maxWidth: "90vw",
          maxHeight: "90vh",
          objectFit: "contain",
          userSelect: "none",
          pointerEvents: "none",
          transition: "opacity 0.3s",
        }}
      />

      {/* Next */}
      {photos.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); next(); }}
          style={{ ...navButtonStyle, position: "fixed", top: "50%", right: "1.5rem", transform: "translateY(-50%)" }}
          aria-label="Next photo"
        >
          →
        </button>
      )}

      {/* Counter */}
      <div
        style={{
          position: "fixed",
          bottom: "1.5rem",
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: "0.68rem",
          letterSpacing: "0.14em",
          color: "rgba(250,249,246,0.5)",
        }}
      >
        {index + 1} / {photos.length}
      </div>

      {/* Label / event name */}
      {(current.label || eventName) && (
        <div
          style={{
            position: "fixed",
            bottom: "1.5rem",
            right: "2rem",
            fontSize: "0.68rem",
            letterSpacing: "0.08em",
            color: "rgba(250,249,246,0.4)",
            fontStyle: "italic",
            fontFamily: "'Cormorant Garamond', serif",
          }}
        >
          {current.label}
          {current.label && eventName ? " · " : ""}
          {eventName}
        </div>
      )}
    </div>
  );
}

const navButtonStyle: React.CSSProperties = {
  width: "44px",
  height: "44px",
  background: "none",
  border: "0.5px solid rgba(250,249,246,0.2)",
  color: "#FAF9F6",
  fontSize: "1.1rem",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "border-color 0.2s",
};