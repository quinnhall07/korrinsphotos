"use client";

// components/MasonryGrid.tsx
// Responsive CSS-columns masonry grid that works with both real Cloudflare
// photo data and the dev placeholder seeds used in the prototype.

import { useState } from "react";
import { Lightbox } from "@/components/Lightbox";

export interface MasonryPhoto {
  id: string;
  src: string;           // Full URL (already built by the parent/server)
  thumbnailSrc?: string; // Smaller variant for the grid tiles
  label?: string;
  category?: string;
  height?: number;       // Aspect-ratio hint for skeleton placeholders
}

interface MasonryGridProps {
  photos: MasonryPhoto[];
  columns?: 2 | 3 | 4;
  eventName?: string;
}

const HEIGHTS = [280, 340, 260, 420, 300, 380, 250, 350, 290, 410, 270, 360];

export function MasonryGrid({
  photos,
  columns = 3,
  eventName,
}: MasonryGridProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <>
      {/* CSS-columns masonry — no JS layout, works with SSR */}
      <div
        style={{
          columns,
          columnGap: "1rem",
        }}
      >
        {photos.map((photo, i) => {
          const h = photo.height ?? HEIGHTS[i % HEIGHTS.length];
          return (
            <div
              key={photo.id}
              className="masonry-item"
              onClick={() => setLightboxIndex(i)}
              style={{ breakInside: "avoid", marginBottom: "1rem" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.thumbnailSrc ?? photo.src}
                alt={photo.label ?? ""}
                loading="lazy"
                onContextMenu={(e) => e.preventDefault()}
                draggable={false}
                style={{
                  height: `${h}px`,
                  width: "100%",
                  objectFit: "cover",
                  display: "block",
                  pointerEvents: "none",
                  userSelect: "none",
                }}
              />
              <div className="overlay">
                <span className="photo-label">{photo.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox — only mounted when a photo is open */}
      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          initialIndex={lightboxIndex}
          eventName={eventName}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}