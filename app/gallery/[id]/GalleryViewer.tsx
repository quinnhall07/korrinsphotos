"use client";

// app/gallery/[id]/GalleryViewer.tsx
// Interactive gallery client component. Receives photo data from the server
// and renders the masonry grid + lightbox + download bar.

import Link from "next/link";
import { MasonryGrid, type MasonryPhoto } from "@/components/MasonryGrid";
import { toast } from "@/components/ui/Toaster";

interface GalleryViewerProps {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  photos: MasonryPhoto[];
}

export function GalleryViewer({
  eventTitle,
  eventDate,
  photos,
}: GalleryViewerProps) {
  async function requestDownload() {
    toast("Download request sent — you will receive a link by email shortly.");
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
              style={{
                padding: "0.6rem 1.4rem",
                fontSize: "0.68rem",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                background: "var(--olive)",
                color: "var(--white)",
                border: "none",
                cursor: "pointer",
                fontFamily: "'Jost', sans-serif",
                flexShrink: 0,
                transition: "background 0.25s",
              }}
            >
              Request Full Download
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
          <div style={{ columns: 4, columnGap: "0.75rem" }}>
            <MasonryGrid photos={photos} columns={4} eventName={eventTitle} />
          </div>
        )}
      </div>
    </div>
  );
}