"use client";

// app/admin/bookings/page.tsx
// Booking inquiries management — Kanban pipeline + Table view.
// Smart filters, bulk actions, lead scoring, and expandable detail drawer.

import { useState, useEffect, useMemo } from "react";
import { ViewToggle } from "./ViewToggle";
import { BookingTable } from "./BookingTable";
import { KanbanBoard } from "./KanbanBoard";
import { SmartFilters, applySmartFilter } from "./SmartFilters";
import { BulkActions } from "./BulkActions";
import { LeadDetailDrawer } from "./LeadDetailDrawer";
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
};

type View = "kanban" | "table";

// ─── Client Page Component ────────────────────────────────────────────────────

interface BookingsClientPageProps {
  inquiries: Inquiry[];
}

export function BookingsClientPage({ inquiries }: BookingsClientPageProps) {
  const [view, setView] = useState<View>("kanban");
  const [smartFilter, setSmartFilter] = useState<SmartFilter>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drawerInquiry, setDrawerInquiry] = useState<KanbanInquiry | null>(null);

  // Persist view preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem("bookings_view") as View | null;
      if (saved === "kanban" || saved === "table") setView(saved);
    } catch {}
  }, []);

  // Apply smart filter across all inquiries (client-side)
  const filtered = useMemo(
    () => applySmartFilter(inquiries as KanbanInquiry[], smartFilter),
    [inquiries, smartFilter]
  );

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
            {view === "kanban"
              ? "Drag cards between columns to update status."
              : "Click any row to expand notes, pricing, and email tools."}
          </p>
        </div>

        <ViewToggle value={view} onChange={setView} />
      </div>

      {/* Smart filters */}
      <SmartFilters active={smartFilter} onChange={setSmartFilter} counts={counts} />

      {/* Main content */}
      {view === "kanban" ? (
        <KanbanBoard
          inquiries={filtered as KanbanInquiry[]}
          onOpenDrawer={handleOpenDrawer}
        />
      ) : (
        <BookingTable
          inquiries={filtered as Inquiry[]}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onOpenDrawer={handleOpenDrawer}
        />
      )}

      {/* Bulk actions bar */}
      <BulkActions selectedIds={selectedIds} onClearSelection={handleClearSelection} />

      {/* Lead detail drawer */}
      <LeadDetailDrawer
        inquiry={drawerInquiry}
        onClose={() => setDrawerInquiry(null)}
      />
    </div>
  );
}