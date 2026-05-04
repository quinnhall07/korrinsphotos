"use client";

// components/Navbar.tsx
// Role-aware navigation with profile avatar dropdown for authenticated users.

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

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isAdminRoute  = pathname.startsWith("/admin");
  const isClientRoute = pathname.startsWith("/gallery");

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(path + "/");

  const initials = user?.displayName
    ? user.displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? "?";

  const AvatarButton = () => (
    <button
      onClick={() => setDropdownOpen((o) => !o)}
      style={{
        display:    "flex",
        alignItems: "center",
        gap:        "0.5rem",
        background: "none",
        border:     "none",
        cursor:     "pointer",
        padding:    "0.25rem",
      }}
      aria-label="Account menu"
    >
      {user?.photoURL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.photoURL}
          alt={user.displayName ?? "Profile"}
          referrerPolicy="no-referrer"
          style={{
            width:        "34px",
            height:       "34px",
            borderRadius: "50%",
            objectFit:    "cover",
            border:       "1.5px solid var(--border-strong)",
            display:      "block",
          }}
        />
      ) : (
        <div style={{
          width:          "34px",
          height:         "34px",
          borderRadius:   "50%",
          background:     "var(--olive-dim)",
          border:         "1.5px solid var(--border-strong)",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          fontSize:       "0.7rem",
          fontWeight:     500,
          color:          "var(--olive)",
          fontFamily:     "'Jost', sans-serif",
        }}>
          {initials}
        </div>
      )}
      <svg
        viewBox="0 0 10 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        style={{
          width:      "10px",
          height:     "10px",
          color:      "var(--charcoal-muted)",
          transition: "transform 0.2s",
          transform:  dropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
        }}
      >
        <path d="M1 1l4 4 4-4" />
      </svg>
    </button>
  );

  const DropdownPanel = () => (
    <div
      style={{
        position:       "absolute",
        top:            "calc(100% + 0.75rem)",
        right:          0,
        minWidth:       "220px",
        background:     "rgba(250,249,246,0.98)",
        border:         "0.5px solid var(--border-strong)",
        backdropFilter: "blur(12px)",
        boxShadow:      "0 8px 32px rgba(42,42,40,0.10)",
        zIndex:         200,
        animation:      "fadeIn 0.15s ease",
      }}
    >
      {/* User info header */}
      <div style={{ padding: "1rem 1.2rem 0.85rem", borderBottom: "0.5px solid var(--border)" }}>
        <p style={{
          fontSize:     "0.78rem",
          fontWeight:   500,
          color:        "var(--charcoal)",
          marginBottom: "0.15rem",
          whiteSpace:   "nowrap",
          overflow:     "hidden",
          textOverflow: "ellipsis",
        }}>
          {user?.displayName ?? "Client"}
        </p>
        <p style={{
          fontSize:     "0.7rem",
          color:        "var(--charcoal-muted)",
          whiteSpace:   "nowrap",
          overflow:     "hidden",
          textOverflow: "ellipsis",
        }}>
          {user?.email}
        </p>
      </div>

      {/* Links */}
      <div style={{ padding: "0.4rem 0" }}>
        <Link
          href={role === "ADMIN" ? "/admin" : "/gallery"}
          onClick={() => setDropdownOpen(false)}
          style={dropdownItemStyle}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="14" height="14">
            <rect x="1" y="1" width="6" height="6" rx="1" />
            <rect x="9" y="1" width="6" height="6" rx="1" />
            <rect x="1" y="9" width="6" height="6" rx="1" />
            <rect x="9" y="9" width="6" height="6" rx="1" />
          </svg>
          {role === "ADMIN" ? "Admin Dashboard" : "My Galleries"}
        </Link>

        {role === "ADMIN" && (
          <Link href="/gallery" onClick={() => setDropdownOpen(false)} style={dropdownItemStyle}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="14" height="14">
              <rect x="1" y="1" width="14" height="11" rx="1" />
              <path d="M1 9l4-4 3 3 3-4 4 5" />
            </svg>
            Client Gallery
          </Link>
        )}
      </div>

      {/* Sign out */}
      <div style={{ borderTop: "0.5px solid var(--border)", padding: "0.4rem 0" }}>
        <button
          onClick={() => { setDropdownOpen(false); signOut(); }}
          style={{
            ...dropdownItemStyle,
            width:      "100%",
            background: "none",
            border:     "none",
            textAlign:  "left",
            cursor:     "pointer",
            color:      "var(--charcoal-muted)",
          }}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="14" height="14">
            <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 11l3-3-3-3M13 8H6" />
          </svg>
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <nav
      style={{
        position:       "fixed",
        top: 0, left: 0, right: 0,
        zIndex:         100,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        padding:        "0 3rem",
        height:         "72px",
        background:     "rgba(250,249,246,0.88)",
        backdropFilter: "blur(12px)",
        borderBottom:   "0.5px solid var(--border)",
      }}
    >
      <Link href="/" style={logoStyle}>
        Korrin&apos;s<span style={{ color: "var(--olive)" }}>.</span>
      </Link>

      <ul style={{ display: "flex", alignItems: "center", gap: "2.5rem", listStyle: "none" }}>
        {isAdminRoute ? (
          <li><Link href="/" style={navLinkStyle}>← Public Site</Link></li>

        ) : isClientRoute ? (
          <>
            <li>
              <Link href="/gallery" style={{
                ...navLinkStyle,
                color: isActive("/gallery") ? "var(--charcoal)" : "var(--charcoal-light)",
              }}>
                My Galleries
              </Link>
            </li>
            {user && (
              <li style={{ position: "relative" }} ref={dropdownRef}>
                <AvatarButton />
                {dropdownOpen && <DropdownPanel />}
              </li>
            )}
          </>

        ) : (
          <>
            <li>
              <Link href="/portfolio" style={{
                ...navLinkStyle,
                color: isActive("/portfolio") ? "var(--charcoal)" : "var(--charcoal-light)",
              }}>
                Portfolio
              </Link>
            </li>
            <li>
              <Link href="/booking" style={{
                ...navLinkStyle,
                color: isActive("/booking") ? "var(--charcoal)" : "var(--charcoal-light)",
              }}>
                Booking
              </Link>
            </li>
            {user ? (
              <li style={{ position: "relative" }} ref={dropdownRef}>
                <AvatarButton />
                {dropdownOpen && <DropdownPanel />}
              </li>
            ) : (
              <li>
                <Link href="/login" style={ctaStyle}>Client Login</Link>
              </li>
            )}
          </>
        )}
      </ul>
    </nav>
  );
}

const logoStyle: React.CSSProperties = {
  fontFamily:     "'Cormorant Garamond', serif",
  fontSize:       "1.35rem",
  fontWeight:     500,
  letterSpacing:  "0.04em",
  color:          "var(--charcoal)",
  textDecoration: "none",
};

const navLinkStyle: React.CSSProperties = {
  fontSize:       "0.72rem",
  fontWeight:     400,
  letterSpacing:  "0.14em",
  textTransform:  "uppercase",
  color:          "var(--charcoal-light)",
  textDecoration: "none",
  transition:     "color 0.2s",
};

const ctaStyle: React.CSSProperties = {
  fontSize:       "0.7rem",
  letterSpacing:  "0.12em",
  textTransform:  "uppercase",
  color:          "var(--olive)",
  border:         "0.5px solid var(--olive)",
  padding:        "0.45rem 1.1rem",
  textDecoration: "none",
  transition:     "background 0.2s, color 0.2s",
};

const dropdownItemStyle: React.CSSProperties = {
  display:        "flex",
  alignItems:     "center",
  gap:            "0.65rem",
  padding:        "0.6rem 1.2rem",
  fontSize:       "0.78rem",
  color:          "var(--charcoal)",
  textDecoration: "none",
  fontFamily:     "'Jost', sans-serif",
  letterSpacing:  "0.03em",
  transition:     "background 0.15s",
};