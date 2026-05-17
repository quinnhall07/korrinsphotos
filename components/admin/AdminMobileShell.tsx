"use client";

// components/admin/AdminMobileShell.tsx
// Responsive wrapper that renders <AdminSidebar /> in two modes:
//   - Desktop (>= 900px): inline as the 200px sidebar column. Visually
//     identical to the previous behaviour.
//   - Mobile  (< 900px): slides in from the left as a drawer over a
//     translucent backdrop. Dismissed by tapping the backdrop or by
//     navigating to a new route.
//
// The companion <AdminMobileHeader /> renders the hamburger + search bar
// above the grid on mobile only.

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AdminSidebar } from "./AdminSidebar";
import { useCommandPalette } from "@/components/ui/CommandPaletteProvider";

const BREAKPOINT_PX = 900;

/**
 * Sidebar slot: occupies grid column 1 on desktop, hidden on mobile.
 * Also renders the mobile drawer + backdrop (position: fixed, so they
 * are out of the grid flow at all widths).
 */
export function AdminSidebarSlot() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // Auto-dismiss the drawer when the route changes (e.g. tapping a nav
  // link inside the drawer should land on the new page with the drawer
  // closed).
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  // Listen for "open-admin-drawer" events from the mobile header.
  useEffect(() => {
    const onOpen = () => setDrawerOpen(true);
    window.addEventListener("admin-drawer:open", onOpen);
    return () => window.removeEventListener("admin-drawer:open", onOpen);
  }, []);

  return (
    <>
      {/* Desktop sidebar — inline grid column on >= 900px. Hidden via CSS on mobile. */}
      <div className="admin-sidebar-desktop">
        <AdminSidebar />
      </div>

      {/* Mobile drawer + backdrop (position: fixed) */}
      <div
        className={`admin-drawer-backdrop${drawerOpen ? " is-open" : ""}`}
        onClick={closeDrawer}
        aria-hidden={!drawerOpen}
      />
      <div
        className={`admin-drawer${drawerOpen ? " is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Admin navigation"
      >
        <AdminSidebar />
      </div>

      <style>{`
        /* Drawer + backdrop are off by default at desktop widths */
        .admin-drawer-backdrop,
        .admin-drawer {
          display: none;
        }

        @media (max-width: ${BREAKPOINT_PX - 1}px) {
          /* Collapse the inline desktop sidebar slot on mobile so the
             grid gives the content area full width. */
          .admin-sidebar-desktop {
            display: none;
          }

          .admin-drawer-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.4);
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.25s ease;
            z-index: 1100;
          }
          .admin-drawer-backdrop.is-open {
            opacity: 1;
            pointer-events: auto;
          }

          .admin-drawer {
            display: block;
            position: fixed;
            top: 0;
            left: 0;
            bottom: 0;
            width: min(280px, 82vw);
            background: var(--white);
            border-right: 0.5px solid var(--border);
            transform: translateX(-100%);
            transition: transform 0.28s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            z-index: 1110;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
          }
          .admin-drawer.is-open {
            transform: translateX(0);
          }

          /* Inside the drawer, neutralise the sidebar's own sticky/position
             rules so it fills the drawer naturally. */
          .admin-drawer > aside {
            position: static;
            top: auto;
            height: auto;
            min-height: 100%;
            overflow-y: visible;
          }
          .admin-drawer > aside > div:last-child {
            position: static;
          }
        }
      `}</style>
    </>
  );
}

/**
 * Thin mobile-only header bar above the content area: hamburger (opens
 * drawer via a window event picked up by <AdminSidebarSlot />), brand
 * wordmark, and a search icon that opens the Cmd-K palette.
 */
export function AdminMobileHeader() {
  const palette = useCommandPalette();

  const openDrawer = useCallback(() => {
    window.dispatchEvent(new Event("admin-drawer:open"));
  }, []);

  return (
    <>
      <div className="admin-mobile-header">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={openDrawer}
          className="admin-mobile-iconbtn"
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            width="20"
            height="20"
          >
            <path d="M3 5h14M3 10h14M3 15h14" />
          </svg>
        </button>

        <div className="admin-mobile-brand">
          Korrin&apos;s<span style={{ color: "var(--olive)" }}>.</span>
        </div>

        <button
          type="button"
          aria-label="Open search"
          onClick={palette.open}
          className="admin-mobile-iconbtn"
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            width="18"
            height="18"
          >
            <circle cx="9" cy="9" r="6" />
            <path d="M13.5 13.5L17 17" />
          </svg>
        </button>
      </div>

      <style>{`
        .admin-mobile-header {
          display: none;
        }

        @media (max-width: ${BREAKPOINT_PX - 1}px) {
          .admin-mobile-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.75rem;
            position: sticky;
            top: 72px;
            z-index: 50;
            height: 48px;
            padding: 0 0.75rem;
            background: var(--white);
            border-bottom: 0.5px solid var(--border);
          }

          .admin-mobile-iconbtn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            background: transparent;
            border: none;
            color: var(--charcoal);
            cursor: pointer;
            padding: 0;
          }
          .admin-mobile-iconbtn:active {
            background: rgba(42, 42, 40, 0.06);
          }

          .admin-mobile-brand {
            font-family: "Cormorant Garamond", serif;
            font-size: 1rem;
            font-weight: 500;
            color: var(--charcoal);
          }
        }
      `}</style>
    </>
  );
}
