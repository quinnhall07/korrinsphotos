"use client";

// components/HeroSlideshow.tsx
// Auto-advancing full-screen hero with opacity crossfade between slides.
// Slides are the public Cloudflare Images portfolio shots (or dev placeholders).

import { useState, useEffect } from "react";
import Link from "next/link";

const SLIDES = [
  { seed: "forest88", url: "https://picsum.photos/seed/forest88/1600/900" },
  { seed: "couple44", url: "https://picsum.photos/seed/couple44/1600/900" },
  { seed: "golden22", url: "https://picsum.photos/seed/golden22/1600/900" },
];

export function HeroSlideshow() {
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIdx((i) => (i + 1) % SLIDES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        position: "relative",
        height: "calc(100vh - 72px)",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Slides */}
      {SLIDES.map((slide, i) => (
        <div
          key={slide.seed}
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url('${slide.url}')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: i === activeIdx ? 1 : 0,
            transition: "opacity 1.8s ease",
          }}
        >
          {/* Dark gradient overlay */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to bottom, rgba(42,42,40,0.15) 0%, rgba(42,42,40,0.42) 100%)",
            }}
          />
        </div>
      ))}

      {/* Hero content */}
      <div
        className="hero-animate"
        style={{
          position: "relative",
          zIndex: 2,
          textAlign: "center",
          color: "var(--white)",
        }}
      >
        <p
          style={{
            fontSize: "0.68rem",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            fontWeight: 400,
            marginBottom: "1.2rem",
            opacity: 0.85,
          }}
        >
          Photography &amp; Visual Storytelling
        </p>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "clamp(3.5rem, 8vw, 7rem)",
            fontWeight: 300,
            lineHeight: 1.05,
            letterSpacing: "-0.01em",
            marginBottom: "1.6rem",
          }}
        >
          Moments that
          <br />
          <em>linger</em>
        </h1>
        <p
          style={{
            fontSize: "0.82rem",
            letterSpacing: "0.08em",
            fontWeight: 300,
            opacity: 0.8,
            maxWidth: "28rem",
            margin: "0 auto 2.5rem",
            lineHeight: 1.8,
          }}
        >
          Fine art photography for weddings, portraits, and editorial work —
          crafted with intention and an eye for the extraordinary.
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
          <Link
            href="/portfolio"
            style={{
              display: "inline-block",
              padding: "0.85rem 2.2rem",
              fontSize: "0.72rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              background: "transparent",
              color: "var(--white)",
              border: "0.5px solid rgba(250,249,246,0.4)",
              textDecoration: "none",
            }}
          >
            View Portfolio
          </Link>
          <Link
            href="/booking"
            style={{
              display: "inline-block",
              padding: "0.85rem 2.2rem",
              fontSize: "0.72rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              background: "var(--olive)",
              color: "var(--white)",
              textDecoration: "none",
            }}
          >
            Book a Session
          </Link>
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        className="scroll-bob"
        style={{
          position: "absolute",
          bottom: "2.5rem",
          left: "50%",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.5rem",
          color: "rgba(250,249,246,0.6)",
          fontSize: "0.62rem",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
        }}
      >
        <div
          style={{
            width: "0.5px",
            height: "2.5rem",
            background: "rgba(250,249,246,0.4)",
          }}
        />
        Scroll
      </div>
    </div>
  );
}