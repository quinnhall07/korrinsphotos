"use client";

// app/portfolio/PortfolioClient.tsx
// Handles the active filter tab state and filters the photo array accordingly.
// The parent Server Component passes all photos; filtering is purely client-side.

import { useState } from "react";
import { MasonryGrid, type MasonryPhoto } from "@/components/MasonryGrid";

type Category = "all" | "wedding" | "portrait" | "editorial" | "landscape";

const TABS: { label: string; value: Category }[] = [
  { label: "All Work", value: "all" },
  { label: "Weddings", value: "wedding" },
  { label: "Portraits", value: "portrait" },
  { label: "Editorial", value: "editorial" },
  { label: "Landscape", value: "landscape" },
];

export function PortfolioClient({ photos }: { photos: MasonryPhoto[] }) {
  const [activeCategory, setActiveCategory] = useState<Category>("all");

  const filtered =
    activeCategory === "all"
      ? photos
      : photos.filter((p) => p.category === activeCategory);

  return (
    <>
      {/* Filter bar */}
      <div
        style={{
          display: "flex",
          gap: 0,
          padding: "0 4rem",
          marginBottom: "2.5rem",
          borderBottom: "0.5px solid var(--border)",
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveCategory(tab.value)}
            style={{
              padding: "0.8rem 1.5rem",
              fontSize: "0.72rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              cursor: "pointer",
              color:
                activeCategory === tab.value
                  ? "var(--charcoal)"
                  : "var(--charcoal-muted)",
              borderBottom:
                activeCategory === tab.value
                  ? "1.5px solid var(--olive)"
                  : "1.5px solid transparent",
              marginBottom: "-0.5px",
              background: "none",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              fontFamily: "'Jost', sans-serif",
              transition: "all 0.2s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div style={{ padding: "0 4rem 5rem" }}>
        {filtered.length > 0 ? (
          <MasonryGrid photos={filtered} columns={3} />
        ) : (
          <p
            style={{
              color: "var(--charcoal-muted)",
              fontSize: "0.88rem",
              paddingTop: "2rem",
            }}
          >
            No photos in this category yet.
          </p>
        )}
      </div>
    </>
  );
}