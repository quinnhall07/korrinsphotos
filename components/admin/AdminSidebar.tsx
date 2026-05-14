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
      {
        label: "Clients",
        href: "/admin/clients",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="16" height="16">
            <circle cx="8" cy="5" r="2.6" />
            <path d="M2.5 14c0-3 2.5-5.2 5.5-5.2s5.5 2.2 5.5 5.2" />
          </svg>
        ),
      },
      {
        label: "Capacity",
        href: "/admin/calendar",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="16" height="16">
            <rect x="1" y="4" width="14" height="11" rx="0.5" />
            <path d="M5 1v4M11 1v4M1 8h14" />
            <rect x="4" y="10" width="2" height="2" rx="0.3" />
            <rect x="10" y="10" width="2" height="2" rx="0.3" />
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
      {
        label: "Lead Magnets",
        href: "/admin/lead-magnets",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="16" height="16">
            <path d="M3 2h7l3 3v9H3z" />
            <path d="M10 2v3h3" />
            <path d="M6 9l2 2 2-2M8 7v4" />
          </svg>
        ),
      },
      {
        label: "Shop",
        href: "/admin/shop",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="16" height="16">
            <path d="M2 5h12l-1 9H3z" />
            <path d="M5 5V3a3 3 0 016 0v2" />
          </svg>
        ),
      },
      {
        label: "Journal",
        href: "/admin/journal",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="16" height="16">
            <path d="M3 1h7l3 3v11H3z" />
            <path d="M10 1v3h3" />
            <path d="M5 7h6M5 10h6M5 13h4" />
          </svg>
        ),
      },
      {
        label: "Campaigns",
        href: "/admin/campaigns",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="16" height="16">
            <path d="M2 5h9l3 3-3 3H2z" />
            <path d="M2 5v9" />
          </svg>
        ),
      },
    ],
  },
  {
    group: "Clients",
    items: [
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
    group: "Marketing",
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
        label: "Broadcasts",
        href: "/admin/broadcasts",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="16" height="16">
            <path d="M2 6l12-4-3 12-4-5z" />
            <path d="M7 9l-1 5" />
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
    ],
  },
  {
    group: "Reports",
    items: [
      {
        label: "Finance",
        href: "/admin/reports/finance",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="16" height="16">
            <path d="M2 14V2M2 14h12M5 11V7M8 11V4M11 11V8" />
          </svg>
        ),
      },
      {
        label: "Tax & Expenses",
        href: "/admin/reports/tax",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="16" height="16">
            <rect x="2" y="2" width="12" height="12" rx="0.5" />
            <path d="M5 6h6M5 9h4M5 12h6" />
          </svg>
        ),
      },
      {
        label: "Sales Tax",
        href: "/admin/reports/sales-tax",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="16" height="16">
            <rect x="2" y="3" width="12" height="10" rx="0.5" />
            <path d="M5 7h6M5 10l3-3" />
          </svg>
        ),
      },
      {
        label: "Referrals",
        href: "/admin/reports/referrals",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="16" height="16">
            <circle cx="3" cy="8" r="2" />
            <circle cx="11" cy="3.5" r="2" />
            <circle cx="11" cy="12.5" r="2" />
            <path d="M4.7 7l4.6-2.6M4.7 9l4.6 2.6" />
          </svg>
        ),
      },
      {
        label: "Compliance",
        href: "/admin/reports/compliance",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="16" height="16">
            <path d="M8 1l5 2v5c0 3.5-2.3 6.4-5 7-2.7-.6-5-3.5-5-7V3l5-2z" />
            <path d="M5.5 8l2 2 3-4" />
          </svg>
        ),
      },
      {
        label: "Ad Spend",
        href: "/admin/reports/ad-spend",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="16" height="16">
            <path d="M2 13L6 9l3 3 5-7" />
            <path d="M10 5h4v4" />
          </svg>
        ),
      },
      {
        label: "First 100",
        href: "/admin/reports/first-100",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="16" height="16">
            <circle cx="8" cy="8" r="6.5" />
            <path d="M6 5h1v6M9.5 5L11 5.5 9.5 11" />
          </svg>
        ),
      },
      {
        label: "Quiet Season",
        href: "/admin/reports/quiet-season",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="16" height="16">
            <path d="M2 13h12" />
            <rect x="3" y="9" width="2" height="4" />
            <rect x="6.5" y="6" width="2" height="7" />
            <rect x="10" y="10" width="2" height="3" />
            <path d="M3 4l2 2 3-3 4 2" />
          </svg>
        ),
      },
      {
        label: "Health",
        href: "/admin/health",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="16" height="16">
            <path d="M1 8h3l2-5 4 10 2-5h3" />
          </svg>
        ),
      },
      {
        label: "Exports",
        href: "/admin/exports",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="16" height="16">
            <path d="M3 2h7l3 3v9H3z" />
            <path d="M10 2v3h3" />
            <path d="M8 8v4M6 10l2 2 2-2" />
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
      {
        label: "Gear Templates",
        href: "/admin/settings/gear-templates",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="16" height="16">
            <rect x="2" y="5" width="12" height="9" rx="0.5" />
            <path d="M6 5V3h4v2" />
            <path d="M5 9h6M5 11h4" />
          </svg>
        ),
      },
      {
        label: "Studio Hours",
        href: "/admin/settings/studio-hours",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="16" height="16">
            <circle cx="8" cy="8" r="6.5" />
            <path d="M8 4v4l2.5 2" />
          </svg>
        ),
      },
      {
        label: "Insurer",
        href: "/admin/settings/insurer",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="16" height="16">
            <path d="M8 1l6 3v4c0 4-3 6.5-6 7-3-0.5-6-3-6-7V4l6-3z" />
            <path d="M5.5 8l1.7 1.7L11 6" />
          </svg>
        ),
      },
      {
        label: "Brand voice",
        href: "/admin/settings/brand-voice",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="16" height="16">
            <path d="M3 3h4v4H5l-2 3V3z" />
            <path d="M9 3h4v4h-2l-2 3V3z" />
          </svg>
        ),
      },
      {
        label: "Tax",
        href: "/admin/settings/tax",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="16" height="16">
            <path d="M3 2h10v12H3z" />
            <path d="M5 5h6M5 8h6M5 11h4" />
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