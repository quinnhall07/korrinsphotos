"use client";

// components/Navbar.tsx
// Role-aware navigation. Renders different links for public, client, and admin views.
// Active route highlighting uses usePathname() from next/navigation.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Session } from "next-auth";

interface NavbarProps {
  session: Session | null;
}

export function Navbar({ session }: NavbarProps) {
  const pathname = usePathname();
  const isAdmin = session?.user?.role === "ADMIN";
  const isAdminRoute = pathname.startsWith("/admin");
  const isClientRoute =
    pathname.startsWith("/gallery") || pathname === "/gallery";

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(path + "/");

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 3rem",
        height: "72px",
        background: "rgba(250,249,246,0.88)",
        backdropFilter: "blur(12px)",
        borderBottom: "0.5px solid var(--border)",
      }}
    >
      {/* Logo */}
      <Link
        href="/"
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "1.35rem",
          fontWeight: 500,
          letterSpacing: "0.04em",
          color: "var(--charcoal)",
          textDecoration: "none",
        }}
      >
        Korrin&apos;s<span style={{ color: "var(--olive)" }}>.</span>
      </Link>

      {/* Nav Links — context-aware */}
      <ul
        style={{
          display: "flex",
          alignItems: "center",
          gap: "2.5rem",
          listStyle: "none",
        }}
      >
        {isAdminRoute ? (
          // Admin nav
          <li>
            <Link href="/" style={navLinkStyle}>
              ← Public Site
            </Link>
          </li>
        ) : isClientRoute ? (
          // Client gallery nav
          <>
            <li>
              <Link
                href="/gallery"
                className="nav-link-underline"
                style={{
                  ...navLinkStyle,
                  color: isActive("/gallery")
                    ? "var(--charcoal)"
                    : "var(--charcoal-light)",
                }}
              >
                My Galleries
              </Link>
            </li>
            <li>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                style={{ ...navLinkStyle, background: "none", border: "none", cursor: "pointer" }}
              >
                Sign Out
              </button>
            </li>
          </>
        ) : (
          // Public nav
          <>
            <li>
              <Link
                href="/portfolio"
                className={`nav-link-underline${isActive("/portfolio") ? " active" : ""}`}
                style={{
                  ...navLinkStyle,
                  color: isActive("/portfolio")
                    ? "var(--charcoal)"
                    : "var(--charcoal-light)",
                }}
              >
                Portfolio
              </Link>
            </li>
            <li>
              <Link
                href="/booking"
                className={`nav-link-underline${isActive("/booking") ? " active" : ""}`}
                style={{
                  ...navLinkStyle,
                  color: isActive("/booking")
                    ? "var(--charcoal)"
                    : "var(--charcoal-light)",
                }}
              >
                Booking
              </Link>
            </li>
            {session ? (
              <li>
                <Link
                  href={isAdmin ? "/admin" : "/gallery"}
                  style={ctaStyle}
                >
                  {isAdmin ? "Admin" : "My Gallery"}
                </Link>
              </li>
            ) : (
              <li>
                <Link href="/login" style={ctaStyle}>
                  Client Login
                </Link>
              </li>
            )}
          </>
        )}
      </ul>
    </nav>
  );
}

const navLinkStyle: React.CSSProperties = {
  fontSize: "0.72rem",
  fontWeight: 400,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--charcoal-light)",
  textDecoration: "none",
  transition: "color 0.2s",
};

const ctaStyle: React.CSSProperties = {
  fontSize: "0.7rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--olive)",
  border: "0.5px solid var(--olive)",
  padding: "0.45rem 1.1rem",
  textDecoration: "none",
  transition: "background 0.2s, color 0.2s",
};