"use client";

// app/admin/bookings/BookingTable.tsx
// Client component: renders the bookings table with expandable detail rows.
// Each row can be clicked to show BookingDetailPanel below it.

import { useState } from "react";
import { BookingActions } from "./BookingActions";
import { BookingDetailPanel } from "./BookingDetailPanel";
import type { Inquiry } from "./page";

const STATUS_COLORS: Record<string, React.CSSProperties> = {
  PENDING: { background: "#FEF3C7", color: "#92400E" },
  REVIEWED: { background: "var(--olive-dim)", color: "var(--olive)" },
  BOOKED: { background: "#D1FAE5", color: "#065F46" },
  ARCHIVED: { background: "rgba(42,42,40,0.06)", color: "var(--charcoal-muted)" },
};

interface BookingTableProps {
  inquiries: Inquiry[];
}

export function BookingTable({ inquiries }: BookingTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggleRow(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  if (inquiries.length === 0) {
    return (
      <div style={{ border: "0.5px solid var(--border)", background: "var(--white)", padding: "3rem", textAlign: "center" }}>
        <p style={{ color: "var(--charcoal-muted)", fontSize: "0.88rem" }}>
          No inquiries found.
        </p>
      </div>
    );
  }

  return (
    <div style={{ border: "0.5px solid var(--border)", background: "var(--white)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
        <thead>
          <tr>
            {["", "Name", "Email", "Session", "Date", "Received", "Status", ""].map((h, i) => (
              <th key={i} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {inquiries.map((inq) => {
            const isExpanded = expandedId === inq.id;
            return (
              <>
                {/* Main row */}
                <tr
                  key={inq.id}
                  onClick={() => toggleRow(inq.id)}
                  style={{
                    cursor: "pointer",
                    background: isExpanded ? "rgba(107,120,69,0.04)" : "transparent",
                    transition: "background 0.15s",
                  }}
                >
                  {/* Expand chevron */}
                  <td style={{ ...tdStyle, width: "36px", paddingRight: 0 }}>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      style={{
                        transition: "transform 0.2s",
                        transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                        color: "var(--charcoal-muted)",
                      }}
                    >
                      <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </td>
                  <td style={tdStyle}>
                    <strong style={{ fontWeight: 500 }}>{inq.firstName} {inq.lastName}</strong>
                    {inq.notes && (
                      <span
                        title="Has notes"
                        style={{ marginLeft: "0.4rem", fontSize: "0.65rem", color: "var(--olive)" }}
                      >
                        ●
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}>{inq.email}</td>
                  <td style={tdStyle}>{inq.sessionType}</td>
                  <td style={tdStyle}>{inq.preferredDate ?? "—"}</td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{inq.createdAt}</td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "0.25rem 0.65rem",
                        fontSize: "0.62rem",
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        ...(STATUS_COLORS[inq.status] ?? {}),
                      }}
                    >
                      {inq.status}
                    </span>
                  </td>
                  <td
                    style={tdStyle}
                    onClick={(e) => e.stopPropagation()} // Don't toggle on action button click
                  >
                    <BookingActions id={inq.id} currentStatus={inq.status} />
                  </td>
                </tr>

                {/* Expanded detail panel */}
                {isExpanded && (
                  <tr key={`${inq.id}-detail`}>
                    <td colSpan={8} style={{ padding: 0, borderBottom: "0.5px solid var(--border)" }}>
                      <BookingDetailPanel
                        id={inq.id}
                        firstName={inq.firstName}
                        email={inq.email}
                        sessionType={inq.sessionType}
                        message={inq.message}
                        notes={inq.notes}
                        pricing={inq.pricing}
                        status={inq.status}
                        lastRespondedAt={inq.lastRespondedAt}
                      />
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
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