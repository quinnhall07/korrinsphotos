"use client";

// components/MasonryGrid.tsx
// Responsive CSS-columns masonry grid that works with both real Cloudflare
// photo data and the dev placeholder seeds used in the prototype.

import { useState, type ReactNode } from "react";
import { Lightbox, type ResolutionTier } from "@/components/Lightbox";

export interface MasonryPhoto {
  id: string;
  src: string;           // Full URL (already built by the parent/server)
  thumbnailSrc?: string; // Smaller variant for the grid tiles
  label?: string;
  category?: string;
  height?: number;       // Aspect-ratio hint for skeleton placeholders
}

interface MasonryGridProps<T extends MasonryPhoto = MasonryPhoto> {
  photos: T[];
  columns?: 2 | 3 | 4;
  eventName?: string;
  /**
   * Phase 2.5 — optional per-tile overlay. Used by `GalleryViewer` to render
   * a heart button on top of every photo for the favorites flow. The button
   * must stop click propagation; otherwise tapping it would also open the
   * lightbox.
   */
  renderOverlay?: (photo: T) => ReactNode;
  /**
   * Phase 2.6 — optional URL builder forwarded to the Lightbox so its
   * "Download this photo" submenu can resolve `web` / `print` / `original`
   * variants. When omitted the menu is hidden.
   */
  buildDownloadUrl?: (photo: T, tier: ResolutionTier) => string | null;
  /**
   * Phase 13.10 — fire-and-forget callback invoked after the viewer commits
   * to a per-photo download from the lightbox. Forwarded to the Lightbox.
   */
  onDownload?: (photo: T, tier: ResolutionTier) => void;
}

const HEIGHTS = [280, 340, 260, 420, 300, 380, 250, 350, 290, 410, 270, 360];

export function MasonryGrid<T extends MasonryPhoto = MasonryPhoto>({
  photos,
  columns = 3,
  eventName,
  renderOverlay,
  buildDownloadUrl,
  onDownload,
}: MasonryGridProps<T>) {
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
              data-photo-id={photo.id}
              onClick={() => setLightboxIndex(i)}
              style={{ breakInside: "avoid", marginBottom: "1rem", position: "relative" }}
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
              {renderOverlay?.(photo)}
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
          buildDownloadUrl={
            buildDownloadUrl
              ? (p, tier) => buildDownloadUrl(p as T, tier)
              : undefined
          }
          onDownload={
            onDownload
              ? (p, tier) => onDownload(p as T, tier)
              : undefined
          }
        />
      )}
    </>
  );
}