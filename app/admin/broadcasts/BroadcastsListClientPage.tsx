"use client";

// app/admin/broadcasts/BroadcastsListClientPage.tsx
// List view + "new broadcast" entry point for /admin/broadcasts.
// Server-only modules are never imported from this file.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toaster";
import { createNewBroadcast, removeBroadcast } from "./actions";

export type BroadcastStatusLiteral = "DRAFT" | "SCHEDULED" | "SENDING" | "SENT";

export interface SerializedBroadcastRow {
  id: string;
  name: string;
  subject: string;
  segmentId: string;
  status: BroadcastStatusLiteral;
  scheduledFor: string | null;
  sentAt: string | null;
  recipientCount: number | null;
  sentCount: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SerializedSegmentOption {
  id: string;
  name: string;
  lastResolvedCount: number | null;
}

interface Props {
  broadcasts: SerializedBroadcastRow[];
  segments: SerializedSegmentOption[];
}

export function BroadcastsListClientPage({ broadcasts, segments }: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="page-fade-in">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "2rem",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p style={eyebrow}>Marketing</p>
          <h2 style={pageTitle}>Broadcasts</h2>
          <p
            style={{
              fontSize: "0.78rem",
              color: "var(--charcoal-muted)",
              marginTop: "0.4rem",
              letterSpacing: "0.04em",
            }}
          >
            {broadcasts.length} broadcast{broadcasts.length === 1 ? "" : "s"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          disabled={segments.length === 0}
          style={segments.length === 0 ? btnDisabled : btnOlive}
          title={
            segments.length === 0
              ? "Create a segment first"
              : "Compose a new broadcast"
          }
        >
          + New broadcast
        </button>
      </div>

      {broadcasts.length === 0 ? (
        <EmptyState hasSegments={segments.length > 0} />
      ) : (
        <div
          style={{
            border: "0.5px solid var(--border)",
            background: "var(--white)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1.4fr) 7rem 7rem 6rem",
              gap: "1rem",
              padding: "0.9rem 1.25rem",
              borderBottom: "0.5px solid var(--border)",
              fontSize: "0.62rem",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--charcoal-muted)",
            }}
          >
            <span>Name</span>
            <span>Subject</span>
            <span>Status</span>
            <span>Sent</span>
            <span style={{ textAlign: "right" }}>&nbsp;</span>
          </div>

          {broadcasts.map((b, i) => (
            <BroadcastRow
              key={b.id}
              row={b}
              segments={segments}
              isLast={i === broadcasts.length - 1}
            />
          ))}
        </div>
      )}

      {modalOpen && (
        <NewBroadcastModal segments={segments} onClose={() => setModalOpen(false)} />
      )}
    </div>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function BroadcastRow({
  row,
  segments,
  isLast,
}: {
  row: SerializedBroadcastRow;
  segments: SerializedSegmentOption[];
  isLast: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const segmentName =
    segments.find((s) => s.id === row.segmentId)?.name ?? "(missing segment)";

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete broadcast "${row.name}"?`)) return;
    startTransition(async () => {
      const result = await removeBroadcast(row.id);
      if (result.success) {
        toast("Broadcast deleted");
        router.refresh();
      } else {
        toast(result.error);
      }
    });
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1.4fr) 7rem 7rem 6rem",
        gap: "1rem",
        padding: "1.1rem 1.25rem",
        borderBottom: isLast ? "none" : "0.5px solid var(--border)",
        alignItems: "center",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <Link
          href={`/admin/broadcasts/${row.id}`}
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "1.2rem",
            fontWeight: 300,
            color: "var(--charcoal)",
            textDecoration: "none",
            lineHeight: 1.3,
            display: "block",
          }}
        >
          {row.name}
        </Link>
        <p
          style={{
            fontSize: "0.7rem",
            color: "var(--charcoal-muted)",
            marginTop: "0.25rem",
            letterSpacing: "0.04em",
          }}
        >
          to: {segmentName}
        </p>
      </div>

      <p
        style={{
          fontSize: "0.82rem",
          color: "var(--charcoal-light)",
          lineHeight: 1.5,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {row.subject}
      </p>

      <StatusBadge status={row.status} />

      <div>
        <p
          style={{
            fontSize: "1.05rem",
            fontFamily: "'Cormorant Garamond', serif",
            color: "var(--charcoal)",
          }}
        >
          {row.sentCount ?? "—"}
        </p>
        {row.sentAt && (
          <p
            style={{
              fontSize: "0.62rem",
              color: "var(--charcoal-muted)",
              letterSpacing: "0.06em",
              marginTop: "0.2rem",
            }}
          >
            {formatShortDate(row.sentAt)}
          </p>
        )}
        {!row.sentAt && row.scheduledFor && (
          <p
            style={{
              fontSize: "0.62rem",
              color: "var(--charcoal-muted)",
              letterSpacing: "0.06em",
              marginTop: "0.2rem",
            }}
          >
            for {formatShortDate(row.scheduledFor)}
          </p>
        )}
      </div>

      <div
        style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}
      >
        <Link href={`/admin/broadcasts/${row.id}`} style={btnOutlineSm}>
          Open
        </Link>
        {row.status !== "SENT" && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            style={{ ...btnGhostSm, color: "#991B1B" }}
            title="Delete broadcast"
          >
            {isPending ? "…" : "×"}
          </button>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: BroadcastStatusLiteral }) {
  const palette: Record<BroadcastStatusLiteral, { bg: string; fg: string }> = {
    DRAFT: { bg: "rgba(42,42,40,0.06)", fg: "var(--charcoal-light)" },
    SCHEDULED: { bg: "rgba(245,158,11,0.12)", fg: "#92400E" },
    SENDING: { bg: "rgba(107,120,69,0.12)", fg: "var(--olive)" },
    SENT: { bg: "rgba(34,197,94,0.12)", fg: "#15803D" },
  };
  const c = palette[status];
  return (
    <span
      style={{
        fontSize: "0.62rem",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        background: c.bg,
        color: c.fg,
        padding: "0.35rem 0.55rem",
        display: "inline-block",
        fontFamily: "'Jost', sans-serif",
      }}
    >
      {status}
    </span>
  );
}

// ─── New broadcast modal ─────────────────────────────────────────────────────

function NewBroadcastModal({
  segments,
  onClose,
}: {
  segments: SerializedSegmentOption[];
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [segmentId, setSegmentId] = useState(segments[0]?.id ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast("Name is required");
      return;
    }
    if (!segmentId) {
      toast("Pick a segment");
      return;
    }
    startTransition(async () => {
      try {
        await createNewBroadcast(trimmed, segmentId);
      } catch (err) {
        if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) return;
        console.error(err);
        toast("Failed to create broadcast");
      }
    });
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(42,42,40,0.45)",
        zIndex: 8500,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "6rem 1.5rem",
        overflowY: "auto",
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        style={{
          background: "var(--white)",
          width: "100%",
          maxWidth: "32rem",
          padding: "2rem",
          border: "0.5px solid var(--border-strong)",
        }}
      >
        <p style={eyebrow}>Marketing</p>
        <h3
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "1.8rem",
            fontWeight: 300,
            marginBottom: "1.5rem",
            marginTop: "0.3rem",
          }}
        >
          New broadcast
        </h3>

        <label style={miniLabel}>Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Spring 2026 mini-session announcement"
          style={inputStyle}
          required
          autoFocus
        />

        <label style={{ ...miniLabel, marginTop: "1rem" }}>Segment</label>
        <select
          value={segmentId}
          onChange={(e) => setSegmentId(e.target.value)}
          style={inputStyle}
        >
          {segments.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {typeof s.lastResolvedCount === "number"
                ? ` (~${s.lastResolvedCount})`
                : ""}
            </option>
          ))}
        </select>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.75rem",
            marginTop: "1.5rem",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            style={btnOutline}
          >
            Cancel
          </button>
          <button type="submit" disabled={isPending} style={btnOlive}>
            {isPending ? "Creating…" : "Create broadcast"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ hasSegments }: { hasSegments: boolean }) {
  return (
    <div
      style={{
        padding: "4rem 2rem",
        textAlign: "center",
        border: "0.5px dashed var(--border-strong)",
        background: "var(--white)",
      }}
    >
      <p style={{ ...eyebrow, marginBottom: "0.8rem" }}>Empty</p>
      <p
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "1.3rem",
          fontWeight: 300,
          color: "var(--charcoal)",
          lineHeight: 1.4,
          maxWidth: "32rem",
          margin: "0 auto",
        }}
      >
        {hasSegments
          ? "No broadcasts yet. Compose a block-based update and send it to one of your segments."
          : "Build at least one segment first — broadcasts always target a saved segment."}
      </p>
      {!hasSegments && (
        <Link
          href="/admin/segments"
          style={{ ...btnOutline, display: "inline-block", marginTop: "1.5rem" }}
        >
          Go to segments
        </Link>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const eyebrow: React.CSSProperties = {
  fontSize: "0.65rem",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "var(--olive)",
  marginBottom: "0.3rem",
};

const pageTitle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: "2rem",
  fontWeight: 300,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.7rem 0.9rem",
  fontSize: "0.85rem",
  border: "0.5px solid var(--border)",
  background: "var(--white)",
  color: "var(--charcoal)",
  fontFamily: "'Jost', sans-serif",
  outline: "none",
};

const miniLabel: React.CSSProperties = {
  display: "block",
  fontSize: "0.65rem",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--charcoal-muted)",
  marginBottom: "0.4rem",
};

const btnOlive: React.CSSProperties = {
  padding: "0.85rem 2.2rem",
  fontSize: "0.72rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  background: "var(--olive)",
  color: "var(--white)",
  border: "none",
  cursor: "pointer",
  fontFamily: "'Jost', sans-serif",
};

const btnDisabled: React.CSSProperties = {
  ...btnOlive,
  background: "rgba(42,42,40,0.12)",
  color: "var(--charcoal-muted)",
  cursor: "not-allowed",
};

const btnOutline: React.CSSProperties = {
  padding: "0.85rem 1.6rem",
  fontSize: "0.72rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  background: "none",
  color: "var(--charcoal)",
  border: "0.5px solid var(--border-strong)",
  cursor: "pointer",
  fontFamily: "'Jost', sans-serif",
  textDecoration: "none",
};

const btnOutlineSm: React.CSSProperties = {
  padding: "0.55rem 1rem",
  fontSize: "0.66rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  background: "none",
  color: "var(--charcoal)",
  border: "0.5px solid var(--border-strong)",
  cursor: "pointer",
  fontFamily: "'Jost', sans-serif",
  textDecoration: "none",
};

const btnGhostSm: React.CSSProperties = {
  padding: "0.4rem 0.7rem",
  fontSize: "1rem",
  background: "none",
  border: "0.5px solid var(--border)",
  cursor: "pointer",
  fontFamily: "'Jost', sans-serif",
  lineHeight: 1,
};
