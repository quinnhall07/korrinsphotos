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

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MasonryGrid, type MasonryPhoto } from "@/components/MasonryGrid";
import { toast } from "@/components/ui/Toaster";
import { submitClientNps } from "./actions";

interface GalleryViewerProps {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  photos: MasonryPhoto[];
  eventStatus: string | null;
  existingNps: 1 | 2 | 3 | 4 | 5 | null;
  canSubmitNps: boolean;
}

export function GalleryViewer({
  eventId,
  eventTitle,
  eventDate,
  photos,
  eventStatus,
  existingNps,
  canSubmitNps,
}: GalleryViewerProps) {
  const router = useRouter();
  const [downloading, setDownloading] = useState(false);
  const [hoverStar, setHoverStar] = useState<number | null>(null);
  const [localNps, setLocalNps] = useState<1 | 2 | 3 | 4 | 5 | null>(existingNps);
  const [submitting, startSubmit] = useTransition();
  const showNpsWidget = eventStatus === "DELIVERED" && canSubmitNps;

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
        {photos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "6rem 2rem" }}>
            <p style={{ color: "var(--charcoal-muted)", fontSize: "0.88rem" }}>
              Photos are being processed and will appear here shortly.
            </p>
          </div>
        ) : (
          <MasonryGrid photos={photos} columns={4} eventName={eventTitle} />
        )}
      </div>
    </div>
  );
}