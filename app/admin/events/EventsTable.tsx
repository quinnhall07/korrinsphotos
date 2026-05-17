"use client";

// app/admin/events/EventsTable.tsx
// Client component: search/filter input + events table with delete button.
// Filtering is purely client-side — no refetch needed.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { deleteEvent } from "./actions";
import { toast } from "@/components/ui/Toaster";

// Mirrors EventStatus in lib/db/events.ts. Duplicated here because this is a
// "use client" file and cannot import the server-only db module.
type EventStatus =
  | "UPCOMING"
  | "ACTIVE"
  | "COMPLETED"
  | "DELIVERED"
  | "ARCHIVED";

const STATUS_BADGES: Record<EventStatus, { bg: string; color: string; label: string }> = {
  UPCOMING: { bg: "#DBEAFE", color: "#1D4ED8", label: "Upcoming" },
  ACTIVE: { bg: "#FEF3C7", color: "#92400E", label: "Active" },
  COMPLETED: { bg: "#D1FAE5", color: "#065F46", label: "Completed" },
  DELIVERED: { bg: "#E8EBD8", color: "#3F5311", label: "Delivered" },
  ARCHIVED: { bg: "#E5E7EB", color: "#4B5563", label: "Archived" },
};

export interface SerializedEventRow {
  id: string;
  title: string;
  status: EventStatus;
  createdAt: string;
  shootDate: string | null;
  photoCount: number;
  clientCount: number;
}

interface EventsTableProps {
  events: SerializedEventRow[];
}

export function EventsTable({ events }: EventsTableProps) {
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const filtered = search.trim()
    ? events.filter((ev) =>
        ev.title.toLowerCase().includes(search.trim().toLowerCase())
      )
    : events;

  function handleDelete(eventId: string, eventTitle: string) {
    if (
      !confirm(
        `Permanently delete "${eventTitle}"?\n\nThis will remove all photos, client access, and associated Cloudflare assets. This cannot be undone.`
      )
    )
      return;

    startTransition(async () => {
      const result = await deleteEvent(eventId);
      if (result.success) {
        toast("Event deleted");
        router.refresh();
      } else {
        toast(result.error ?? "Failed to delete event");
      }
    });
  }

  return (
    <>
      {/* Search / filter input */}
      <div style={{ marginBottom: "1.25rem" }}>
        <div style={{ position: "relative" }}>
          <span
            style={{
              position: "absolute",
              left: "1rem",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--charcoal-muted)",
              fontSize: "0.82rem",
              pointerEvents: "none",
            }}
          >
            🔍
          </span>
          <input
            type="text"
            placeholder="Filter by event title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "0.7rem 1rem 0.7rem 2.6rem",
              fontSize: "0.85rem",
              border: "0.5px solid var(--border)",
              background: "var(--white)",
              color: "var(--charcoal)",
              fontFamily: "'Jost', sans-serif",
              outline: "none",
              transition: "border-color 0.15s",
            }}
          />
        </div>
        {search.trim() && (
          <p
            style={{
              fontSize: "0.72rem",
              color: "var(--charcoal-muted)",
              marginTop: "0.4rem",
              letterSpacing: "0.04em",
            }}
          >
            {filtered.length} of {events.length} event{events.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Table */}
      <div style={{ border: "0.5px solid var(--border)", background: "var(--white)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr>
              {["Event", "Photos", "Clients", "Status", "Shoot Date", "Created", ""].map((h) => (
                <th key={h} style={thStyle}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  style={{ ...tdStyle, textAlign: "center", color: "var(--charcoal-muted)" }}
                >
                  {search.trim()
                    ? "No events match your search."
                    : "No events yet. Create your first one above."}
                </td>
              </tr>
            )}
            {filtered.map((ev) => {
              const badge = STATUS_BADGES[ev.status] ?? STATUS_BADGES.UPCOMING;
              return (
                <tr key={ev.id}>
                  <td style={tdStyle}>
                    <strong style={{ fontWeight: 500 }}>{ev.title}</strong>
                  </td>
                  <td style={tdStyle}>{ev.photoCount}</td>
                  <td style={tdStyle}>{ev.clientCount}</td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "0.25rem 0.65rem",
                        fontSize: "0.62rem",
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        background: badge.bg,
                        color: badge.color,
                      }}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td style={tdStyle}>{ev.shootDate ?? "—"}</td>
                  <td style={tdStyle}>{ev.createdAt}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <Link href={`/admin/events/${ev.id}`} style={btnOutlineDark}>
                        Manage
                      </Link>
                      <button
                        onClick={() => handleDelete(ev.id, ev.title)}
                        disabled={isPending}
                        title="Delete event"
                        style={{
                          padding: "0.6rem 0.9rem",
                          fontSize: "0.68rem",
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          color: "#991B1B",
                          background: "none",
                          border: "0.5px solid #FCA5A5",
                          cursor: "pointer",
                          fontFamily: "'Jost', sans-serif",
                          opacity: isPending ? 0.5 : 1,
                          transition: "opacity 0.15s",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "0.75rem 1rem",
  fontSize: "0.65rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--charcoal-muted)",
  borderBottom: "0.5px solid var(--border-strong)",
  fontWeight: 400,
};
const tdStyle: React.CSSProperties = {
  padding: "0.9rem 1rem",
  borderBottom: "0.5px solid var(--border)",
  color: "var(--charcoal-light)",
  verticalAlign: "middle",
};
const btnOutlineDark: React.CSSProperties = {
  display: "inline-block",
  padding: "0.6rem 1.4rem",
  fontSize: "0.68rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--charcoal)",
  border: "0.5px solid var(--border-strong)",
  textDecoration: "none",
};
