"use client";

// app/admin/events/[id]/PhotoGrid.tsx
// Admin photo grid — 4-column square thumbnails with delete button on hover.
// Calls the deletePhoto server action which removes from Firestore, R2, and Cloudflare Images.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toaster";
import { deletePhoto } from "./actions";

interface Photo {
  id: string;
  thumbnailSrc: string;
  label: string | null;
  cloudflareImageId: string;
  r2Key: string | null;
}

interface PhotoGridProps {
  eventId: string;
  photos: Photo[];
}

export function PhotoGrid({ eventId, photos }: PhotoGridProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete(photo: Photo) {
    if (!confirm(`Delete this photo? This cannot be undone.`)) return;

    startTransition(async () => {
      await deletePhoto({
        photoId: photo.id,
        eventId,
        cloudflareImageId: photo.cloudflareImageId,
        r2Key: photo.r2Key,
      });
      toast("Photo deleted");
      router.refresh();
    });
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "0.75rem",
      }}
    >
      {photos.map((photo) => (
        <div
          key={photo.id}
          style={{
            position: "relative",
            aspectRatio: "1",
            overflow: "hidden",
            cursor: "pointer",
          }}
          className="photo-thumb-wrap"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.thumbnailSrc}
            alt={photo.label ?? ""}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              transition: "transform 0.4s",
              pointerEvents: "none",
              userSelect: "none",
            }}
            onContextMenu={(e) => e.preventDefault()}
            draggable={false}
          />

          {/* Hover overlay with delete */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(20,20,18,0)",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "flex-end",
              padding: "0.4rem",
              transition: "background 0.2s",
            }}
            className="photo-thumb-overlay"
          >
            <button
              onClick={() => handleDelete(photo)}
              disabled={isPending}
              title="Delete photo"
              style={{
                width: "26px",
                height: "26px",
                background: "rgba(20,20,18,0.75)",
                color: "#FAF9F6",
                border: "none",
                fontSize: "0.75rem",
                cursor: isPending ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: 0,
                transition: "opacity 0.2s",
                fontFamily: "'Jost', sans-serif",
              }}
              className="photo-delete-btn"
            >
              ✕
            </button>
          </div>

          {photo.label && (
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                background: "linear-gradient(transparent, rgba(20,20,18,0.6))",
                padding: "1.2rem 0.5rem 0.4rem",
                fontSize: "0.62rem",
                color: "rgba(250,249,246,0.8)",
                letterSpacing: "0.06em",
                opacity: 0,
                transition: "opacity 0.2s",
                pointerEvents: "none",
              }}
              className="photo-label-overlay"
            >
              {photo.label}
            </div>
          )}
        </div>
      ))}

      {/* Hover styles via a style tag to keep the component clean */}
      <style>{`
        .photo-thumb-wrap:hover .photo-delete-btn { opacity: 1; }
        .photo-thumb-wrap:hover .photo-label-overlay { opacity: 1; }
        .photo-thumb-wrap:hover .photo-thumb-overlay { background: rgba(20,20,18,0.15); }
        .photo-thumb-wrap:hover img { transform: scale(1.04); }
      `}</style>
    </div>
  );
}