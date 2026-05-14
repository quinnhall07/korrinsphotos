"use client";

// app/admin/segments/SegmentsClientPage.tsx
// List view + "new segment" entry point for /admin/segments.
// Server-only modules are never imported from this file.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toaster";
import { createNewSegment, removeSegment } from "./actions";

// ─── Re-declared local types (server boundary) ───────────────────────────────

type ProjectStatusLiteral =
  | "SITE_VISIT"
  | "INQUIRY"
  | "QUALIFYING"
  | "PROPOSAL_SENT"
  | "NEGOTIATING"
  | "CONTRACT_SENT"
  | "DEPOSIT_PENDING"
  | "BOOKED"
  | "SHOOT_READY"
  | "IN_EDITING"
  | "GALLERY_DELIVERED"
  | "REFERRAL_SENT"
  | "COMPLETED"
  | "LOST"
  | "ARCHIVED";

export interface LocalSegmentPredicate {
  projectStatus?: ProjectStatusLiteral[];
  sessionType?: string[];
  tagsInclude?: string[];
  tagsExclude?: string[];
  leadScoreMin?: number;
  leadScoreMax?: number;
  leadSource?: string[];
  totalSessionsBookedMin?: number;
  firstTouchSource?: string[];
  deliveredAfter?: string;
  deliveredBefore?: string;
  hasReferred?: boolean;
}

export interface SerializedSegment {
  id: string;
  name: string;
  description: string | null;
  predicate: LocalSegmentPredicate;
  lastResolvedCount: number | null;
  lastResolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  segments: SerializedSegment[];
}

export function SegmentsClientPage({ segments }: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="page-fade-in">
      {/* Header */}
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
          <p style={eyebrow}>Audience Engine</p>
          <h2 style={pageTitle}>Segments</h2>
          <p
            style={{
              fontSize: "0.78rem",
              color: "var(--charcoal-muted)",
              marginTop: "0.4rem",
              letterSpacing: "0.04em",
            }}
          >
            {segments.length} saved segment{segments.length === 1 ? "" : "s"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          style={btnOlive}
        >
          + New segment
        </button>
      </div>

      {segments.length === 0 ? (
        <EmptyState />
      ) : (
        <div
          style={{
            border: "0.5px solid var(--border)",
            background: "var(--white)",
          }}
        >
          {/* Table header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 2fr) 8rem 7rem",
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
            <span>Predicate</span>
            <span>Last count</span>
            <span style={{ textAlign: "right" }}>&nbsp;</span>
          </div>

          {segments.map((s, i) => (
            <SegmentRow
              key={s.id}
              segment={s}
              isLast={i === segments.length - 1}
            />
          ))}
        </div>
      )}

      {modalOpen && <NewSegmentModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function SegmentRow({
  segment,
  isLast,
}: {
  segment: SerializedSegment;
  isLast: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete segment "${segment.name}"?`)) return;

    startTransition(async () => {
      const result = await removeSegment(segment.id);
      if (result.success) {
        toast("Segment deleted");
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
        gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 2fr) 8rem 7rem",
        gap: "1rem",
        padding: "1.1rem 1.25rem",
        borderBottom: isLast ? "none" : "0.5px solid var(--border)",
        alignItems: "center",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <Link
          href={`/admin/segments/${segment.id}`}
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
          {segment.name}
        </Link>
        {segment.description && (
          <p
            style={{
              fontSize: "0.78rem",
              color: "var(--charcoal-muted)",
              marginTop: "0.3rem",
              lineHeight: 1.4,
            }}
          >
            {segment.description}
          </p>
        )}
      </div>

      <p
        style={{
          fontSize: "0.78rem",
          color: "var(--charcoal-light)",
          lineHeight: 1.5,
          minWidth: 0,
        }}
      >
        {summarisePredicate(segment.predicate)}
      </p>

      <div>
        <p
          style={{
            fontSize: "1.1rem",
            fontFamily: "'Cormorant Garamond', serif",
            color: "var(--charcoal)",
          }}
        >
          {segment.lastResolvedCount ?? "—"}
        </p>
        {segment.lastResolvedAt && (
          <p
            style={{
              fontSize: "0.62rem",
              color: "var(--charcoal-muted)",
              letterSpacing: "0.06em",
              marginTop: "0.2rem",
            }}
          >
            {formatShortDate(segment.lastResolvedAt)}
          </p>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: "0.4rem",
          justifyContent: "flex-end",
        }}
      >
        <Link href={`/admin/segments/${segment.id}`} style={btnOutlineSm}>
          Open
        </Link>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          style={{ ...btnGhostSm, color: "#991B1B" }}
          title="Delete segment"
        >
          {isPending ? "…" : "×"}
        </button>
      </div>
    </div>
  );
}

// ─── New segment modal ───────────────────────────────────────────────────────

function NewSegmentModal({ onClose }: { onClose: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast("Name is required");
      return;
    }
    startTransition(async () => {
      // Server action redirects on success — we never return here on the
      // happy path.
      try {
        await createNewSegment(trimmed);
      } catch (err) {
        // redirect() throws a NEXT_REDIRECT signal; ignore it.
        if (
          err instanceof Error &&
          err.message.includes("NEXT_REDIRECT")
        ) {
          return;
        }
        console.error(err);
        toast("Failed to create segment");
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
          maxWidth: "30rem",
          padding: "2rem",
          border: "0.5px solid var(--border-strong)",
        }}
      >
        <p style={eyebrow}>Audience Engine</p>
        <h3
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "1.8rem",
            fontWeight: 300,
            marginBottom: "1.5rem",
            marginTop: "0.3rem",
          }}
        >
          New segment
        </h3>

        <label
          style={{
            display: "block",
            fontSize: "0.65rem",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--charcoal-muted)",
            marginBottom: "0.4rem",
          }}
        >
          Name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Past clients — 12+ months"
          style={inputStyle}
          required
          autoFocus
        />

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
            {isPending ? "Creating…" : "Create segment"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState() {
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
        No segments saved yet. Build one — saved predicates power every
        broadcast, every drip campaign, every targeted offer.
      </p>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function summarisePredicate(p: LocalSegmentPredicate): string {
  const bits: string[] = [];
  if (p.projectStatus?.length) bits.push(`status: ${p.projectStatus.join(", ")}`);
  if (p.sessionType?.length) bits.push(`session: ${p.sessionType.join(", ")}`);
  if (p.tagsInclude?.length) bits.push(`tags include: ${p.tagsInclude.join(", ")}`);
  if (p.tagsExclude?.length) bits.push(`tags exclude: ${p.tagsExclude.join(", ")}`);
  if (typeof p.leadScoreMin === "number") bits.push(`score ≥ ${p.leadScoreMin}`);
  if (typeof p.leadScoreMax === "number") bits.push(`score ≤ ${p.leadScoreMax}`);
  if (p.leadSource?.length) bits.push(`source: ${p.leadSource.join(", ")}`);
  if (typeof p.totalSessionsBookedMin === "number") {
    bits.push(`sessions ≥ ${p.totalSessionsBookedMin}`);
  }
  if (p.firstTouchSource?.length) bits.push(`first touch: ${p.firstTouchSource.join(", ")}`);
  if (p.deliveredAfter) bits.push(`delivered after ${p.deliveredAfter}`);
  if (p.deliveredBefore) bits.push(`delivered before ${p.deliveredBefore}`);
  if (typeof p.hasReferred === "boolean") {
    bits.push(p.hasReferred ? "has referred" : "no referrals");
  }
  return bits.length ? bits.join(" · ") : "Matches everyone";
}

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
