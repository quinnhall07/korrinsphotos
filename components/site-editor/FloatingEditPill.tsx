"use client";

// components/site-editor/FloatingEditPill.tsx
// Bottom-right "Edit this page" pill — visible only to admins not currently
// in edit mode. Links to ?edit=1 on the current path so the same page becomes
// the canvas.

import Link from "next/link";
import { usePathname } from "next/navigation";

export function FloatingEditPill({ pageLabel }: { pageLabel: string }) {
  const pathname = usePathname();
  const href = `${pathname}?edit=1`;
  return (
    <Link
      href={href}
      title={`Edit ${pageLabel}`}
      style={{
        position: "fixed",
        bottom: "1.5rem",
        right: "1.5rem",
        zIndex: 8600,
        background: "var(--charcoal)",
        color: "var(--white)",
        textDecoration: "none",
        padding: "0.7rem 1.15rem",
        fontSize: "0.68rem",
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        boxShadow: "0 6px 20px rgba(42,42,40,0.22)",
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5rem",
      }}
    >
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--olive-light)" }} />
      Edit this page
    </Link>
  );
}
