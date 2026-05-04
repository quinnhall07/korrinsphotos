"use client";

// app/admin/bookings/BookingActions.tsx
// Inline action buttons for updating booking status.

import { useTransition } from "react";
import { updateBookingStatus } from "./actions";
import { toast } from "@/components/ui/Toaster";

const NEXT_STATUS: Record<string, { label: string; status: "PENDING" | "REVIEWED" | "BOOKED" | "ARCHIVED" }> = {
  PENDING: { label: "Mark Reviewed", status: "REVIEWED" },
  REVIEWED: { label: "Mark Booked", status: "BOOKED" },
  BOOKED: { label: "Archive", status: "ARCHIVED" },
  ARCHIVED: { label: "Restore", status: "PENDING" },
};

export function BookingActions({
  id,
  currentStatus,
}: {
  id: string;
  currentStatus: string;
}) {
  const [isPending, startTransition] = useTransition();
  const next = NEXT_STATUS[currentStatus];
  if (!next) return null;

  return (
    <button
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await updateBookingStatus(id, next.status);
          toast(`Marked as ${next.status.toLowerCase()}`);
        })
      }
      style={{
        padding: "0.45rem 0.9rem",
        fontSize: "0.65rem",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        background: currentStatus === "PENDING" ? "var(--olive)" : "transparent",
        color: currentStatus === "PENDING" ? "var(--white)" : "var(--charcoal)",
        border: `0.5px solid ${currentStatus === "PENDING" ? "var(--olive)" : "var(--border-strong)"}`,
        cursor: isPending ? "not-allowed" : "pointer",
        fontFamily: "'Jost', sans-serif",
        transition: "all 0.2s",
        whiteSpace: "nowrap",
      }}
    >
      {isPending ? "…" : next.label}
    </button>
  );
}