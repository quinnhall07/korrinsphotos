"use client";

// components/admin/AdminSidebar.tsx
// Admin navigation sidebar. usePathname drives the active link highlight.

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  {
    group: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/admin",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="16" height="16">
            <rect x="1" y="1" width="6" height="6" rx="1" />
            <rect x="9" y="1" width="6" height="6" rx="1" />
            <rect x="1" y="9" width="6" height="6" rx="1" />
            <rect x="9" y="9" width="6" height="6" rx="1" />
          </svg>
        ),
      },
    ],
  },
  {
    group: "Content",
    items: [
      {
        label: "Events",
        href: "/admin/events",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="16" height="16">
            <rect x="1" y="4" width="14" height="11" rx="1" />
            <path d="M5 1v4M11 1v4M1 8h14" />
          </svg>
        ),
      },
    ],
  },
  {
    group: "Clients",
    items: [
      {
        label: "Booking Inquiries",
        href: "/admin/bookings",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="16" height="16">
            <path d="M2 4h12M2 8h12M2 12h7" />
          </svg>
        ),
      },
      {
        label: "Users",
        href: "/admin/users",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="16" height="16">
            <circle cx="8" cy="5" r="3" />
            <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" />
          </svg>
        ),
      },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <aside
      style={{
        borderRight: "0.5px solid var(--border)",
        padding: "2.5rem 0",
        background: "rgba(42,42,40,0.02)",
        position: "sticky",
        top: "72px",
        height: "calc(100vh - 72px)",
        overflowY: "auto",
      }}
    >
      {/* Logo lockup */}
      <div style={{ padding: "0 1.8rem 2rem" }}>
        <div
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "1.1rem",
            fontWeight: 500,
            color: "var(--charcoal)",
          }}
        >
          Korrin&apos;s Photography<span style={{ color: "var(--olive)" }}>.</span>
        </div>
        <p
          style={{
            fontSize: "0.68rem",
            color: "var(--charcoal-muted)",
            marginTop: "0.25rem",
          }}
        >
          Admin Dashboard
        </p>
      </div>

      {/* Nav groups */}
      {NAV.map(({ group, items }) => (
        <div key={group}>
          <p
            style={{
              fontSize: "0.6rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--charcoal-muted)",
              padding: "0 1.8rem",
              marginBottom: "0.5rem",
              marginTop: "1.5rem",
            }}
          >
            {group}
          </p>
          {items.map(({ label, href, icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.7rem 1.8rem",
                  fontSize: "0.82rem",
                  color: active ? "var(--charcoal)" : "var(--charcoal-light)",
                  borderLeft: active
                    ? "2px solid var(--olive)"
                    : "2px solid transparent",
                  background: active ? "rgba(107,120,69,0.06)" : "transparent",
                  textDecoration: "none",
                  transition: "all 0.2s",
                }}
              >
                <span style={{ opacity: 0.7, flexShrink: 0 }}>{icon}</span>
                {label}
              </Link>
            );
          })}
        </div>
      ))}

      {/* Back to public site */}
      <div
        style={{
          padding: "2rem 1.8rem 0",
          marginTop: "auto",
          borderTop: "0.5px solid var(--border)",
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          background: "rgba(42,42,40,0.02)",
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "0.75rem",
            color: "var(--charcoal-muted)",
            textDecoration: "none",
            padding: "0.75rem 0 1.5rem",
            transition: "color 0.2s",
            letterSpacing: "0.06em",
          }}
        >
          ← Public site
        </Link>
      </div>
    </aside>
  );
}