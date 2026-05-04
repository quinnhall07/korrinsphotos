// app/not-found.tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        paddingTop: "72px",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "4rem 2rem",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: "36rem" }}>
        <p
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--olive)",
            marginBottom: "1rem",
          }}
        >
          404
        </p>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "clamp(2.5rem, 6vw, 4rem)",
            fontWeight: 300,
            lineHeight: 1.15,
            marginBottom: "1.5rem",
          }}
        >
          Page <em>not found</em>
        </h1>
        <p
          style={{
            fontSize: "0.92rem",
            color: "var(--charcoal-muted)",
            lineHeight: 1.8,
            marginBottom: "2.5rem",
          }}
        >
          The page you&apos;re looking for doesn&apos;t exist, or you may not
          have permission to view it.
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
          <Link
            href="/"
            style={{
              display: "inline-block",
              padding: "0.85rem 2.2rem",
              fontSize: "0.72rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              background: "var(--olive)",
              color: "var(--white)",
              textDecoration: "none",
              transition: "background 0.25s",
            }}
          >
            Go Home
          </Link>
          <Link
            href="/login"
            style={{
              display: "inline-block",
              padding: "0.85rem 2.2rem",
              fontSize: "0.72rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              background: "transparent",
              color: "var(--charcoal)",
              border: "0.5px solid var(--border-strong)",
              textDecoration: "none",
            }}
          >
            Client Login
          </Link>
        </div>
      </div>
    </div>
  );
}