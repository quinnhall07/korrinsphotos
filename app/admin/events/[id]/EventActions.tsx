"use client";

// app/admin/events/[id]/EventActions.tsx
// Destructive actions: Delete entire event or clear gallery (photos + access).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteEvent, clearGallery } from "../actions";
import { toast } from "@/components/ui/Toaster";

interface EventActionsProps {
  eventId: string;
  eventTitle: string;
  photoCount: number;
  clientCount: number;
}

export function EventActions({
  eventId,
  eventTitle,
  photoCount,
  clientCount,
}: EventActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();

  function handleDelete() {
    if (
      !confirm(
        `Permanently delete "${eventTitle}"?\n\nThis will remove the event, all ${photoCount} photo(s), ${clientCount} client access grant(s), and all associated Cloudflare assets.\n\nThis cannot be undone.`
      )
    )
      return;

    startTransition(async () => {
      const result = await deleteEvent(eventId);
      if (result.success) {
        toast("Event deleted");
        router.push("/admin/events");
      } else {
        toast(result.error ?? "Failed to delete event");
      }
    });
  }

  function handleClearGallery() {
    if (
      !confirm(
        `Clear the gallery for "${eventTitle}"?\n\nThis will delete all ${photoCount} photo(s) and revoke access for ${clientCount} client(s).\n\nThe event record itself will be preserved.`
      )
    )
      return;

    startTransition(async () => {
      const result = await clearGallery(eventId);
      if (result.success) {
        toast("Gallery cleared");
        router.refresh();
      } else {
        toast(result.error ?? "Failed to clear gallery");
      }
    });
  }

  return (
    <div style={{ marginTop: "2.5rem" }}>
      {/* Toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          fontSize: "0.68rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--charcoal-muted)",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontFamily: "'Jost', sans-serif",
          padding: 0,
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
        }}
      >
        <span
          style={{
            display: "inline-block",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.15s",
          }}
        >
          ▶
        </span>
        Danger Zone
      </button>

      {expanded && (
        <div
          style={{
            marginTop: "1rem",
            border: "0.5px solid #FCA5A5",
            background: "#FEF2F2",
            padding: "1.25rem 1.5rem",
            display: "flex",
            gap: "1rem",
            flexWrap: "wrap",
            alignItems: "center",
            animation: "fadeIn 0.2s ease",
          }}
        >
          <div style={{ flex: 1, minWidth: "200px" }}>
            <p
              style={{
                fontSize: "0.82rem",
                color: "#991B1B",
                fontWeight: 500,
                marginBottom: "0.25rem",
              }}
            >
              Destructive Actions
            </p>
            <p style={{ fontSize: "0.75rem", color: "#B91C1C", lineHeight: 1.6 }}>
              These actions are permanent. Clear Gallery removes photos and client access
              but keeps the event. Delete Event removes everything.
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexShrink: 0 }}>
            <button
              onClick={handleClearGallery}
              disabled={isPending || (photoCount === 0 && clientCount === 0)}
              style={{
                padding: "0.6rem 1.4rem",
                fontSize: "0.68rem",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#92400E",
                background: "none",
                border: "0.5px solid #FED7AA",
                cursor:
                  isPending || (photoCount === 0 && clientCount === 0)
                    ? "not-allowed"
                    : "pointer",
                fontFamily: "'Jost', sans-serif",
                opacity:
                  isPending || (photoCount === 0 && clientCount === 0) ? 0.5 : 1,
                transition: "opacity 0.15s",
              }}
            >
              {isPending ? "Working…" : "Clear Gallery"}
            </button>

            <button
              onClick={handleDelete}
              disabled={isPending}
              style={{
                padding: "0.6rem 1.4rem",
                fontSize: "0.68rem",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#FFFFFF",
                background: "#991B1B",
                border: "none",
                cursor: isPending ? "not-allowed" : "pointer",
                fontFamily: "'Jost', sans-serif",
                opacity: isPending ? 0.5 : 1,
                transition: "opacity 0.15s",
              }}
            >
              {isPending ? "Deleting…" : "Delete Event"}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
