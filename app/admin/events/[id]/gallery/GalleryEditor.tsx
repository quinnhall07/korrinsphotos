"use client";

// app/admin/events/[id]/gallery/GalleryEditor.tsx
// Client component for bulk selecting and toggling gallery-ready status on photos.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleGalleryReady } from "./actions";
import { toast } from "@/components/ui/Toaster";

type Photo = {
  id: string;
  thumbnailSrc: string;
  gallerySrc: string;
  label: string | null;
  cloudflareImageId: string;
  galleryReady: boolean;
};

interface GalleryEditorProps {
  eventId: string;
  photos: Photo[];
}

export function GalleryEditor({ eventId, photos }: GalleryEditorProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const router = useRouter();

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(photos.map((p) => p.id)));
  }

  function selectNone() {
    setSelected(new Set());
  }

  function handleBulkToggle(galleryReady: boolean) {
    if (selected.size === 0) return;
    startTransition(async () => {
      await toggleGalleryReady(eventId, Array.from(selected), galleryReady);
      toast(`${selected.size} photo${selected.size !== 1 ? "s" : ""} ${galleryReady ? "added to" : "removed from"} gallery`);
      setSelected(new Set());
      router.refresh();
    });
  }

  function handleSingleToggle(photoId: string, galleryReady: boolean) {
    startTransition(async () => {
      await toggleGalleryReady(eventId, [photoId], galleryReady);
      router.refresh();
    });
  }

  return (
    <div>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
          padding: "0.75rem 1rem",
          border: "0.5px solid var(--border)",
          background: "var(--white)",
          marginBottom: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <button onClick={selectAll} style={toolBtn}>Select All</button>
        <button onClick={selectNone} style={toolBtn}>Select None</button>

        {selected.size > 0 && (
          <>
            <span style={{ fontSize: "0.72rem", color: "var(--charcoal-muted)" }}>
              {selected.size} selected
            </span>
            <button
              onClick={() => handleBulkToggle(true)}
              style={{ ...toolBtn, background: "var(--olive)", color: "var(--white)" }}
            >
              ✓ Gallery Ready
            </button>
            <button
              onClick={() => handleBulkToggle(false)}
              style={{ ...toolBtn, background: "#991B1B", color: "var(--white)" }}
            >
              ✕ Remove from Gallery
            </button>
          </>
        )}
      </div>

      {/* Photo grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "0.5rem",
        }}
      >
        {photos.map((photo) => {
          const isSelected = selected.has(photo.id);
          return (
            <div
              key={photo.id}
              onClick={() => toggleSelect(photo.id)}
              style={{
                position: "relative",
                cursor: "pointer",
                border: isSelected ? "2px solid var(--olive)" : "0.5px solid var(--border)",
                background: "var(--white)",
                transition: "border-color 0.15s",
                overflow: "hidden",
              }}
            >
              {/* Thumbnail */}
              <div style={{ aspectRatio: "1", overflow: "hidden" }}>
                <img
                  src={photo.thumbnailSrc}
                  alt={photo.label ?? ""}
                  loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </div>

              {/* Gallery-ready badge */}
              <div
                style={{
                  position: "absolute",
                  top: "0.4rem",
                  right: "0.4rem",
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  background: photo.galleryReady ? "var(--olive)" : "rgba(42,42,40,0.5)",
                  color: "var(--white)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.7rem",
                  cursor: "pointer",
                }}
                title={photo.galleryReady ? "Gallery ready — click to remove" : "Not in gallery — click to add"}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSingleToggle(photo.id, !photo.galleryReady);
                }}
              >
                {photo.galleryReady ? "✓" : "·"}
              </div>

              {/* Selection checkbox */}
              <div
                style={{
                  position: "absolute",
                  top: "0.4rem",
                  left: "0.4rem",
                  width: "22px",
                  height: "22px",
                  border: isSelected ? "2px solid var(--olive)" : "1.5px solid rgba(255,255,255,0.8)",
                  background: isSelected ? "var(--olive)" : "rgba(42,42,40,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.6rem",
                  color: "var(--white)",
                }}
              >
                {isSelected ? "✓" : ""}
              </div>

              {/* Label */}
              {photo.label && (
                <div style={{ padding: "0.35rem 0.5rem", fontSize: "0.65rem", color: "var(--charcoal-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {photo.label}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const toolBtn: React.CSSProperties = {
  padding: "0.4rem 0.8rem",
  fontSize: "0.62rem",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  background: "transparent",
  color: "var(--charcoal)",
  border: "0.5px solid var(--border-strong)",
  cursor: "pointer",
  fontFamily: "'Jost', sans-serif",
};
