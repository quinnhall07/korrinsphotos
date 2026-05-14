"use client";

// app/admin/sequences/SequencesListClientPage.tsx
// List view + active toggle for /admin/sequences. Server-only modules are
// never imported from here — types are mirrored locally.

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toaster";
import { toggleSequenceActiveAction } from "./actions";

type TriggerLiteral =
  | "MANUAL"
  | "STATUS_CHANGE"
  | "DATE_RELATIVE_TO_SHOOT"
  | "BOOKING_CREATED"
  | "GALLERY_DELIVERED";

export interface SerializedSequenceRow {
  id: string;
  name: string;
  description: string | null;
  trigger: TriggerLiteral;
  triggerStatus: string | null;
  dateAnchor: "shootDate" | "deliveredAt" | null;
  active: boolean;
  stepCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  sequences: SerializedSequenceRow[];
}

export function SequencesListClientPage({ sequences }: Props) {
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
          <p style={eyebrow}>Sequence Engine</p>
          <h2 style={pageTitle}>Sequences</h2>
          <p
            style={{
              fontSize: "0.78rem",
              color: "var(--charcoal-muted)",
              marginTop: "0.4rem",
              letterSpacing: "0.04em",
            }}
          >
            {sequences.length} sequence{sequences.length === 1 ? "" : "s"}
          </p>
        </div>

        <Link href="/admin/sequences/new" style={btnOlive}>
          + New sequence
        </Link>
      </div>

      {sequences.length === 0 ? (
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
              gridTemplateColumns:
                "minmax(0, 1.6fr) minmax(0, 1.4fr) 5rem 6rem 6rem",
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
            <span>Trigger</span>
            <span>Steps</span>
            <span>Active</span>
            <span style={{ textAlign: "right" }}>&nbsp;</span>
          </div>

          {sequences.map((s, i) => (
            <SequenceRow
              key={s.id}
              sequence={s}
              isLast={i === sequences.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function SequenceRow({
  sequence,
  isLast,
}: {
  sequence: SerializedSequenceRow;
  isLast: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleToggle(next: boolean) {
    startTransition(async () => {
      const result = await toggleSequenceActiveAction(sequence.id, next);
      if (result.success) {
        toast(next ? "Sequence activated" : "Sequence deactivated");
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
        gridTemplateColumns:
          "minmax(0, 1.6fr) minmax(0, 1.4fr) 5rem 6rem 6rem",
        gap: "1rem",
        padding: "1.1rem 1.25rem",
        borderBottom: isLast ? "none" : "0.5px solid var(--border)",
        alignItems: "center",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <Link
          href={`/admin/sequences/${sequence.id}`}
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
          {sequence.name}
        </Link>
        {sequence.description && (
          <p
            style={{
              fontSize: "0.78rem",
              color: "var(--charcoal-muted)",
              marginTop: "0.3rem",
              lineHeight: 1.4,
            }}
          >
            {sequence.description}
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
        {summariseTrigger(sequence)}
      </p>

      <p
        style={{
          fontSize: "1.05rem",
          fontFamily: "'Cormorant Garamond', serif",
          color: "var(--charcoal)",
        }}
      >
        {sequence.stepCount}
      </p>

      <button
        type="button"
        onClick={() => handleToggle(!sequence.active)}
        disabled={isPending}
        style={sequence.active ? toggleActiveOn : toggleActiveOff}
        aria-label={sequence.active ? "Deactivate" : "Activate"}
      >
        {isPending ? "…" : sequence.active ? "Active" : "Off"}
      </button>

      <div
        style={{
          display: "flex",
          gap: "0.4rem",
          justifyContent: "flex-end",
        }}
      >
        <Link href={`/admin/sequences/${sequence.id}`} style={btnOutlineSm}>
          Edit
        </Link>
      </div>
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
        No sequences yet. Build one — sequences auto-enroll clients into
        scheduled email or SMS cadences.
      </p>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function summariseTrigger(s: SerializedSequenceRow): string {
  switch (s.trigger) {
    case "STATUS_CHANGE":
      return `STATUS_CHANGE → ${s.triggerStatus ?? "—"}`;
    case "DATE_RELATIVE_TO_SHOOT":
      return `DATE_RELATIVE_TO_SHOOT (${s.dateAnchor ?? "shootDate"})`;
    case "MANUAL":
      return "MANUAL";
    case "BOOKING_CREATED":
      return "BOOKING_CREATED";
    case "GALLERY_DELIVERED":
      return "GALLERY_DELIVERED";
    default:
      return s.trigger;
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
  textDecoration: "none",
  display: "inline-block",
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

const toggleBase: React.CSSProperties = {
  padding: "0.45rem 0.75rem",
  fontSize: "0.66rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  cursor: "pointer",
  fontFamily: "'Jost', sans-serif",
  border: "0.5px solid var(--border-strong)",
  minWidth: "4.5rem",
};

const toggleActiveOn: React.CSSProperties = {
  ...toggleBase,
  background: "var(--olive)",
  color: "var(--white)",
  borderColor: "var(--olive)",
};

const toggleActiveOff: React.CSSProperties = {
  ...toggleBase,
  background: "var(--white)",
  color: "var(--charcoal-muted)",
};
