"use client";

// components/Navbar.tsx
// Role-aware navigation using Firebase Auth context.
// Role is determined by the server session (stored in cookie),
// but for client-side nav rendering we read it from the AuthProvider.

import Link        from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useState, useEffect } from "react";

export function Navbar() {
  const pathname       = usePathname();
  const { user, signOut } = useAuth();
  const [role, setRole]   = useState<"ADMIN" | "CLIENT" | null>(null);

  // Fetch role from the server session (custom claims) once the Firebase user loads
  useEffect(() => {
    if (!user) { setRole(null); return; }
    user.getIdTokenResult().then((result) => {
      setRole((result.claims.role as "ADMIN" | "CLIENT") ?? "CLIENT");
    });
  }, [user]);

  const isAdminRoute  = pathname.startsWith("/admin");
  const isClientRoute = pathname.startsWith("/gallery");

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(path + "/");

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
      {/* Logo */}
      <Link href="/" style={logoStyle}>
        Korrin&apos;s<span style={{ color: "var(--olive)" }}>.</span>
      </Link>

      <ul style={{ display: "flex", alignItems: "center", gap: "2.5rem", listStyle: "none" }}>
        {isAdminRoute ? (
          <li><Link href="/" style={navLinkStyle}>← Public Site</Link></li>
        ) : isClientRoute ? (
          <>
            <li>
              <Link href="/gallery" style={{ ...navLinkStyle, color: isActive("/gallery") ? "var(--charcoal)" : "var(--charcoal-light)" }}>
                My Galleries
              </Link>
            </li>
            
            {/* NEW: Display the logged-in user's email */}
            {user && (
              <li>
                <span style={{ ...navLinkStyle, color: "var(--charcoal-muted)", textTransform: "none", letterSpacing: "0.05em" }}>
                  {user.email}
                </span>
              </li>
            )}

            <li>
              <button onClick={signOut} style={{ ...navLinkStyle, background: "none", border: "none", cursor: "pointer" }}>
                Sign Out
              </button>
            </li>
          </>
        ) : (
          <>
            <li>
              <Link href="/portfolio" style={{ ...navLinkStyle, color: isActive("/portfolio") ? "var(--charcoal)" : "var(--charcoal-light)" }}>
                Portfolio
              </Link>
            </li>
            <li>
              <Link href="/booking" style={{ ...navLinkStyle, color: isActive("/booking") ? "var(--charcoal)" : "var(--charcoal-light)" }}>
                Booking
              </Link>
            </li>
            {user ? (
              <li>
                <Link href={role === "ADMIN" ? "/admin" : "/gallery"} style={ctaStyle}>
                  {role === "ADMIN" ? "Admin" : "My Gallery"}
                </Link>
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