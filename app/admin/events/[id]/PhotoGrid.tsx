"use client";

// app/admin/events/[id]/PhotoGrid.tsx
// Admin photo grid — 4-column square thumbnails with delete button on hover.
// Calls the deletePhoto server action which removes from Firestore, R2, and
// Cloudflare Images.
//
// Phase 2.5 additions:
//   - Each tile shows a small olive favorites badge ("♥ N") when one or more
//     clients have favorited it. Clicking the badge opens a modal that lists
//     the client display names (resolved on the server in `page.tsx`).
//   - A "Show only favorited" toggle filters the grid to photos with at least
//     one entry in `favoritedBy`.
//   - "Export client picks" POSTs to `/api/download/[eventId]/favorites/zip`
//     and downloads the resulting archive. Mirrors the public `/zip` flow.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toaster";
import { deletePhoto } from "./actions";

interface Photo {
  id: string;
  thumbnailSrc: string;
  label: string | null;
  cloudflareImageId: string;
  r2Key: string | null;
  favoritedBy: string[];
  tags: string[];
}

interface PhotoGridProps {
  eventId: string;
  photos: Photo[];
  /** clientId → display label (resolved server-side from the clients collection). */
  clientLabels: Record<string, string>;
}

export function PhotoGrid({ eventId, photos, clientLabels }: PhotoGridProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [modalPhoto, setModalPhoto] = useState<Photo | null>(null);
  const [exporting, setExporting] = useState(false);

  const totalFavorited = useMemo(
    () => photos.reduce((n, p) => (p.favoritedBy.length > 0 ? n + 1 : n), 0),
    [photos]
  );

  const visiblePhotos = useMemo(
    () => (favoritesOnly ? photos.filter((p) => p.favoritedBy.length > 0) : photos),
    [photos, favoritesOnly]
  );

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

  async function handleExport() {
    if (exporting) return;
    if (totalFavorited === 0) {
      toast("No client picks yet.");
      return;
    }
    setExporting(true);
    toast("Preparing client picks…");

    try {
      const res = await fetch(`/api/download/${eventId}/favorites`, {
        method: "POST",
      });

      if (!res.ok) {
        let message = "Export failed";
        try {
          const data = (await res.json()) as { error?: string };
          if (data.error) message = data.error;
        } catch {
          /* non-JSON */
        }
        toast(message);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `client-picks.zip`;

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast("Export started");
    } catch (err) {
      console.error("[admin/photos] export failed:", err);
      toast("Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      {/* Toolbar — favorites filter + export */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          flexWrap: "wrap",
          padding: "0.4rem 0 1rem",
        }}
      >
        <span
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--charcoal-muted)",
          }}
        >
          {totalFavorited} of {photos.length} favorited by clients
        </span>
        <button
          type="button"
          onClick={() => setFavoritesOnly((v) => !v)}
          style={{
            padding: "0.4rem 0.9rem",
            fontSize: "0.62rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            background: favoritesOnly ? "var(--olive)" : "transparent",
            color: favoritesOnly ? "var(--white)" : "var(--charcoal)",
            border: "0.5px solid var(--border-strong)",
            cursor: "pointer",
            fontFamily: "'Jost', sans-serif",
          }}
        >
          {favoritesOnly ? "Show all" : "Show only favorited"}
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || totalFavorited === 0}
          style={{
            padding: "0.4rem 0.9rem",
            fontSize: "0.62rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            background:
              exporting || totalFavorited === 0 ? "var(--charcoal-muted)" : "var(--olive)",
            color: "var(--white)",
            border: "none",
            cursor:
              exporting || totalFavorited === 0 ? "not-allowed" : "pointer",
            fontFamily: "'Jost', sans-serif",
          }}
        >
          {exporting ? "Preparing…" : "Export client picks"}
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "0.75rem",
        }}
      >
        {visiblePhotos.map((photo) => {
          const favCount = photo.favoritedBy.length;
          return (
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

              {/* Phase 2.5 — favorites badge (always visible if count > 0). */}
              {favCount > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setModalPhoto(photo);
                  }}
                  title={`${favCount} client${favCount === 1 ? "" : "s"} favorited this`}
                  style={{
                    position: "absolute",
                    bottom: "0.4rem",
                    left: "0.4rem",
                    padding: "0.2rem 0.5rem",
                    background: "var(--olive)",
                    color: "var(--white)",
                    border: "none",
                    fontSize: "0.62rem",
                    letterSpacing: "0.08em",
                    cursor: "pointer",
                    fontFamily: "'Jost', sans-serif",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    lineHeight: 1.2,
                  }}
                >
                  <span>♥</span>
                  <span>{favCount}</span>
                </button>
              )}

              {/* Korrin's pick indicator (read-only here — toggle lives in the gallery editor). */}
              {photo.tags.includes("korrinsPick") && (
                <span
                  title="Tagged as Korrin's pick"
                  style={{
                    position: "absolute",
                    top: "0.4rem",
                    left: "0.4rem",
                    padding: "0.15rem 0.45rem",
                    background: "rgba(20,20,18,0.7)",
                    color: "var(--olive-light)",
                    fontSize: "0.58rem",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    fontFamily: "'Jost', sans-serif",
                  }}
                >
                  ★ Pick
                </span>
              )}

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
          );
        })}

        {visiblePhotos.length === 0 && favoritesOnly && (
          <div
            style={{
              gridColumn: "1 / -1",
              padding: "2.5rem",
              textAlign: "center",
              color: "var(--charcoal-muted)",
              fontSize: "0.82rem",
            }}
          >
            No client favorites yet.
          </div>
        )}

        {/* Hover styles via a style tag to keep the component clean */}
        <style>{`
          .photo-thumb-wrap:hover .photo-delete-btn { opacity: 1; }
          .photo-thumb-wrap:hover .photo-label-overlay { opacity: 1; }
          .photo-thumb-wrap:hover .photo-thumb-overlay { background: rgba(20,20,18,0.15); }
          .photo-thumb-wrap:hover img { transform: scale(1.04); }
        `}</style>
      </div>

      {/* Favorites modal — lists which clients favorited this photo. */}
      {modalPhoto && (
        <FavoritesModal
          photo={modalPhoto}
          clientLabels={clientLabels}
          onClose={() => setModalPhoto(null)}
        />
      )}
    </div>
  );
}

function FavoritesModal({
  photo,
  clientLabels,
  onClose,
}: {
  photo: Photo;
  clientLabels: Record<string, string>;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(20,20,18,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--white)",
          padding: "2rem",
          maxWidth: "420px",
          width: "100%",
          border: "0.5px solid var(--border-strong)",
        }}
      >
        <h2
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "1.6rem",
            fontWeight: 300,
            marginBottom: "0.4rem",
          }}
        >
          Favorited by
        </h2>
        <p
          style={{
            fontSize: "0.72rem",
            color: "var(--charcoal-muted)",
            marginBottom: "1.5rem",
            letterSpacing: "0.06em",
          }}
        >
          {photo.favoritedBy.length} client
          {photo.favoritedBy.length === 1 ? "" : "s"}
        </p>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            maxHeight: "320px",
            overflowY: "auto",
          }}
        >
          {photo.favoritedBy.map((cid) => (
            <li
              key={cid}
              style={{
                fontSize: "0.85rem",
                color: "var(--charcoal)",
                padding: "0.55rem 0.75rem",
                borderBottom: "0.5px solid var(--border)",
              }}
            >
              {clientLabels[cid] ?? cid}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: "1.5rem",
            padding: "0.5rem 1.2rem",
            fontSize: "0.65rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            background: "var(--charcoal)",
            color: "var(--white)",
            border: "none",
            cursor: "pointer",
            fontFamily: "'Jost', sans-serif",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
