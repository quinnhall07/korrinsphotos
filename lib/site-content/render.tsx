// lib/site-content/render.tsx
// Block dispatcher: turns Section[] into JSX. Used by both production pages
// and the admin preview route — preview and prod render through the same code path.
//
// Pure presentation — no data fetching. Server-component-safe.

import Link from "next/link";
import type { Section, PhotoRef } from "./types";
import { buildCdnUrl } from "@/lib/cloudflare";
import { renderConstrainedMarkdown } from "./markdown";

function photoSrc(ref: PhotoRef, variant: "thumbnail" | "gallery" = "gallery"): string {
  return buildCdnUrl(ref.cloudflareImageId, variant);
}

function HeroBlock({ section }: { section: Extract<Section, { type: "HERO" }> }) {
  const { slides, eyebrow, headline, sub, primaryCtaLabel, primaryCtaHref, secondaryCtaLabel, secondaryCtaHref } = section;
  const firstSlide = slides[0];
  return (
    <section
      style={{
        position: "relative",
        minHeight: "85vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        background: "var(--charcoal)",
      }}
    >
      {firstSlide && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoSrc(firstSlide.photoRef, "gallery")}
          alt={firstSlide.photoRef.altText ?? ""}
          onContextMenu={(e) => e.preventDefault()}
          draggable={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.55,
          }}
        />
      )}
      <div style={{ position: "relative", textAlign: "center", padding: "0 2rem", color: "var(--white)", maxWidth: "60rem" }}>
        {eyebrow && (
          <p style={{ fontSize: "0.7rem", letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--olive-light)", marginBottom: "1.25rem" }}>
            {eyebrow}
          </p>
        )}
        {headline && (
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "clamp(2.6rem, 6vw, 5rem)",
              fontWeight: 300,
              lineHeight: 1.05,
              letterSpacing: "-0.01em",
            }}
            dangerouslySetInnerHTML={{ __html: renderConstrainedMarkdown(headline).replace(/<p[^>]*>|<\/p>/g, "") }}
          />
        )}
        {sub && (
          <p style={{ marginTop: "1.5rem", fontSize: "1.05rem", lineHeight: 1.7, fontWeight: 300, opacity: 0.85 }}>
            {sub}
          </p>
        )}
        {(primaryCtaLabel || secondaryCtaLabel) && (
          <div style={{ marginTop: "2.5rem", display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            {primaryCtaLabel && primaryCtaHref && (
              <Link
                href={primaryCtaHref}
                style={{ display: "inline-block", padding: "0.9rem 2.4rem", fontSize: "0.72rem", letterSpacing: "0.14em", textTransform: "uppercase", background: "var(--olive)", color: "var(--white)", textDecoration: "none" }}
              >
                {primaryCtaLabel}
              </Link>
            )}
            {secondaryCtaLabel && secondaryCtaHref && (
              <Link
                href={secondaryCtaHref}
                style={{ display: "inline-block", padding: "0.9rem 2.4rem", fontSize: "0.72rem", letterSpacing: "0.14em", textTransform: "uppercase", background: "transparent", color: "var(--white)", border: "0.5px solid rgba(250,249,246,0.5)", textDecoration: "none" }}
              >
                {secondaryCtaLabel}
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function PhotoGridBlock({ section }: { section: Extract<Section, { type: "PHOTO_GRID" }> }) {
  const { eyebrow, heading, body, columns, photos } = section;
  return (
    <section style={{ padding: "6rem 4rem" }}>
      {(eyebrow || heading || body) && (
        <div style={{ marginBottom: "3rem", maxWidth: "44rem" }}>
          {eyebrow && (
            <div style={{ display: "flex", alignItems: "baseline", gap: "1.5rem", marginBottom: "2rem" }}>
              <span style={{ fontSize: "0.65rem", letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--olive)", fontWeight: 400, whiteSpace: "nowrap" }}>
                {eyebrow}
              </span>
              <div style={{ flex: 1, height: "0.5px", background: "var(--border)" }} />
            </div>
          )}
          {heading && (
            <h2
              style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(2.2rem, 4vw, 3.2rem)", fontWeight: 300, lineHeight: 1.2, letterSpacing: "-0.01em" }}
              dangerouslySetInnerHTML={{ __html: renderConstrainedMarkdown(heading).replace(/<p[^>]*>|<\/p>/g, "") }}
            />
          )}
          {body && (
            <p style={{ marginTop: "1.5rem", fontSize: "1.05rem", fontWeight: 300, lineHeight: 1.85, color: "var(--charcoal-light)" }}>
              {body}
            </p>
          )}
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: "1rem",
        }}
      >
        {photos.map((p, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${p.id}-${i}`}
            src={photoSrc(p, "gallery")}
            alt={p.altText ?? ""}
            onContextMenu={(e) => e.preventDefault()}
            draggable={false}
            style={{ width: "100%", height: "auto", display: "block" }}
          />
        ))}
      </div>
    </section>
  );
}

function RichTextBlock({ section }: { section: Extract<Section, { type: "RICH_TEXT" }> }) {
  const { eyebrow, heading, body } = section;
  return (
    <section style={{ padding: "5rem 4rem", maxWidth: "48rem", margin: "0 auto" }}>
      {eyebrow && (
        <p style={{ fontSize: "0.65rem", letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--olive)", marginBottom: "1rem" }}>
          {eyebrow}
        </p>
      )}
      {heading && (
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(1.8rem, 3vw, 2.4rem)", fontWeight: 300, lineHeight: 1.25, marginBottom: "1.5rem" }}>
          {heading}
        </h2>
      )}
      <div dangerouslySetInnerHTML={{ __html: renderConstrainedMarkdown(body) }} />
    </section>
  );
}

function CtaBannerBlock({ section }: { section: Extract<Section, { type: "CTA_BANNER" }> }) {
  const isDark = (section.variant ?? "DARK") === "DARK";
  const bg = isDark ? "var(--charcoal)" : "var(--olive-dim)";
  const fg = isDark ? "var(--white)" : "var(--charcoal)";
  const eyebrowColor = isDark ? "var(--olive-light)" : "var(--olive)";
  return (
    <section
      style={{
        background: bg,
        padding: "6rem 4rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "3rem",
        flexWrap: "wrap",
      }}
    >
      <div>
        {section.eyebrow && (
          <p style={{ fontSize: "0.65rem", letterSpacing: "0.2em", textTransform: "uppercase", color: eyebrowColor, marginBottom: "1rem" }}>
            {section.eyebrow}
          </p>
        )}
        <h2
          style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 300, color: fg, lineHeight: 1.2 }}
          dangerouslySetInnerHTML={{ __html: renderConstrainedMarkdown(section.headline).replace(/<p[^>]*>|<\/p>/g, "") }}
        />
      </div>
      <div style={{ display: "flex", gap: "1rem", flexShrink: 0 }}>
        {section.primaryCtaLabel && section.primaryCtaHref && (
          <Link
            href={section.primaryCtaHref}
            style={{ display: "inline-block", padding: "0.85rem 2.2rem", fontSize: "0.72rem", letterSpacing: "0.14em", textTransform: "uppercase", background: "var(--olive)", color: "var(--white)", textDecoration: "none" }}
          >
            {section.primaryCtaLabel}
          </Link>
        )}
        {section.secondaryCtaLabel && section.secondaryCtaHref && (
          <Link
            href={section.secondaryCtaHref}
            style={{
              display: "inline-block",
              padding: "0.85rem 2.2rem",
              fontSize: "0.72rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              background: "transparent",
              color: fg,
              border: `0.5px solid ${isDark ? "rgba(250,249,246,0.4)" : "var(--border-strong)"}`,
              textDecoration: "none",
            }}
          >
            {section.secondaryCtaLabel}
          </Link>
        )}
      </div>
    </section>
  );
}

export function renderSections(sections: Section[]): React.ReactNode {
  return sections.map((s) => {
    switch (s.type) {
      case "HERO":
        return <HeroBlock key={s.id} section={s} />;
      case "PHOTO_GRID":
        return <PhotoGridBlock key={s.id} section={s} />;
      case "RICH_TEXT":
        return <RichTextBlock key={s.id} section={s} />;
      case "CTA_BANNER":
        return <CtaBannerBlock key={s.id} section={s} />;
      default: {
        const exhaustive: never = s;
        return exhaustive;
      }
    }
  });
}
