"use client";

// app/admin/bookings/KanbanBoard.tsx
// Drag-and-drop Kanban board for managing booking inquiry pipeline.
// Uses dnd-kit for smooth drag animations.

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { KanbanCard, type KanbanInquiry } from "./KanbanCard";
import { updateBookingStatus } from "./actions";
import { toast } from "@/components/ui/Toaster";
import { KANBAN_STATUSES, type LeadStatus } from "@/lib/booking-kanban";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  useDroppable,
} from "@dnd-kit/core";

interface KanbanBoardProps {
  inquiries: KanbanInquiry[];
  onOpenDrawer: (inquiry: KanbanInquiry) => void;
}

export function KanbanBoard({ inquiries, onOpenDrawer }: KanbanBoardProps) {
  const [, startTransition] = useTransition();
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Requires a 5px drag to start, allowing clicks to pass through
      },
    })
  );

  const byStatus = useMemo(() => {
    const now = new Date();
    return KANBAN_STATUSES.reduce<Record<string, KanbanInquiry[]>>(
      (acc, col) => {
        acc[col.id] = inquiries
          .filter((i) => i.status === col.id)
          .sort((a, b) => {
            const aOverdue =
              a.followUpDate &&
              new Date(a.followUpDate) < now &&
              a.status !== "BOOKED" &&
              a.status !== "ARCHIVED"
                ? 1
                : 0;
            const bOverdue =
              b.followUpDate &&
              new Date(b.followUpDate) < now &&
              b.status !== "BOOKED" &&
              b.status !== "ARCHIVED"
                ? 1
                : 0;
            if (bOverdue !== aOverdue) return bOverdue - aOverdue;
            return (b.leadScore ?? 0) - (a.leadScore ?? 0);
          });
        return acc;
      },
      {}
    );
  }, [inquiries]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const id = active.id as string;
    const targetStatus = over.id as LeadStatus;

    const inquiry = inquiries.find((i) => i.id === id);
    if (!inquiry || inquiry.status === targetStatus) {
      return;
    }

    startTransition(async () => {
      await updateBookingStatus(id, targetStatus);
      const colLabel = KANBAN_STATUSES.find((c) => c.id === targetStatus)?.label ?? targetStatus;
      toast(`Moved to ${colLabel}`);
      router.refresh();
    });
  }

  const activeInquiry = activeId ? inquiries.find((i) => i.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${KANBAN_STATUSES.length}, minmax(200px, 1fr))`,
          gap: "0.5rem",
          overflowX: "auto",
          paddingBottom: "1rem",
        }}
      >
        {KANBAN_STATUSES.map((col) => (
          <KanbanColumn
            key={col.id}
            col={col}
            inquiries={byStatus[col.id] ?? []}
            onOpenDrawer={onOpenDrawer}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
        {activeInquiry ? (
          <div style={{ transform: 'scale(1.02)' }}>
            <KanbanCard inquiry={activeInquiry} onOpen={onOpenDrawer} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

interface KanbanColumnProps {
  col: typeof KANBAN_STATUSES[0];
  inquiries: KanbanInquiry[];
  onOpenDrawer: (inquiry: KanbanInquiry) => void;
}

function KanbanColumn({ col, inquiries, onOpenDrawer }: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: col.id,
  });

  return (
    <div
      ref={setNodeRef}
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
          {inquiries.length}
        </span>
      </div>

      {/* Cards */}
      <div
        style={{
          flex: 1,
          padding: "0.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          overflowY: "auto",
        }}
      >
        {inquiries.length === 0 && (
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
        {inquiries.map((inq) => (
          <KanbanCard
            key={inq.id}
            inquiry={inq}
            onOpen={onOpenDrawer}
          />
        ))}
      </div>
    </div>
  );
}
