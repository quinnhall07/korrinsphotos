"use client";

// components/Lightbox.tsx
// Full-screen lightbox driven by React state — no vanilla JS global functions.
// Keyboard navigation (←, →, Escape), click-outside to close.
// Images protected: no context menu, no drag.
//
// Phase 2.6 — Mobile swipe gestures:
//   - Horizontal swipe (delta ≥ 60px, more horizontal than vertical) advances
//     to the previous/next photo.
//   - Vertical pull-down (delta ≥ 120px) dismisses the lightbox, matching
//     the iOS-photo-app feel.
// Pinch-zoom relies on native browser behaviour — we never set
// `touch-action: none` on the surface, so two-finger zoom works as expected.
//
// Phase 2.6 — Per-photo resolution picker:
//   - An overflow "Download" menu in the top toolbar offers three options:
//     `web` (~1200px), `print` (~2048px), `original` (R2 direct).
//   - Selecting `original` requires the photo to expose `r2Key` /
//     `storageKey` (passed in via `originalDownloadUrl`); when absent, the
//     option is disabled and a tooltip explains why.

import { useEffect, useCallback, useRef, useState } from "react";
import type { MasonryPhoto } from "@/components/MasonryGrid";

interface LightboxProps {
  photos: MasonryPhoto[];
  initialIndex: number;
  eventName?: string;
  onClose: () => void;
  /**
   * Phase 2.6 — Optional callback that builds a download URL for the
   * currently-viewed photo at the given resolution tier. If omitted the
   * download menu is hidden.
   */
  buildDownloadUrl?: (
    photo: MasonryPhoto,
    tier: ResolutionTier,
  ) => string | null;
  /**
   * Phase 13.10 — Optional fire-and-forget callback invoked once when the
   * viewer commits to a per-photo download (after the URL is opened). Used
   * by `GalleryViewer` to POST `/api/track/photo-download`. Side-effect
   * only; the return value is ignored.
   */
  onDownload?: (photo: MasonryPhoto, tier: ResolutionTier) => void;
}

export type ResolutionTier = "web" | "print" | "original";

const TIER_LABELS: Record<ResolutionTier, string> = {
  web: "Web (~1200px)",
  print: "Print (~2048px)",
  original: "Original",
};

// Swipe thresholds (in pixels).
const HORIZONTAL_SWIPE_PX = 60;
const VERTICAL_DISMISS_PX = 120;

export function Lightbox({
  photos,
  initialIndex,
  eventName,
  onClose,
  buildDownloadUrl,
  onDownload,
}: LightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const [menuOpen, setMenuOpen] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);

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

  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 1) {
      // Multi-finger gesture (pinch) — leave it to native browser zoom.
      touchStartRef.current = null;
      return;
    }
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const end = e.changedTouches[0];
    if (!end) return;
    const dx = end.clientX - start.x;
    const dy = end.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    // Vertical pull-down to dismiss takes priority when it's clearly vertical.
    if (dy >= VERTICAL_DISMISS_PX && absY > absX) {
      onClose();
      return;
    }

    // Horizontal swipe to advance / go back.
    if (absX >= HORIZONTAL_SWIPE_PX && absX > absY) {
      if (dx < 0) next();
      else prev();
    }
  }

  const current = photos[index];

  function pickDownload(tier: ResolutionTier) {
    if (!buildDownloadUrl) return;
    const url = buildDownloadUrl(current, tier);
    if (!url) return;
    setMenuOpen(false);
    // Open in a new tab — the response headers determine save vs view.
    window.open(url, "_blank", "noopener,noreferrer");
    // Phase 13.10 — fire analytics tracking. Best-effort; never throws.
    onDownload?.(current, tier);
  }

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
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top-right controls: download menu + close. */}
      <div
        style={{
          position: "fixed",
          top: "1.5rem",
          right: "2rem",
          display: "flex",
          gap: "0.5rem",
          zIndex: 2,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {buildDownloadUrl && (
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              style={{ ...navButtonStyle, width: "auto", padding: "0 0.85rem" }}
              aria-label="Download this photo"
            >
              ↓
            </button>
            {menuOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 0.4rem)",
                  right: 0,
                  background: "rgba(20,20,18,0.96)",
                  border: "0.5px solid rgba(250,249,246,0.2)",
                  minWidth: "180px",
                  padding: "0.3rem 0",
                }}
              >
                <div
                  style={{
                    padding: "0.4rem 0.8rem",
                    fontSize: "0.6rem",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "rgba(250,249,246,0.4)",
                    borderBottom: "0.5px solid rgba(250,249,246,0.1)",
                  }}
                >
                  Download this photo
                </div>
                {(["web", "print", "original"] as ResolutionTier[]).map((tier) => {
                  const url = buildDownloadUrl(current, tier);
                  const disabled = !url;
                  return (
                    <button
                      key={tier}
                      onClick={() => pickDownload(tier)}
                      disabled={disabled}
                      title={
                        disabled && tier === "original"
                          ? "Original not available for this photo"
                          : undefined
                      }
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "0.55rem 0.9rem",
                        background: "transparent",
                        border: "none",
                        color: disabled
                          ? "rgba(250,249,246,0.35)"
                          : "rgba(250,249,246,0.85)",
                        fontSize: "0.78rem",
                        fontFamily: "'Jost', sans-serif",
                        cursor: disabled ? "not-allowed" : "pointer",
                      }}
                    >
                      {TIER_LABELS[tier]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <button
          onClick={onClose}
          style={navButtonStyle}
          aria-label="Close lightbox"
          onContextMenu={(e) => e.preventDefault()}
        >
          ✕
        </button>
      </div>

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
          // pointerEvents: "none" was used to block right-click reliably. We
          // keep image taps from bubbling via the parent stopPropagation, so
          // leaving pointerEvents on means touch gestures register on the
          // image area — important for swipe on mobile.
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
