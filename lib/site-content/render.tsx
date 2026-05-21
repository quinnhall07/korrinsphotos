// lib/site-content/render.tsx
// Block dispatcher: turns Section[] into JSX. Used by both production pages
// and the admin preview route — preview and prod render through the same code path.
//
// Pure presentation — no data fetching. Server-component-safe.

import Link from "next/link";
import type { Section, PhotoRef } from "./types";
import { buildCdnUrl } from "@/lib/cloudflare";
import { renderConstrainedMarkdown, renderInlineMarkdown } from "./markdown";

function photoSrc(ref: PhotoRef, variant: "thumbnail" | "gallery" = "gallery"): string {
  return buildCdnUrl(ref.cloudflareImageId, variant);
}

function HeroBlock({ section }: { section: Extract<Section, { type: "HERO" }> }) {
  const { slides, eyebrow, headline, sub, primaryCtaLabel, primaryCtaHref, secondaryCtaLabel, secondaryCtaHref } = section;
  const firstSlide = slides[0];
  return (
    <section
      data-section-id={section.id}
      data-section-type="HERO"
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
            dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(headline) }}
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
    <section
      data-section-id={section.id}
      data-section-type="PHOTO_GRID"
      style={{ padding: "6rem 4rem" }}
    >
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
              dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(heading) }}
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
    <section
      data-section-id={section.id}
      data-section-type="RICH_TEXT"
      style={{ padding: "5rem 4rem", maxWidth: "48rem", margin: "0 auto" }}
    >
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
      data-section-id={section.id}
      data-section-type="CTA_BANNER"
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
          dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(section.headline) }}
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

function ProcessStepsBlock({ section }: { section: Extract<Section, { type: "PROCESS_STEPS" }> }) {
  const { eyebrow, heading, intro, steps } = section;
  return (
    <section
      data-section-id={section.id}
      data-section-type="PROCESS_STEPS"
      style={{ padding: "6rem 4rem" }}
    >
      {eyebrow && (
        <div style={{ display: "flex", alignItems: "baseline", gap: "1.5rem", marginBottom: "3rem" }}>
          <span style={{ fontSize: "0.65rem", letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--olive)", fontWeight: 400, whiteSpace: "nowrap" }}>
            {eyebrow}
          </span>
          <div style={{ flex: 1, height: "0.5px", background: "var(--border)" }} />
        </div>
      )}
      {(heading || intro) && (
        <div style={{ maxWidth: "44rem", marginBottom: "4rem" }}>
          {heading && (
            <h2
              style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(2.2rem, 4vw, 3.2rem)", fontWeight: 300, lineHeight: 1.2, letterSpacing: "-0.01em" }}
              dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(heading) }}
            />
          )}
          {intro && (
            <p style={{ marginTop: "1.5rem", fontSize: "1.05rem", fontWeight: 300, lineHeight: 1.85, color: "var(--charcoal-light)" }}>
              {intro}
            </p>
          )}
        </div>
      )}
      <ol style={{ listStyle: "none", margin: 0, padding: 0, maxWidth: "52rem" }}>
        {steps.map((s, i) => (
          <li
            key={`${s.n}-${i}`}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(5rem, 7rem) 1fr",
              gap: "3rem",
              padding: "2.5rem 0",
              borderTop: "0.5px solid var(--olive)",
              borderBottom: i === steps.length - 1 ? "0.5px solid var(--olive)" : undefined,
            }}
          >
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "2.4rem", fontStyle: "italic", fontWeight: 300, lineHeight: 1, color: "var(--olive)", paddingTop: "0.2rem" }}>
              {s.n}
            </div>
            <div>
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(1.6rem, 2.6vw, 2.1rem)", fontWeight: 300, lineHeight: 1.2, marginBottom: "0.9rem", color: "var(--charcoal)" }}>
                {s.title}
              </h3>
              <p style={{ fontFamily: "'Jost', sans-serif", fontSize: "1rem", fontWeight: 300, lineHeight: 1.85, color: "var(--charcoal-light)", maxWidth: "36rem" }}>
                {s.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

function PackageCardsBlock({ section }: { section: Extract<Section, { type: "PACKAGE_CARDS" }> }) {
  const { eyebrow, heading, intro, packages } = section;
  return (
    <section
      data-section-id={section.id}
      data-section-type="PACKAGE_CARDS"
      style={{ padding: "6rem 4rem", background: "rgba(232,235,216,0.25)", borderTop: "0.5px solid var(--border)", borderBottom: "0.5px solid var(--border)" }}
    >
      {eyebrow && (
        <div style={{ display: "flex", alignItems: "baseline", gap: "1.5rem", marginBottom: "3rem" }}>
          <span style={{ fontSize: "0.65rem", letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--olive)", fontWeight: 400, whiteSpace: "nowrap" }}>
            {eyebrow}
          </span>
          <div style={{ flex: 1, height: "0.5px", background: "var(--border)" }} />
        </div>
      )}
      {(heading || intro) && (
        <div style={{ maxWidth: "44rem", marginBottom: "4rem" }}>
          {heading && (
            <h2
              style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(2.2rem, 4vw, 3.2rem)", fontWeight: 300, lineHeight: 1.2, letterSpacing: "-0.01em" }}
              dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(heading) }}
            />
          )}
          {intro && (
            <p style={{ marginTop: "1.5rem", fontSize: "1.05rem", fontWeight: 300, lineHeight: 1.85, color: "var(--charcoal-light)" }}>
              {intro}
            </p>
          )}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
        {packages.map((p) => (
          <article key={p.id} style={{ display: "flex", flexDirection: "column", padding: "2.75rem 2.25rem", border: "0.5px solid var(--border-strong)", background: "var(--white)" }}>
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "2rem", fontWeight: 300, lineHeight: 1.2, color: "var(--charcoal)", marginBottom: "0.6rem" }}>
              {p.name}
            </h3>
            <p style={{ fontFamily: "'Jost', sans-serif", fontSize: "0.88rem", fontWeight: 300, letterSpacing: "0.02em", color: "var(--charcoal-muted)", marginBottom: "2rem" }}>
              Starting at <span style={{ color: "var(--charcoal)", fontWeight: 400 }}>{formatUsd(p.startingPriceUsd)}</span>
            </p>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, marginBottom: "2rem", flex: 1 }}>
              {p.includes.map((line) => (
                <li key={line} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.85rem", alignItems: "baseline", padding: "0.55rem 0", fontFamily: "'Jost', sans-serif", fontSize: "0.92rem", fontWeight: 300, lineHeight: 1.6, color: "var(--charcoal-light)", borderBottom: "0.5px solid var(--border)" }}>
                  <span aria-hidden style={{ display: "inline-block", width: "4px", height: "4px", background: "var(--olive)", marginTop: "0.45rem" }} />
                  {line}
                </li>
              ))}
            </ul>
            {p.idealFor && (
              <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 300, fontSize: "1rem", lineHeight: 1.55, color: "var(--charcoal-light)", marginBottom: "2rem" }}>
                {p.idealFor}
              </p>
            )}
            <Link
              href={`/booking?package=${p.id}`}
              style={{ display: "inline-block", textAlign: "center", padding: "0.85rem 1.5rem", fontFamily: "'Jost', sans-serif", fontSize: "0.7rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--olive)", border: "0.5px solid var(--olive)", textDecoration: "none" }}
            >
              {p.ctaLabel ?? `Inquire about ${p.name}`}
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

function TestimonialBlock({ section }: { section: Extract<Section, { type: "TESTIMONIAL" }> }) {
  const isDark = (section.variant ?? "DARK") === "DARK";
  return (
    <section
      data-section-id={section.id}
      data-section-type="TESTIMONIAL"
      style={{ padding: "8rem 4rem", background: isDark ? "var(--charcoal)" : "var(--white)", color: isDark ? "var(--white)" : "var(--charcoal)", textAlign: "center" }}
    >
      {section.eyebrow && (
        <p style={{ fontFamily: "'Jost', sans-serif", fontSize: "0.65rem", letterSpacing: "0.22em", textTransform: "uppercase", color: isDark ? "var(--olive-light)" : "var(--olive)", marginBottom: "2rem" }}>
          {section.eyebrow}
        </p>
      )}
      <blockquote style={{ maxWidth: "56rem", margin: "0 auto", fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(1.8rem, 3.6vw, 2.8rem)", fontWeight: 300, fontStyle: "italic", lineHeight: 1.35, letterSpacing: "-0.005em" }}>
        &ldquo;{section.quote}&rdquo;
      </blockquote>
      {(section.author || section.authorRole) && (
        <p style={{ fontFamily: "'Jost', sans-serif", marginTop: "2.5rem", fontSize: "0.7rem", letterSpacing: "0.22em", textTransform: "uppercase", color: isDark ? "var(--olive-light)" : "var(--olive)", fontWeight: 400 }}>
          {section.author}{section.author && section.authorRole ? " — " : ""}{section.authorRole}
        </p>
      )}
    </section>
  );
}

function SlideshowBlock({ section }: { section: Extract<Section, { type: "SLIDESHOW" }> }) {
  // SSR-safe rendering: stack the slides absolutely; a small client-side
  // script (injected at render time) cycles them. The first slide is the
  // visible one on initial paint, so even without JS the page is legible.
  const { eyebrow, heading, slides, intervalMs } = section;
  const interval = Math.max(1500, Math.min(intervalMs ?? 5000, 30000));
  if (slides.length === 0) {
    return (
      <section data-section-id={section.id} data-section-type="SLIDESHOW" style={{ padding: "6rem 4rem", textAlign: "center", color: "var(--charcoal-muted)", fontStyle: "italic" }}>
        Slideshow has no photos yet.
      </section>
    );
  }
  return (
    <section
      data-section-id={section.id}
      data-section-type="SLIDESHOW"
      style={{ padding: "0", position: "relative", background: "var(--charcoal)" }}
    >
      {(eyebrow || heading) && (
        <div style={{ position: "absolute", top: "2rem", left: "2rem", zIndex: 2, color: "var(--white)" }}>
          {eyebrow && (
            <p style={{ fontSize: "0.65rem", letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--olive-light)", marginBottom: "0.5rem" }}>
              {eyebrow}
            </p>
          )}
          {heading && (
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(1.6rem, 3vw, 2.4rem)", fontWeight: 300 }}>
              {heading}
            </h2>
          )}
        </div>
      )}
      <div
        data-slideshow-frame
        data-interval-ms={interval}
        style={{ position: "relative", width: "100%", height: "70vh", overflow: "hidden" }}
      >
        {slides.map((p, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${p.id}-${i}`}
            src={photoSrc(p, "gallery")}
            alt={p.altText ?? ""}
            onContextMenu={(e) => e.preventDefault()}
            draggable={false}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: i === 0 ? 1 : 0,
              transition: "opacity 1.5s ease",
            }}
            data-slide-index={i}
          />
        ))}
      </div>
      {/* Cycle script — pure DOM, no React state. Runs once per mount. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){
            var frames = document.querySelectorAll('[data-slideshow-frame]');
            frames.forEach(function(frame){
              var slides = frame.querySelectorAll('[data-slide-index]');
              if (slides.length < 2) return;
              var interval = parseInt(frame.getAttribute('data-interval-ms') || '5000', 10);
              var i = 0;
              setInterval(function(){
                slides[i].style.opacity = '0';
                i = (i + 1) % slides.length;
                slides[i].style.opacity = '1';
              }, interval);
            });
          })();`,
        }}
      />
    </section>
  );
}

function StatsBlock({ section }: { section: Extract<Section, { type: "STATS" }> }) {
  const { items } = section;
  if (items.length === 0) return null;
  return (
    <section
      data-section-id={section.id}
      data-section-type="STATS"
      style={{ padding: "0 4rem" }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${items.length}, 1fr)`,
          borderTop: "0.5px solid var(--border)",
          borderBottom: "0.5px solid var(--border)",
          margin: "5rem 0",
        }}
      >
        {items.map((row, i) => (
          <div key={`${row.label}-${i}`} style={{ padding: "3rem 2rem", borderRight: i < items.length - 1 ? "0.5px solid var(--border)" : undefined }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "3.5rem", fontWeight: 300, lineHeight: 1, marginBottom: "0.5rem" }}>{row.number}</div>
            <div style={{ fontSize: "0.7rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--charcoal-muted)" }}>{row.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function renderSection(section: Section): React.ReactNode {
  switch (section.type) {
    case "HERO":
      return <HeroBlock key={section.id} section={section} />;
    case "PHOTO_GRID":
      return <PhotoGridBlock key={section.id} section={section} />;
    case "RICH_TEXT":
      return <RichTextBlock key={section.id} section={section} />;
    case "CTA_BANNER":
      return <CtaBannerBlock key={section.id} section={section} />;
    case "PROCESS_STEPS":
      return <ProcessStepsBlock key={section.id} section={section} />;
    case "PACKAGE_CARDS":
      return <PackageCardsBlock key={section.id} section={section} />;
    case "TESTIMONIAL":
      return <TestimonialBlock key={section.id} section={section} />;
    case "SLIDESHOW":
      return <SlideshowBlock key={section.id} section={section} />;
    case "STATS":
      return <StatsBlock key={section.id} section={section} />;
    default: {
      const exhaustive: never = section;
      return exhaustive;
    }
  }
}

export function renderSections(sections: Section[]): React.ReactNode {
  return sections.map((s) => renderSection(s));
}
