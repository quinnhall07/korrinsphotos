"use client";

// components/SlideshowOverlay.tsx
// Phase 2.6 — Full-screen slideshow viewer for client galleries.
//
// Behaviour:
//   - Mounts a fixed full-screen overlay above the rest of the page.
//   - Auto-advances on a configurable interval (3 / 5 / 8 seconds, or
//     "Manual" to disable auto-advance entirely).
//   - Keyboard model:
//       Space     → toggle play/pause
//       Esc       → exit slideshow
//       ArrowLeft → previous photo (also pauses auto-advance for one tick)
//       ArrowRight→ next photo
//   - Mobile swipe model (touch only):
//       Horizontal delta ≥ 60px → prev/next
//       Vertical pull-down ≥ 120px → exit
//   - Optional background music: looks for `/audio/gallery-loop.mp3`. The
//     audio element is muted by default (modern browsers block autoplay
//     with sound), and a 🔊 / 🔇 toggle lets the user unmute. Note: drop a
//     file at `public/audio/gallery-loop.mp3` to enable music; if absent the
//     <audio> element silently fails to load and the toggle still works
//     (just produces nothing).
//
// Implementation note: we deliberately do not pre-fetch upcoming photos —
// the CDN keeps cached variants warm, and the visible photo's <img> set
// triggers the browser to fetch the next when it scrolls into view.

import { useCallback, useEffect, useRef, useState } from "react";
import type { MasonryPhoto } from "@/components/MasonryGrid";

interface SlideshowOverlayProps {
  photos: MasonryPhoto[];
  initialIndex?: number;
  onClose: () => void;
  eventName?: string;
}

type IntervalOption = 3 | 5 | 8 | 0; // 0 = manual (no auto-advance)

const INTERVAL_LABELS: Record<IntervalOption, string> = {
  3: "3s",
  5: "5s",
  8: "8s",
  0: "Manual",
};

const HORIZONTAL_SWIPE_PX = 60;
const VERTICAL_DISMISS_PX = 120;

export function SlideshowOverlay({
  photos,
  initialIndex = 0,
  onClose,
  eventName,
}: SlideshowOverlayProps) {
  const [index, setIndex] = useState(initialIndex);
  const [intervalMs, setIntervalMs] = useState<IntervalOption>(5);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + photos.length) % photos.length);
  }, [photos.length]);

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % photos.length);
  }, [photos.length]);

  // Auto-advance timer. Resets whenever index, interval, or playing flips.
  useEffect(() => {
    if (!playing) return;
    if (intervalMs === 0) return;
    const handle = window.setTimeout(() => {
      setIndex((i) => (i + 1) % photos.length);
    }, intervalMs * 1000);
    return () => window.clearTimeout(handle);
  }, [index, intervalMs, playing, photos.length]);

  // Keyboard bindings.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        prev();
      } else if (e.key === "ArrowRight") {
        next();
      }
    };
    window.addEventListener("keydown", handler);
    document.body.classList.add("lightbox-open");
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.classList.remove("lightbox-open");
    };
  }, [prev, next, onClose]);

  // Honour mute toggle on the <audio> element. Modern browsers refuse to
  // start playback without a user gesture; the toggle button click *is*
  // that gesture, so calling .play() inside the click handler is fine.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.muted = muted;
  }, [muted]);

  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 1) {
      touchStartRef.current = null;
      return;
    }
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
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

    if (dy >= VERTICAL_DISMISS_PX && absY > absX) {
      onClose();
      return;
    }
    if (absX >= HORIZONTAL_SWIPE_PX && absX > absY) {
      if (dx < 0) next();
      else prev();
    }
  }

  function toggleMute() {
    setMuted((m) => {
      const nextMuted = !m;
      const el = audioRef.current;
      if (el && !nextMuted) {
        // First unmute also starts playback.
        el.play().catch(() => {
          /* autoplay rejected — leave the toggle in unmuted state regardless */
        });
      }
      return nextMuted;
    });
  }

  const current = photos[index];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        background: "#0d0d0c",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "fadeIn 0.35s ease",
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background music — silently no-ops if the file is missing. */}
      <audio
        ref={audioRef}
        src="/audio/gallery-loop.mp3"
        loop
        muted
        autoPlay
        preload="auto"
      />

      {/* Image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={current.src}
        alt={current.label ?? ""}
        onContextMenu={(e) => e.preventDefault()}
        draggable={false}
        style={{
          maxWidth: "94vw",
          maxHeight: "92vh",
          objectFit: "contain",
          userSelect: "none",
          pointerEvents: "none",
          transition: "opacity 0.4s",
        }}
      />

      {/* Top toolbar — interval picker, mute, close. */}
      <div
        style={{
          position: "fixed",
          top: "1rem",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          background: "rgba(20,20,18,0.7)",
          padding: "0.4rem 0.6rem",
          border: "0.5px solid rgba(250,249,246,0.15)",
        }}
      >
        {([3, 5, 8, 0] as IntervalOption[]).map((opt) => (
          <button
            key={opt}
            onClick={() => setIntervalMs(opt)}
            style={{
              padding: "0.35rem 0.7rem",
              fontSize: "0.66rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              background: intervalMs === opt ? "var(--olive)" : "transparent",
              color:
                intervalMs === opt ? "var(--white)" : "rgba(250,249,246,0.7)",
              border: "0.5px solid rgba(250,249,246,0.15)",
              cursor: "pointer",
              fontFamily: "'Jost', sans-serif",
            }}
          >
            {INTERVAL_LABELS[opt]}
          </button>
        ))}

        <span
          style={{
            width: "1px",
            height: "1.5rem",
            background: "rgba(250,249,246,0.15)",
            margin: "0 0.3rem",
          }}
        />

        <button
          onClick={() => setPlaying((p) => !p)}
          style={iconButtonStyle}
          aria-label={playing ? "Pause slideshow" : "Play slideshow"}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <button
          onClick={toggleMute}
          style={iconButtonStyle}
          aria-label={muted ? "Unmute background music" : "Mute background music"}
          title={muted ? "Unmute" : "Mute"}
        >
          {muted ? "🔇" : "🔊"}
        </button>
        <button onClick={onClose} style={iconButtonStyle} aria-label="Exit slideshow">
          ✕
        </button>
      </div>

      {/* Prev / next */}
      {photos.length > 1 && (
        <>
          <button
            onClick={prev}
            style={{
              ...iconButtonStyle,
              position: "fixed",
              top: "50%",
              left: "1rem",
              transform: "translateY(-50%)",
              width: "44px",
              height: "44px",
            }}
            aria-label="Previous photo"
          >
            ←
          </button>
          <button
            onClick={next}
            style={{
              ...iconButtonStyle,
              position: "fixed",
              top: "50%",
              right: "1rem",
              transform: "translateY(-50%)",
              width: "44px",
              height: "44px",
            }}
            aria-label="Next photo"
          >
            →
          </button>
        </>
      )}

      {/* Counter + caption */}
      <div
        style={{
          position: "fixed",
          bottom: "1rem",
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: "0.68rem",
          letterSpacing: "0.14em",
          color: "rgba(250,249,246,0.55)",
          fontFamily: "'Jost', sans-serif",
        }}
      >
        {index + 1} / {photos.length}
        {current.label ? ` — ${current.label}` : ""}
        {eventName && !current.label ? ` — ${eventName}` : ""}
      </div>
    </div>
  );
}

const iconButtonStyle: React.CSSProperties = {
  width: "32px",
  height: "32px",
  background: "transparent",
  border: "0.5px solid rgba(250,249,246,0.15)",
  color: "rgba(250,249,246,0.85)",
  fontSize: "0.9rem",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "'Jost', sans-serif",
};
