"use client";

// app/gallery/[id]/GalleryViewer.tsx
// Interactive gallery client component. Receives photo data from the server
// and renders the masonry grid + lightbox + download bar.
//
// Phase 2.11 — Delivery + reaction capture: when the linked event is in
// DELIVERED status and the project has no `clientNps` yet, we render a
// 5-star widget at the top of the gallery. Submitting fires the
// `submitClientNps` Server Action which, on NPS >= 4, triggers the Phase
// 4.6 review-request rotation (see `lib/domain/reviews.ts`).
//
// Phase 2.5 — Gallery favorites + proofing: each tile renders a heart
// overlay. Tapping toggles the signed-in viewer's clientId on the photo's
// `favoritedBy` array via the `toggleFavorite` server action. The header
// surfaces filter pills:
//
//   - "All" — every gallery-ready photo (default).
//   - "My picks (N)" — narrows to photos `favoritedBy.includes(viewerClientId)`.
//   - "Korrin's picks (N)" — Phase 13.5. Narrows to photos tagged
//     `"korrinsPick"` by the admin gallery editor.
//
// TODO(multi-list): v1 only supports a single "My picks" list per client.
// Phase 2.5 plans for multiple named lists ("Mom's picks", "for the album",
// etc). When that lands, replace `favoritedBy: string[]` with a per-list
// shape and add list-management UI here.

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MasonryGrid, type MasonryPhoto } from "@/components/MasonryGrid";
import { toast } from "@/components/ui/Toaster";
import { submitClientNps, toggleFavorite } from "./actions";

export interface GalleryPhoto extends MasonryPhoto {
  favoritedBy: string[];
  tags: string[];
}

type FilterMode = "ALL" | "MY_PICKS" | "KORRIN_PICKS";

interface GalleryViewerProps {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  photos: GalleryPhoto[];
  eventStatus: string | null;
  existingNps: 1 | 2 | 3 | 4 | 5 | null;
  canSubmitNps: boolean;
  /** Phase 2.5 — clientId for the signed-in viewer (or null if unresolvable). */
  viewerClientId: string | null;
}

export function GalleryViewer({
  eventId,
  eventTitle,
  eventDate,
  photos: initialPhotos,
  eventStatus,
  existingNps,
  canSubmitNps,
  viewerClientId,
}: GalleryViewerProps) {
  const router = useRouter();
  const [downloading, setDownloading] = useState(false);
  const [hoverStar, setHoverStar] = useState<number | null>(null);
  const [localNps, setLocalNps] = useState<1 | 2 | 3 | 4 | 5 | null>(existingNps);
  const [submitting, startSubmit] = useTransition();

  // Optimistic favorite state so heart taps feel instant. We seed from the
  // server-rendered photo array; subsequent toggles update both `photos` and
  // (best-effort) the server. On error we revert.
  const [photos, setPhotos] = useState<GalleryPhoto[]>(initialPhotos);
  const [favoritePending, startFavoriteTransition] = useTransition();
  const [filter, setFilter] = useState<FilterMode>("ALL");

  const showNpsWidget = eventStatus === "DELIVERED" && canSubmitNps;

  const myPicksCount = useMemo(() => {
    if (!viewerClientId) return 0;
    return photos.reduce(
      (n, p) => (p.favoritedBy.includes(viewerClientId) ? n + 1 : n),
      0
    );
  }, [photos, viewerClientId]);

  const korrinPicksCount = useMemo(
    () => photos.reduce((n, p) => (p.tags.includes("korrinsPick") ? n + 1 : n), 0),
    [photos]
  );

  const filteredPhotos = useMemo(() => {
    if (filter === "MY_PICKS" && viewerClientId) {
      return photos.filter((p) => p.favoritedBy.includes(viewerClientId));
    }
    if (filter === "KORRIN_PICKS") {
      return photos.filter((p) => p.tags.includes("korrinsPick"));
    }
    return photos;
  }, [photos, filter, viewerClientId]);

  function handleRate(rating: 1 | 2 | 3 | 4 | 5) {
    if (submitting || localNps !== null) return;
    startSubmit(async () => {
      const result = await submitClientNps(eventId, rating);
      if (!result.success) {
        toast(result.error ?? "Could not save your rating.");
        return;
      }
      setLocalNps(rating);
      toast(
        rating >= 4
          ? "Thank you! You'll get a quick review prompt by email."
          : "Thank you for your feedback."
      );
      router.refresh();
    });
  }

  function handleToggleFavorite(photoId: string) {
    if (!viewerClientId) {
      toast("Sign in to save your picks.");
      return;
    }
    if (favoritePending) return;

    // Optimistic update — flip the favoritedBy membership locally first.
    const prevPhotos = photos;
    setPhotos((current) =>
      current.map((p) => {
        if (p.id !== photoId) return p;
        const has = p.favoritedBy.includes(viewerClientId);
        return {
          ...p,
          favoritedBy: has
            ? p.favoritedBy.filter((id) => id !== viewerClientId)
            : [...p.favoritedBy, viewerClientId],
        };
      })
    );

    startFavoriteTransition(async () => {
      const result = await toggleFavorite(eventId, photoId);
      if (!result.success) {
        setPhotos(prevPhotos);
        toast(result.error ?? "Failed to save your pick.");
      }
    });
  }

  async function requestDownload() {
    if (downloading) return;
    setDownloading(true);
    toast("Preparing your download…");

    try {
      const res = await fetch(`/api/download/${eventId}/zip`, {
        method: "POST",
      });

      if (!res.ok) {
        let message = "Download failed";
        try {
          const data = (await res.json()) as { error?: string };
          if (data.error) message = data.error;
        } catch {
          /* non-JSON body */
        }
        toast(message);
        return;
      }

      // Stream the response into a Blob, then trigger a browser save.
      // Going through a Blob URL gives us full control over the filename
      // and a cleaner UX than `window.location = url` (no full nav).
      const blob = await res.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `${eventTitle.replace(/[^a-z0-9-_]+/gi, "-")}.zip`;

      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(downloadUrl);

      toast("Download started");
    } catch (err) {
      console.error("[gallery] download failed:", err);
      toast("Download failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div style={{ paddingTop: "72px" }} className="page-fade-in">
      <div style={{ padding: "2rem 3rem 4rem" }}>
        {/* Back link */}
        <Link
          href="/gallery"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "0.72rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--charcoal-muted)",
            textDecoration: "none",
            marginBottom: "2.5rem",
            transition: "color 0.2s",
          }}
        >
          ← Back to galleries
        </Link>

        {/* Phase 2.11 — NPS / reaction capture. Shows once the linked event
            is DELIVERED. After the first submit, switches to a thank-you
            line with the locked-in rating. */}
        {showNpsWidget && (
          <div
            style={{
              padding: "1.4rem 1.5rem",
              border: "0.5px solid var(--border)",
              background: "rgba(107,120,69,0.04)",
              marginBottom: "2rem",
            }}
          >
            <p
              style={{
                fontSize: "0.65rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--olive)",
                marginBottom: "0.5rem",
              }}
            >
              How does this feel?
            </p>
            {localNps === null ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", gap: "0.25rem" }}>
                  {[1, 2, 3, 4, 5].map((n) => {
                    const active = (hoverStar ?? 0) >= n;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => handleRate(n as 1 | 2 | 3 | 4 | 5)}
                        onMouseEnter={() => setHoverStar(n)}
                        onMouseLeave={() => setHoverStar(null)}
                        disabled={submitting}
                        aria-label={`${n} star${n === 1 ? "" : "s"}`}
                        style={{
                          background: "transparent",
                          border: "none",
                          padding: "0.2rem 0.3rem",
                          fontSize: "1.6rem",
                          lineHeight: 1,
                          color: active ? "var(--olive)" : "var(--charcoal-muted)",
                          cursor: submitting ? "wait" : "pointer",
                          transition: "color 0.15s",
                          fontFamily: "'Jost', sans-serif",
                        }}
                      >
                        ★
                      </button>
                    );
                  })}
                </div>
                <span
                  style={{
                    fontSize: "0.78rem",
                    color: "var(--charcoal-muted)",
                    marginLeft: "0.5rem",
                  }}
                >
                  Tap a star to share your reaction.
                </span>
              </div>
            ) : (
              <p style={{ fontSize: "0.88rem", color: "var(--charcoal-light)", margin: 0 }}>
                Thanks — you rated this {localNps} / 5 ★.
              </p>
            )}
          </div>
        )}

        {/* Event header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: "2rem",
            gap: "2rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "clamp(2rem, 5vw, 3rem)",
                fontWeight: 300,
                marginBottom: "0.25rem",
              }}
            >
              {eventTitle}
            </h1>
            <p style={{ fontSize: "0.8rem", color: "var(--charcoal-muted)" }}>
              {photos.length} photo{photos.length !== 1 ? "s" : ""} · {eventDate}
            </p>
          </div>
          {photos.length > 0 && (
            <button
              onClick={requestDownload}
              disabled={downloading}
              style={{
                padding: "0.6rem 1.4rem",
                fontSize: "0.68rem",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                background: downloading ? "var(--charcoal-muted)" : "var(--olive)",
                color: "var(--white)",
                border: "none",
                cursor: downloading ? "wait" : "pointer",
                fontFamily: "'Jost', sans-serif",
                flexShrink: 0,
                transition: "background 0.25s",
              }}
            >
              {downloading ? "Preparing…" : "Download all"}
            </button>
          )}
        </div>

        {/* Phase 2.5 / 13.5 — Filter pills. Always render the "All" pill; the
            "My picks" + "Korrin's picks" pills appear conditionally so the
            header stays quiet on empty galleries. */}
        {photos.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              flexWrap: "wrap",
              marginBottom: "2rem",
            }}
          >
            <FilterPill
              active={filter === "ALL"}
              onClick={() => setFilter("ALL")}
              label={`All (${photos.length})`}
            />
            <FilterPill
              active={filter === "MY_PICKS"}
              onClick={() => setFilter("MY_PICKS")}
              disabled={!viewerClientId}
              label={`My picks (${myPicksCount})`}
            />
            {korrinPicksCount > 0 && (
              <FilterPill
                active={filter === "KORRIN_PICKS"}
                onClick={() => setFilter("KORRIN_PICKS")}
                label={`Just show me Korrin's favorites (${korrinPicksCount})`}
              />
            )}
          </div>
        )}

        {/* Download bar */}
        {photos.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "1rem 1.2rem",
              border: "0.5px solid var(--border)",
              background: "rgba(107,120,69,0.04)",
              marginBottom: "2.5rem",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <p
              style={{ fontSize: "0.82rem", color: "var(--charcoal-light)", lineHeight: 1.6 }}
            >
              All images delivered at optimized resolution via Cloudflare CDN.
              Right-click is disabled to protect your photos.
            </p>
            <button
              onClick={requestDownload}
              disabled={downloading}
              style={{
                padding: "0.6rem 1.4rem",
                fontSize: "0.68rem",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                background: downloading ? "var(--charcoal-muted)" : "var(--olive)",
                color: "var(--white)",
                border: "none",
                cursor: downloading ? "wait" : "pointer",
                fontFamily: "'Jost', sans-serif",
                flexShrink: 0,
                transition: "background 0.25s",
              }}
            >
              {downloading ? "Preparing…" : "Download all (.zip)"}
            </button>
          </div>
        )}

        {/* Gallery grid */}
        {filteredPhotos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "6rem 2rem" }}>
            <p style={{ color: "var(--charcoal-muted)", fontSize: "0.88rem" }}>
              {photos.length === 0
                ? "Photos are being processed and will appear here shortly."
                : filter === "MY_PICKS"
                  ? "No picks yet — tap a heart to start saving your favorites."
                  : "No photos match this filter."}
            </p>
          </div>
        ) : (
          <MasonryGrid
            photos={filteredPhotos}
            columns={4}
            eventName={eventTitle}
            renderOverlay={(photo) => (
              <HeartButton
                active={
                  viewerClientId
                    ? (photo as GalleryPhoto).favoritedBy?.includes(viewerClientId) ?? false
                    : false
                }
                disabled={favoritePending}
                onClick={() => handleToggleFavorite(photo.id)}
              />
            )}
          />
        )}
      </div>
    </div>
  );
}

function FilterPill({
  active,
  disabled,
  label,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "0.45rem 1rem",
        fontSize: "0.66rem",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        background: active ? "var(--olive)" : "transparent",
        color: active ? "var(--white)" : disabled ? "var(--charcoal-muted)" : "var(--charcoal)",
        border: active ? "0.5px solid var(--olive)" : "0.5px solid var(--border-strong)",
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "'Jost', sans-serif",
        transition: "background 0.2s, color 0.2s",
      }}
    >
      {label}
    </button>
  );
}

function HeartButton({
  active,
  disabled,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      aria-label={active ? "Remove from My picks" : "Add to My picks"}
      title={active ? "Remove from My picks" : "Add to My picks"}
      style={{
        position: "absolute",
        top: "0.5rem",
        right: "0.5rem",
        width: "32px",
        height: "32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(20,20,18,0.55)",
        border: "0.5px solid rgba(250,249,246,0.35)",
        color: active ? "var(--olive-light)" : "var(--white)",
        fontSize: "1.05rem",
        lineHeight: 1,
        cursor: disabled ? "wait" : "pointer",
        fontFamily: "'Jost', sans-serif",
        transition: "color 0.15s, background 0.15s",
        zIndex: 2,
      }}
    >
      {active ? "♥" : "♡"}
    </button>
  );
}
