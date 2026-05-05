"use client";

// app/admin/bookings/KanbanBoard.tsx
// Drag-and-drop Kanban board for managing booking inquiry pipeline.
// Columns map to LeadStatus values (excluding ARCHIVED).
// Drag between columns fires updateBookingStatus server action.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KanbanCard, type KanbanInquiry } from "./KanbanCard";
import { updateBookingStatus } from "./actions";
import { toast } from "@/components/ui/Toaster";
import { KANBAN_STATUSES, type LeadStatus } from "@/lib/firestore";

interface KanbanBoardProps {
  inquiries: KanbanInquiry[];
  onOpenDrawer: (inquiry: KanbanInquiry) => void;
}

export function KanbanBoard({ inquiries, onOpenDrawer }: KanbanBoardProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<LeadStatus | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Group inquiries by status (only active statuses — ARCHIVED excluded)
  const byStatus = KANBAN_STATUSES.reduce<Record<string, KanbanInquiry[]>>(
    (acc, col) => {
      acc[col.id] = inquiries.filter((i) => i.status === col.id);
      return acc;
    },
    {}
  );

  function handleDragStart(e: React.DragEvent, id: string) {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }

  function handleDragOver(e: React.DragEvent, status: LeadStatus) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(status);
  }

  function handleDragLeave() {
    setDragOverColumn(null);
  }

  function handleDrop(e: React.DragEvent, targetStatus: LeadStatus) {
    e.preventDefault();
    setDragOverColumn(null);

    const id = e.dataTransfer.getData("text/plain") || draggingId;
    if (!id) return;

    const inquiry = inquiries.find((i) => i.id === id);
    if (!inquiry || inquiry.status === targetStatus) {
      setDraggingId(null);
      return;
    }

    startTransition(async () => {
      await updateBookingStatus(id, targetStatus);
      const colLabel = KANBAN_STATUSES.find((c) => c.id === targetStatus)?.label ?? targetStatus;
      toast(`Moved to ${colLabel}`);
      router.refresh();
    });

    setDraggingId(null);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverColumn(null);
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${KANBAN_STATUSES.length}, minmax(220px, 1fr))`,
        gap: "0.75rem",
        overflowX: "auto",
        paddingBottom: "1rem",
      }}
    >
      {KANBAN_STATUSES.map((col) => {
        const colInquiries = byStatus[col.id] ?? [];
        const isOver = dragOverColumn === col.id;

        return (
          <div
            key={col.id}
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.id)}
            style={{
              display: "flex",
              flexDirection: "column",
              minHeight: "400px",
              border: isOver
                ? "1.5px dashed var(--olive)"
                : "0.5px solid var(--border)",
              background: isOver
                ? "rgba(107,120,69,0.04)"
                : "rgba(42,42,40,0.02)",
              transition: "border-color 0.15s, background 0.15s",
              borderRadius: 0,
            }}
          >
            {/* Column header */}
            <div
              style={{
                padding: "0.85rem 1rem",
                borderBottom: "0.5px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--white)",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: (col.badgeStyle.color as string) ?? "var(--olive)",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: "0.68rem",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    fontWeight: 500,
                    color: "var(--charcoal)",
                    fontFamily: "'Jost', sans-serif",
                  }}
                >
                  {col.label}
                </span>
              </div>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: "20px",
                  height: "20px",
                  borderRadius: "10px",
                  background: "var(--olive-dim)",
                  color: "var(--olive)",
                  fontSize: "0.62rem",
                  fontWeight: 600,
                  fontFamily: "'Jost', sans-serif",
                  padding: "0 4px",
                }}
              >
                {colInquiries.length}
              </span>
            </div>

            {/* Cards */}
            <div
              style={{
                flex: 1,
                padding: "0.75rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.6rem",
                overflowY: "auto",
              }}
            >
              {colInquiries.length === 0 && (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--charcoal-muted)",
                    fontSize: "0.72rem",
                    letterSpacing: "0.06em",
                    opacity: 0.5,
                    minHeight: "80px",
                    border: "1px dashed var(--border)",
                    borderRadius: 0,
                  }}
                >
                  Drop here
                </div>
              )}
              {colInquiries.map((inq) => (
                <KanbanCard
                  key={inq.id}
                  inquiry={inq}
                  onOpen={onOpenDrawer}
                  onDragStart={handleDragStart}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Global drag end capture */}
      <style>{`
        [draggable=true] { user-select: none; }
      `}</style>
    </div>
  );
}