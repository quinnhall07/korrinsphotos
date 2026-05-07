"use client";

// app/admin/bookings/BulkActions.tsx
// Floating action bar that appears when one or more inquiry rows are selected.
// Supports bulk status changes and batch archival.

import { useState, useTransition } from "react";
import { bulkUpdateStatus } from "./inquiry-actions";
import { toast } from "@/components/ui/Toaster";
import type { LeadStatus } from "@/lib/booking-kanban";

interface BulkActionsProps {
  selectedIds: string[];
  onClearSelection: () => void;
}

const BULK_STATUS_OPTIONS: { status: LeadStatus; label: string }[] = [
  { status: "QUALIFIED",      label: "Move → Qualified" },
  { status: "SENT_PROPOSAL",  label: "Move → Proposal Sent" },
  { status: "CONTRACT_SENT",  label: "Move → Contract Out" },
  { status: "BOOKED",         label: "Move → Booked" },
  { status: "ARCHIVED",       label: "Archive" },
];

export function BulkActions({ selectedIds, onClearSelection }: BulkActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [confirmArchive, setConfirmArchive] = useState(false);

  if (selectedIds.length === 0) return null;

  function handleBulk(status: LeadStatus) {
    if (status === "ARCHIVED" && !confirmArchive) {
      setConfirmArchive(true);
      return;
    }
    startTransition(async () => {
      const result = await bulkUpdateStatus(selectedIds, status);
      if (result.success) {
        toast(
          status === "ARCHIVED"
            ? `${selectedIds.length} inquir${selectedIds.length === 1 ? "y" : "ies"} archived`
            : `${selectedIds.length} inquir${selectedIds.length === 1 ? "y" : "ies"} moved to ${status.toLowerCase().replace("_", " ")}`
        );
        onClearSelection();
        setConfirmArchive(false);
      } else {
        toast(result.error ?? "Bulk action failed.");
      }
    });
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: "2rem",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 500,
        background: "var(--charcoal)",
        color: "var(--white)",
        display: "flex",
        alignItems: "center",
        gap: "0",
        boxShadow: "0 12px 40px rgba(42,42,40,0.35)",
        animation: "fadeIn 0.25s ease",
        overflow: "hidden",
        minWidth: "640px",
      }}
    >
      {/* Selection count */}
      <div
        style={{
          padding: "0 1.4rem",
          borderRight: "0.5px solid rgba(250,249,246,0.12)",
          fontSize: "0.75rem",
          letterSpacing: "0.08em",
          whiteSpace: "nowrap",
          height: "48px",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          background: "rgba(250,249,246,0.06)",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "22px",
            height: "22px",
            background: "var(--olive)",
            borderRadius: "50%",
            fontSize: "0.65rem",
            fontWeight: 600,
          }}
        >
          {selectedIds.length}
        </span>
        selected
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", flex: 1 }}>
        {confirmArchive ? (
          <>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                padding: "0 1.2rem",
                fontSize: "0.72rem",
                color: "#FCA5A5",
                borderRight: "0.5px solid rgba(250,249,246,0.12)",
                height: "48px",
              }}
            >
              Archive {selectedIds.length} inquir{selectedIds.length === 1 ? "y" : "ies"}?
            </span>
            <button
              onClick={() => handleBulk("ARCHIVED")}
              disabled={isPending}
              style={actionBtnStyle}
            >
              {isPending ? "…" : "Confirm Archive"}
            </button>
            <button
              onClick={() => setConfirmArchive(false)}
              style={{ ...actionBtnStyle, color: "rgba(250,249,246,0.5)" }}
            >
              Cancel
            </button>
          </>
        ) : (
          BULK_STATUS_OPTIONS.map((opt, i) => (
            <button
              key={opt.status}
              onClick={() => handleBulk(opt.status)}
              disabled={isPending}
              style={{
                ...actionBtnStyle,
                borderRight:
                  i < BULK_STATUS_OPTIONS.length - 1
                    ? "0.5px solid rgba(250,249,246,0.08)"
                    : "none",
                color:
                  opt.status === "ARCHIVED"
                    ? "rgba(252,165,165,0.8)"
                    : opt.status === "BOOKED"
                    ? "rgba(110,231,183,0.9)"
                    : "rgba(250,249,246,0.85)",
              }}
            >
              {isPending ? "…" : opt.label}
            </button>
          ))
        )}
      </div>

      {/* Clear selection */}
      <button
        onClick={() => { onClearSelection(); setConfirmArchive(false); }}
        style={{
          padding: "0 1rem",
          height: "48px",
          background: "none",
          border: "none",
          borderLeft: "0.5px solid rgba(250,249,246,0.12)",
          color: "rgba(250,249,246,0.4)",
          cursor: "pointer",
          fontSize: "1rem",
          display: "flex",
          alignItems: "center",
          transition: "color 0.15s",
          flexShrink: 0,
        }}
        aria-label="Clear selection"
      >
        ✕
      </button>
    </div>
  );
}

const actionBtnStyle: React.CSSProperties = {
  padding: "0 1.1rem",
  height: "48px",
  background: "none",
  border: "none",
  color: "rgba(250,249,246,0.85)",
  cursor: "pointer",
  fontSize: "0.65rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  fontFamily: "'Jost', sans-serif",
  transition: "background 0.15s",
  whiteSpace: "nowrap",
};
