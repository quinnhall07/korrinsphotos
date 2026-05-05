"use client";

// app/admin/bookings/BookingTable.tsx
// Client component: renders the bookings table with row selection (for bulk
// actions) and opens the LeadDetailDrawer on row click.

import type { Inquiry } from "./page";
import type { KanbanInquiry } from "./KanbanCard";

const STATUS_COLORS: Record<string, React.CSSProperties> = {
  PENDING:       { background: "#FEF3C7", color: "#92400E" },
  QUALIFIED:     { background: "#E0E7FF", color: "#3730A3" },
  SENT_PROPOSAL: { background: "#DBEAFE", color: "#1D4ED8" },
  CONTRACT_SENT: { background: "#FED7AA", color: "#9A3412" },
  BOOKED:        { background: "#D1FAE5", color: "#065F46" },
  ARCHIVED:      { background: "rgba(42,42,40,0.06)", color: "var(--charcoal-muted)" },
};

interface BookingTableProps {
  inquiries: Inquiry[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onOpenDrawer: (inquiry: KanbanInquiry) => void;
}

export function BookingTable({
  inquiries,
  selectedIds,
  onSelectionChange,
  onOpenDrawer,
}: BookingTableProps) {
  const allSelected =
    inquiries.length > 0 && selectedIds.length === inquiries.length;

  function toggleAll() {
    onSelectionChange(allSelected ? [] : inquiries.map((i) => i.id));
  }

  function toggleOne(id: string) {
    onSelectionChange(
      selectedIds.includes(id)
        ? selectedIds.filter((s) => s !== id)
        : [...selectedIds, id]
    );
  }

  if (inquiries.length === 0) {
    return (
      <div
        style={{
          border: "0.5px solid var(--border)",
          background: "var(--white)",
          padding: "3rem",
          textAlign: "center",
        }}
      >
        <p style={{ color: "var(--charcoal-muted)", fontSize: "0.88rem" }}>
          No inquiries found.
        </p>
      </div>
    );
  }

  return (
    <div style={{ border: "0.5px solid var(--border)", background: "var(--white)" }}>
      <table
        style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}
      >
        <thead>
          <tr>
            {/* Select all */}
            <th style={{ ...thStyle, width: "40px", paddingLeft: "1rem" }}>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                style={{ cursor: "pointer" }}
                aria-label="Select all"
              />
            </th>
            {["Name", "Email", "Session", "Date", "Score", "Received", "Status", ""].map((h) => (
              <th key={h} style={thStyle}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {inquiries.map((inq) => {
            const isSelected = selectedIds.includes(inq.id);

            return (
              <tr
                key={inq.id}
                onClick={() => onOpenDrawer(inq as unknown as KanbanInquiry)}
                style={{
                  cursor: "pointer",
                  background: isSelected ? "rgba(107,120,69,0.06)" : "transparent",
                  transition: "background 0.15s",
                }}
              >
                {/* Checkbox */}
                <td
                  style={{ ...tdStyle, paddingLeft: "1rem", width: "40px" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleOne(inq.id)}
                    style={{ cursor: "pointer" }}
                    aria-label={`Select ${inq.firstName} ${inq.lastName}`}
                  />
                </td>

                <td style={tdStyle}>
                  <strong style={{ fontWeight: 500 }}>
                    {inq.firstName} {inq.lastName}
                  </strong>
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
                
                {/* Lead score badge */}
                <td style={tdStyle}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "0.15rem 0.5rem",
                      fontSize: "0.62rem",
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                      fontFamily: "'Jost', sans-serif",
                      background:
                        inq.leadScore >= 80
                          ? "#D1FAE5"
                          : inq.leadScore >= 60
                          ? "#FEF3C7"
                          : inq.leadScore >= 40
                          ? "#E8EBD8"
                          : "rgba(42,42,40,0.06)",
                      color:
                        inq.leadScore >= 80
                          ? "#059669"
                          : inq.leadScore >= 60
                          ? "#D97706"
                          : inq.leadScore >= 40
                          ? "#6B7845"
                          : "#8A8A85",
                    }}
                  >
                    {inq.leadScore}
                  </span>
                </td>
                
                <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                  {inq.createdAt}
                </td>
                
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
                    {inq.status.replace("_", " ")}
                  </span>
                </td>
                
                {/* Replaced Actions with a generic View button */}
                <td style={{ ...tdStyle, textAlign: "right", color: "var(--olive)", fontSize: "0.75rem" }}>
                  View →
                </td>
              </tr>
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