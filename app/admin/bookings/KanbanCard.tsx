"use client";

// app/admin/bookings/KanbanCard.tsx
// Single Kanban card. Draggable, shows lead score, tags, session type, and date.
// Fires onOpen when clicked to open the LeadDetailDrawer.

import { getScoreColor } from "@/lib/lead-scoring";
import { LeadScoreBadge } from "./LeadScoreBadge";

export interface KanbanInquiry {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  sessionType: string;
  preferredDate: string | null;
  createdAt: string;
  message: string;
  notes: string;
  pricing: string;
  status: string;
  leadScore: number;
  tags: string[];
  leadSource: string | null;
  estimatedValue: number | null;
  followUpDate: string | null;
  lastContactedAt: string | null;
  lastRespondedAt: string | null;
  communicationLog: {
    id: string;
    channel: string;
    summary: string;
    timestamp: string;
    adminUid: string;
  }[];
}

interface KanbanCardProps {
  inquiry: KanbanInquiry;
  onOpen: (inquiry: KanbanInquiry) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
}

const SESSION_COLORS: Record<string, { bg: string; color: string }> = {
  Wedding:    { bg: "#FEE2E2", color: "#991B1B" },
  Engagement: { bg: "#FCE7F3", color: "#9D174D" },
  Portrait:   { bg: "#EDE9FE", color: "#5B21B6" },
  Editorial:  { bg: "#DBEAFE", color: "#1D4ED8" },
  Family:     { bg: "#D1FAE5", color: "#065F46" },
  Commercial: { bg: "#FEF3C7", color: "#92400E" },
};

export function KanbanCard({ inquiry, onOpen, onDragStart }: KanbanCardProps) {
  const sessionColor = SESSION_COLORS[inquiry.sessionType] ?? { bg: "var(--olive-dim)", color: "var(--olive)" };
  const isOverdue =
    inquiry.followUpDate &&
    new Date(inquiry.followUpDate) < new Date() &&
    inquiry.status !== "BOOKED" &&
    inquiry.status !== "ARCHIVED";

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, inquiry.id)}
      onClick={() => onOpen(inquiry)}
      style={{
        background: "var(--white)",
        border: "0.5px solid var(--border)",
        borderLeft: `2px solid ${getScoreColor(inquiry.leadScore)}`,
        padding: "0.9rem",
        cursor: "grab",
        transition: "box-shadow 0.2s, border-color 0.2s",
        userSelect: "none",
        position: "relative",
      }}
      className="kanban-card"
    >
      {/* Overdue follow-up indicator */}
      {isOverdue && (
        <div
          title="Follow-up overdue"
          style={{
            position: "absolute",
            top: "0.5rem",
            right: "0.5rem",
            width: "7px",
            height: "7px",
            borderRadius: "50%",
            background: "#EF4444",
          }}
        />
      )}

      {/* Session type badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem" }}>
        <span
          style={{
            display: "inline-block",
            padding: "0.18rem 0.55rem",
            fontSize: "0.58rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            background: sessionColor.bg,
            color: sessionColor.color,
            fontFamily: "'Jost', sans-serif",
            fontWeight: 500,
          }}
        >
          {inquiry.sessionType}
        </span>
        <LeadScoreBadge score={inquiry.leadScore} />
      </div>

      {/* Name */}
      <p
        style={{
          fontSize: "0.9rem",
          fontWeight: 500,
          color: "var(--charcoal)",
          marginBottom: "0.2rem",
          fontFamily: "'Jost', sans-serif",
        }}
      >
        {inquiry.firstName} {inquiry.lastName}
      </p>

      {/* Email */}
      <p style={{ fontSize: "0.72rem", color: "var(--charcoal-muted)", marginBottom: "0.6rem" }}>
        {inquiry.email}
      </p>

      {/* Date + estimated value */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
        {inquiry.preferredDate ? (
          <span style={{ fontSize: "0.65rem", color: "var(--charcoal-muted)", letterSpacing: "0.04em" }}>
            📅 {inquiry.preferredDate}
          </span>
        ) : (
          <span style={{ fontSize: "0.65rem", color: "var(--charcoal-muted)", fontStyle: "italic" }}>
            No date
          </span>
        )}
        {inquiry.estimatedValue ? (
          <span
            style={{
              fontSize: "0.65rem",
              color: "var(--olive)",
              fontWeight: 600,
              fontFamily: "'Jost', sans-serif",
            }}
          >
            ${inquiry.estimatedValue.toLocaleString()}
          </span>
        ) : null}
      </div>

      {/* Tags */}
      {inquiry.tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", marginTop: "0.55rem" }}>
          {inquiry.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              style={{
                padding: "0.15rem 0.45rem",
                fontSize: "0.58rem",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                background: "var(--charcoal)",
                color: "var(--white)",
                fontFamily: "'Jost', sans-serif",
              }}
            >
              {tag}
            </span>
          ))}
          {inquiry.tags.length > 3 && (
            <span style={{ fontSize: "0.6rem", color: "var(--charcoal-muted)", alignSelf: "center" }}>
              +{inquiry.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Communication count */}
      {inquiry.communicationLog.length > 0 && (
        <p style={{ marginTop: "0.55rem", fontSize: "0.6rem", color: "var(--charcoal-muted)" }}>
          💬 {inquiry.communicationLog.length} interaction{inquiry.communicationLog.length !== 1 ? "s" : ""}
        </p>
      )}

      <style>{`
        .kanban-card:hover {
          box-shadow: 0 4px 16px rgba(42,42,40,0.12);
          border-color: var(--border-strong);
        }
        .kanban-card:active { cursor: grabbing; opacity: 0.85; }
      `}</style>
    </div>
  );
}
