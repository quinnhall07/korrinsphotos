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
      {
        label: "Inbox",
        href: "/admin/inbox",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="16" height="16">
            <path d="M2 9l2-6h8l2 6M2 9v5h12V9M2 9h4l1 2h2l1-2h4" />
          </svg>
        ),
      },
      {
        label: "Pipeline",
        href: "/admin/projects",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="16" height="16">
            <rect x="1" y="2" width="4" height="12" rx="0.5" />
            <rect x="6" y="2" width="4" height="8" rx="0.5" />
            <rect x="11" y="2" width="4" height="5" rx="0.5" />
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
      {
        label: "Locations",
        href: "/admin/locations",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="16" height="16">
            <path d="M8 1c-3 0-5 2.2-5 5 0 3.7 5 9 5 9s5-5.3 5-9c0-2.8-2-5-5-5z" />
            <circle cx="8" cy="6" r="1.6" />
          </svg>
        ),
      },
      {
        label: "Vendors",
        href: "/admin/vendors",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="16" height="16">
            <path d="M2 6l6-4 6 4v8H2z" />
            <path d="M6 14V9h4v5" />
          </svg>
        ),
      },
    ],
  },
  {
    group: "Clients",
    items: [
      {
        label: "Segments",
        href: "/admin/segments",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="16" height="16">
            <circle cx="5" cy="6" r="3" />
            <circle cx="11" cy="6" r="3" />
            <circle cx="8" cy="11" r="3" />
          </svg>
        ),
      },
      {
        label: "Sequences",
        href: "/admin/sequences",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="16" height="16">
            <circle cx="3" cy="3" r="1.5" />
            <circle cx="13" cy="8" r="1.5" />
            <circle cx="3" cy="13" r="1.5" />
            <path d="M4 4l8 3M4 12l8-3" />
          </svg>
        ),
      },
      {
        label: "Questionnaires",
        href: "/admin/questionnaires/templates",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="16" height="16">
            <rect x="2" y="2" width="12" height="12" rx="0.5" />
            <path d="M5 6h6M5 9h6M5 12h3" />
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
  {
    group: "Settings",
    items: [
      {
        label: "Automations",
        href: "/admin/settings/automations",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="16" height="16">
            <circle cx="8" cy="8" r="2.5" />
            <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3" />
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
        padding: "1.5rem 0",
        background: "rgba(42,42,40,0.02)",
        position: "sticky",
        top: "72px",
        height: "calc(100vh - 72px)",
        overflowY: "auto",
      }}
    >
      {/* Logo lockup */}
      <div style={{ padding: "0 1.2rem 1.5rem" }}>
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
              padding: "0 1.2rem",
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
                  gap: "0.5rem",
                  padding: "0.5rem 1.2rem",
                  fontSize: "0.78rem",
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
          padding: "1.5rem 1.2rem 0",
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