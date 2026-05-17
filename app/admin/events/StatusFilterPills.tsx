// app/admin/events/StatusFilterPills.tsx
// Server-rendered pill row of status filters for /admin/events.
// Each pill is a plain `<Link>` so navigation is a full server-side refetch —
// no client-side state, no cursor leakage when the filter changes.

import Link from "next/link";
import type { EventStatus } from "@/lib/db/events";

const PILLS: ReadonlyArray<{ label: string; value: EventStatus | "ALL" }> = [
  { label: "All", value: "ALL" },
  { label: "Upcoming", value: "UPCOMING" },
  { label: "Active", value: "ACTIVE" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Delivered", value: "DELIVERED" },
  { label: "Archived", value: "ARCHIVED" },
];

interface StatusFilterPillsProps {
  /** Currently-selected statuses (parsed from `?status=…`). Empty = "All". */
  active: EventStatus[];
}

export function StatusFilterPills({ active }: StatusFilterPillsProps) {
  const activeSet = new Set<string>(active);
  const isAll = active.length === 0;

  return (
    <div
      style={{
        display: "flex",
        gap: "0.5rem",
        flexWrap: "wrap",
        marginBottom: "1.25rem",
      }}
    >
      {PILLS.map((pill) => {
        // Build href fresh for every pill — switching filter must NEVER carry
        // the current cursor (a cursor decoded against a different filter
        // window paginates to the wrong place or 404s).
        const isActive =
          pill.value === "ALL" ? isAll : activeSet.has(pill.value);
        const href =
          pill.value === "ALL"
            ? "/admin/events"
            : `/admin/events?status=${pill.value}`;

        return (
          <Link
            key={pill.value}
            href={href}
            style={{
              padding: "0.45rem 1rem",
              fontSize: "0.68rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontFamily: "'Jost', sans-serif",
              textDecoration: "none",
              border: isActive
                ? "0.5px solid var(--olive)"
                : "0.5px solid var(--border-strong)",
              background: isActive ? "var(--olive)" : "transparent",
              color: isActive ? "var(--white)" : "var(--charcoal)",
              transition: "background 0.15s, color 0.15s",
            }}
          >
            {pill.label}
          </Link>
        );
      })}
    </div>
  );
}
