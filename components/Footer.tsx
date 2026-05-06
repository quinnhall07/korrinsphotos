// components/Footer.tsx
// Reusable footer. Used on public-facing pages.

import Link from "next/link";

export function Footer() {
  return (
    <footer
      style={{
        borderTop: "0.5px solid var(--border)",
        padding: "3rem 4rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "1.1rem",
          fontWeight: 500,
          color: "var(--charcoal)",
          letterSpacing: "0.03em",
        }}
      >
        Korrin&apos;s Photography<span style={{ color: "var(--olive)" }}>.</span>
      </div>

      <div
        style={{
          fontSize: "0.72rem",
          color: "var(--charcoal-muted)",
          letterSpacing: "0.06em",
        }}
      >
        © {new Date().getFullYear()} &nbsp;Korrin&apos;s Photography. All rights reserved.
      </div>

      <ul style={{ display: "flex", gap: "2rem", listStyle: "none" }}>
        {[
          { label: "Portfolio", href: "/portfolio" },
          { label: "Booking", href: "/booking" },
          { label: "Login", href: "/login" },
        ].map(({ label, href }) => (
          <li key={href}>
            <Link
              href={href}
              style={{
                fontSize: "0.7rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--charcoal-muted)",
                textDecoration: "none",
                transition: "color 0.2s",
              }}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </footer>
  );
}