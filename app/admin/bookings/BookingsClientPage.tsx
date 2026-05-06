"use client";

// app/admin/bookings/BookingsClientPage.tsx
// Booking inquiries management — Kanban pipeline view.
// Smart filters, search, bulk actions, lead scoring, and expandable detail drawer.

import { useState, useMemo } from "react";
import { KanbanBoard } from "./KanbanBoard";
import { SmartFilters, applySmartFilter } from "./SmartFilters";
import { BulkActions } from "./BulkActions";
import { LeadDetailDrawer } from "./LeadDetailDrawer";
import { NewInquiryModal } from "./NewInquiryModal";
import type { SmartFilter } from "./SmartFilters";
import type { KanbanInquiry } from "./KanbanCard";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Inquiry = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  sessionType: string;
  preferredDate: string | null;
  message: string;
  notes: string;
  pricing: string;
  status: string;
  createdAt: string;
  lastRespondedAt: string | null;
  // Phase 1 CRM fields
  leadScore: number;
  tags: string[];
  leadSource: string | null;
  estimatedValue: number | null;
  followUpDate: string | null;
  lastContactedAt: string | null;
  communicationLog: {
    id: string;
    channel: string;
    summary: string;
    timestamp: string;
    adminUid: string;
  }[];
  // Event linking
  eventId?: string | null;
  eventName?: string | null;
};

// ─── Client Page Component ────────────────────────────────────────────────────

interface BookingsClientPageProps {
  inquiries: Inquiry[];
}

export function BookingsClientPage({ inquiries }: BookingsClientPageProps) {
  const [smartFilter, setSmartFilter] = useState<SmartFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drawerInquiry, setDrawerInquiry] = useState<KanbanInquiry | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);

  // Apply smart filter across all inquiries (client-side)
  const filtered = useMemo(() => {
    let result = applySmartFilter(inquiries as KanbanInquiry[], smartFilter);

    // Apply free-text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((i) => {
        const fullName = `${i.firstName} ${i.lastName}`.toLowerCase();
        const email = i.email.toLowerCase();
        return fullName.includes(q) || email.includes(q);
      });
    }

    return result;
  }, [inquiries, smartFilter, searchQuery]);

  // Smart filter counts
  const counts = useMemo(() => {
    const allFilters: SmartFilter[] = [
      "all", "hot-leads", "needs-follow-up", "high-value", "this-week", "weddings",
    ];
    return Object.fromEntries(
      allFilters.map((f) => [
        f,
        applySmartFilter(inquiries as KanbanInquiry[], f).length,
      ])
    ) as Record<SmartFilter, number>;
  }, [inquiries]);

  function handleOpenDrawer(inq: KanbanInquiry) {
    setDrawerInquiry(inq);
  }

  function handleClearSelection() {
    setSelectedIds([]);
  }

  return (
    <div className="page-fade-in">
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "1rem",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p
            style={{
              fontSize: "0.65rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--olive)",
              marginBottom: "0.3rem",
            }}
          >
            Clients
          </p>
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "2rem",
              fontWeight: 300,
            }}
          >
            Booking Inquiries
          </h2>
          <p
            style={{
              fontSize: "0.78rem",
              color: "var(--charcoal-muted)",
              marginTop: "0.25rem",
            }}
          >
            Drag cards between columns to update status.
          </p>
        </div>

        <button
          onClick={() => setShowNewModal(true)}
          style={{
            padding: "0.72rem 1.8rem",
            fontSize: "0.68rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            background: "var(--olive)",
            color: "var(--white)",
            border: "none",
            cursor: "pointer",
            fontFamily: "'Jost', sans-serif",
            transition: "background 0.15s",
            flexShrink: 0,
          }}
        >
          + New Inquiry
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: "0.5rem" }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name or email…"
          style={{
            width: "100%",
            maxWidth: "380px",
            border: "0.5px solid var(--border-strong)",
            background: "transparent",
            padding: "0.6rem 0.9rem",
            fontFamily: "'Jost', sans-serif",
            fontSize: "0.82rem",
            color: "var(--charcoal)",
            outline: "none",
            borderRadius: 0,
          }}
        />
      </div>

      {/* Smart filters */}
      <SmartFilters active={smartFilter} onChange={setSmartFilter} counts={counts} />

      {/* Kanban board */}
      <KanbanBoard
        inquiries={filtered as KanbanInquiry[]}
        onOpenDrawer={handleOpenDrawer}
      />

      {/* Bulk actions bar */}
      <BulkActions selectedIds={selectedIds} onClearSelection={handleClearSelection} />

      {/* Lead detail drawer */}
      <LeadDetailDrawer
        inquiry={drawerInquiry}
        onClose={() => setDrawerInquiry(null)}
      />

      {/* New inquiry modal */}
      {showNewModal && (
        <NewInquiryModal onClose={() => setShowNewModal(false)} />
      )}
    </div>
  );
}
