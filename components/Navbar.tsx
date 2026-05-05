"use client";

// components/Navbar.tsx
// Consistent navigation across all pages.
// - Portfolio + Booking always visible
// - My Galleries in the top nav for all logged-in users
// - Admin link in the top nav ONLY for admin users (in addition to My Galleries)
// - Profile avatar dropdown: Settings + Sign Out

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useState, useEffect, useRef } from "react";

export function Navbar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [role, setRole] = useState<"ADMIN" | "CLIENT" | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!user) { setRole(null); return; }
    user.getIdTokenResult().then((result) => {
      setRole((result.claims.role as "ADMIN" | "CLIENT") ?? "CLIENT");
    });
  }, [user]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(path + "/");

  const isAdminRoute = pathname.startsWith("/admin");

  const initials = user?.displayName
    ? user.displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <nav
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0,
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
      <Link href="/" style={logoStyle}>
        Korrin&apos;s<span style={{ color: "var(--olive)" }}>.</span>
      </Link>

      {/* Nav links */}
      <ul style={{ display: "flex", alignItems: "center", gap: "2.5rem", listStyle: "none" }}>
        {isAdminRoute ? (
          // Inside admin — minimal nav
          <>
            <li>
              <Link href="/gallery" style={navLinkStyle}>
                My Galleries
              </Link>
            </li>
            <li>
              <Link href="/" style={navLinkStyle}>← Public Site</Link>
            </li>
          </>
        ) : (
          <>
            {/* Always-visible public links */}
            <li>
              <Link
                href="/portfolio"
                style={{
                  ...navLinkStyle,
                  color: isActive("/portfolio") ? "var(--charcoal)" : "var(--charcoal-light)",
                  borderBottom: isActive("/portfolio") ? "0.5px solid var(--olive)" : "none",
                  paddingBottom: "2px",
                }}
              >
                Portfolio
              </Link>
            </li>
            <li>
              <Link
                href="/booking"
                style={{
                  ...navLinkStyle,
                  color: isActive("/booking") ? "var(--charcoal)" : "var(--charcoal-light)",
                  borderBottom: isActive("/booking") ? "0.5px solid var(--olive)" : "none",
                  paddingBottom: "2px",
                }}
              >
                Booking
              </Link>
            </li>

            {user ? (
              <>
                {/* My Galleries — visible to ALL logged-in users */}
                <li>
                  <Link
                    href="/gallery"
                    style={{
                      ...navLinkStyle,
                      color: isActive("/gallery") ? "var(--charcoal)" : "var(--charcoal-light)",
                      borderBottom: isActive("/gallery") ? "0.5px solid var(--olive)" : "none",
                      paddingBottom: "2px",
                    }}
                  >
                    My Galleries
                  </Link>
                </li>

                {/* Admin Dashboard — visible ONLY to admins */}
                {role === "ADMIN" && (
                  <li>
                    <Link
                      href="/admin"
                      style={{
                        ...navLinkStyle,
                        fontSize: "0.68rem",
                        letterSpacing: "0.12em",
                        color: "var(--olive)",
                        border: "0.5px solid var(--olive)",
                        padding: "0.4rem 1rem",
                        transition: "background 0.2s, color 0.2s",
                      }}
                    >
                      Admin
                    </Link>
                  </li>
                )}

                {/* Profile avatar + dropdown */}
                <li style={{ position: "relative" }} ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen((o) => !o)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                    }}
                    aria-label="Account menu"
                  >
                    <div
                      style={{
                        width: "34px",
                        height: "34px",
                        borderRadius: "50%",
                        background: "var(--olive)",
                        color: "var(--white)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.72rem",
                        fontWeight: 500,
                        letterSpacing: "0.04em",
                        fontFamily: "'Jost', sans-serif",
                        flexShrink: 0,
                      }}
                    >
                      {initials}
                    </div>
                    <svg
                      width="10"
                      height="6"
                      viewBox="0 0 10 6"
                      fill="none"
                      style={{
                        transition: "transform 0.2s",
                        transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                        color: "var(--charcoal-muted)",
                      }}
                    >
                      <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {/* Dropdown panel */}
                  {dropdownOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 12px)",
                        right: 0,
                        width: "220px",
                        background: "rgba(250,249,246,0.98)",
                        backdropFilter: "blur(12px)",
                        border: "0.5px solid var(--border-strong)",
                        boxShadow: "0 8px 32px rgba(42,42,40,0.12)",
                        zIndex: 200,
                        overflow: "hidden",
                      }}
                    >
                      {/* User info header */}
                      <div style={{ padding: "1rem 1.2rem", borderBottom: "0.5px solid var(--border)" }}>
                        {user.displayName && (
                          <p style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--charcoal)", marginBottom: "0.2rem" }}>
                            {user.displayName}
                          </p>
                        )}
                        <p style={{ fontSize: "0.75rem", color: "var(--charcoal-muted)", letterSpacing: "0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {user.email}
                        </p>
                        {role === "ADMIN" && (
                          <span style={{ display: "inline-block", marginTop: "0.4rem", padding: "0.15rem 0.55rem", fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", background: "#D1FAE5", color: "#065F46" }}>
                            Admin
                          </span>
                        )}
                      </div>

                      {/* Menu items */}
                      <div style={{ padding: "0.4rem 0" }}>
                        {role === "ADMIN" && (
                          <Link
                            href="/admin"
                            onClick={() => setDropdownOpen(false)}
                            style={dropdownItemStyle}
                          >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
                              <rect x="1" y="1" width="6" height="6" rx="1"/>
                              <rect x="9" y="1" width="6" height="6" rx="1"/>
                              <rect x="1" y="9" width="6" height="6" rx="1"/>
                              <rect x="9" y="9" width="6" height="6" rx="1"/>
                            </svg>
                            Admin Dashboard
                          </Link>
                        )}

                        <Link
                          href="/gallery"
                          onClick={() => setDropdownOpen(false)}
                          style={dropdownItemStyle}
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
                            <rect x="1" y="1" width="12" height="10" rx="1"/>
                            <path d="M1 8l3-3 3 3 2-2 4 4"/>
                          </svg>
                          My Galleries
                        </Link>

                        <Link
                          href="/settings"
                          onClick={() => setDropdownOpen(false)}
                          style={dropdownItemStyle}
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
                            <circle cx="7" cy="7" r="2.5" />
                            <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.6 2.6l1.1 1.1M10.3 10.3l1.1 1.1M2.6 11.4l1.1-1.1M10.3 3.7l1.1-1.1" />
                          </svg>
                          Settings
                        </Link>

                        <div style={{ height: "0.5px", background: "var(--border)", margin: "0.4rem 0" }} />

                        <button
                          onClick={() => { setDropdownOpen(false); signOut(); }}
                          style={{ ...dropdownItemStyle, background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left" }}
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
                            <path d="M5 2H2a1 1 0 00-1 1v8a1 1 0 001 1h3M9 10l3-3-3-3M12 7H5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              </>
            ) : (
              <li>
                <Link href="/login" style={ctaStyle}>Login</Link>
              </li>
            )}
          </>
        )}
      </ul>
    </nav>
  );
}

const logoStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: "1.35rem",
  fontWeight: 500,
  letterSpacing: "0.04em",
  color: "var(--charcoal)",
  textDecoration: "none",
};

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

const dropdownItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.6rem",
  padding: "0.65rem 1.2rem",
  fontSize: "0.78rem",
  letterSpacing: "0.04em",
  color: "var(--charcoal-light)",
  textDecoration: "none",
  transition: "background 0.15s, color 0.15s",
  fontFamily: "'Jost', sans-serif",
};