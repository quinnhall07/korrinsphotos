"use client";

// app/admin/reports/compliance/ComplianceDashboardClient.tsx
// Phase 3.10 — Four-section compliance dashboard:
//   1. Signed model releases / contracts (booked-but-unsigned spotlight)
//   2. COI status (defensive: zeros if sibling agent B1 hasn't shipped)
//   3. GDPR / CCPA data requests (with "Log new request" modal)
//   4. Sales-tax filings (defensive: muted if sibling agent B3 hasn't shipped)

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "@/components/ui/Toaster";
import {
  createDataRequestAction,
  updateDataRequestStatusAction,
} from "./actions";
import type { SerializedComplianceSnapshot, SerializedDataRequest } from "./page";
import type { DataRequestStatus, DataRequestType } from "@/lib/db/data-requests";

const DATA_REQUEST_TYPE_LABELS: Record<DataRequestType, string> = {
  DELETE: "Right to erasure",
  ACCESS: "Right of access",
  PORTABILITY: "Right to portability",
};

const COI_STATUS_LABELS: Record<string, string> = {
  NONE: "Not requested",
  REQUESTED: "Requested",
  RECEIVED: "Received",
  EXPIRED: "Expired",
};

// ─── Shared subcomponents ─────────────────────────────────────────────────────

function SectionCard({
  eyebrow,
  title,
  children,
  action,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section
      style={{
        border: "0.5px solid var(--border)",
        background: "var(--white)",
        marginBottom: "2rem",
      }}
    >
      <header
        style={{
          padding: "1.1rem 1.4rem",
          borderBottom: "0.5px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p
            style={{
              fontSize: "0.6rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--olive)",
              margin: 0,
            }}
          >
            {eyebrow}
          </p>
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontWeight: 300,
              fontSize: "1.7rem",
              margin: "0.15rem 0 0",
              color: "var(--charcoal)",
            }}
          >
            {title}
          </h2>
        </div>
        {action}
      </header>
      <div style={{ padding: "1.25rem 1.4rem" }}>{children}</div>
    </section>
  );
}

function KpiStrip({
  tiles,
}: {
  tiles: { label: string; value: string; accent?: "warn" | "ok" }[];
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${tiles.length}, 1fr)`,
        gap: "1px",
        background: "var(--border)",
        border: "0.5px solid var(--border)",
        marginBottom: "1.25rem",
      }}
    >
      {tiles.map((t) => (
        <div
          key={t.label}
          style={{
            padding: "0.9rem 1.1rem",
            background: "var(--white)",
            minHeight: 78,
            display: "flex",
            flexDirection: "column",
            gap: "0.35rem",
          }}
        >
          <p
            style={{
              fontSize: "0.58rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--charcoal-muted)",
              margin: 0,
            }}
          >
            {t.label}
          </p>
          <p
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontWeight: 400,
              fontSize: "1.6rem",
              margin: 0,
              lineHeight: 1.1,
              color:
                t.accent === "warn"
                  ? "#B45309"
                  : t.accent === "ok"
                  ? "var(--olive)"
                  : "var(--charcoal)",
            }}
          >
            {t.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function MutedEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: "0.82rem",
        color: "var(--charcoal-muted)",
        padding: "0.75rem 0",
        fontStyle: "italic",
      }}
    >
      {children}
    </p>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

// ─── New data-request modal ───────────────────────────────────────────────────

function NewDataRequestModal({
  open,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [type, setType] = useState<DataRequestType>("DELETE");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(42,42,40,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--white)",
          border: "0.5px solid var(--border)",
          padding: "1.75rem",
          width: "min(520px, 92vw)",
        }}
      >
        <p
          style={{
            fontSize: "0.6rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--olive)",
            margin: 0,
          }}
        >
          Log new request
        </p>
        <h3
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontWeight: 300,
            fontSize: "1.8rem",
            margin: "0.15rem 0 1.2rem",
          }}
        >
          Data subject request
        </h3>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const res = await createDataRequestAction({
                type,
                subjectEmail: email,
                notes: notes || undefined,
              });
              if (res.success) {
                toast("Data request logged");
                setEmail("");
                setNotes("");
                setType("DELETE");
                onSubmitted();
                onClose();
              } else {
                toast(res.error || "Failed to log request");
              }
            });
          }}
        >
          <Field label="Type">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DataRequestType)}
              style={selectStyle}
            >
              <option value="DELETE">{DATA_REQUEST_TYPE_LABELS.DELETE}</option>
              <option value="ACCESS">{DATA_REQUEST_TYPE_LABELS.ACCESS}</option>
              <option value="PORTABILITY">{DATA_REQUEST_TYPE_LABELS.PORTABILITY}</option>
            </select>
          </Field>

          <Field label="Subject email">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@example.com"
              style={inputStyle}
            />
          </Field>

          <Field label="Notes (optional)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </Field>

          <p style={{ fontSize: "0.7rem", color: "var(--charcoal-muted)", marginTop: "0.5rem" }}>
            Fulfilment deadline: 30 days from today.
          </p>

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} style={btnGhost} disabled={pending}>
              Cancel
            </button>
            <button type="submit" style={btnPrimary} disabled={pending}>
              {pending ? "Logging…" : "Log request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: "0.9rem" }}>
      <span
        style={{
          display: "block",
          fontSize: "0.65rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--charcoal-muted)",
          marginBottom: "0.35rem",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.55rem 0.7rem",
  fontSize: "0.88rem",
  fontFamily: "'Jost', sans-serif",
  background: "var(--white)",
  border: "0.5px solid var(--border-strong)",
  color: "var(--charcoal)",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "auto",
};

const btnPrimary: React.CSSProperties = {
  background: "var(--charcoal)",
  color: "var(--white)",
  fontSize: "0.75rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  padding: "0.6rem 1.1rem",
  border: "0.5px solid var(--charcoal)",
  cursor: "pointer",
};

const btnGhost: React.CSSProperties = {
  background: "transparent",
  color: "var(--charcoal)",
  fontSize: "0.75rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  padding: "0.6rem 1.1rem",
  border: "0.5px solid var(--border-strong)",
  cursor: "pointer",
};

// ─── Data-request row with quick-status actions ───────────────────────────────

function DataRequestRow({
  req,
  onChanged,
}: {
  req: SerializedDataRequest;
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const overdue = daysUntil(req.dueBy) < 0;

  function changeStatus(next: DataRequestStatus) {
    startTransition(async () => {
      const res = await updateDataRequestStatusAction(req.id, next);
      if (res.success) {
        toast(`Marked ${next.toLowerCase().replace("_", " ")}`);
        onChanged();
      } else {
        toast(res.error || "Failed to update");
      }
    });
  }

  return (
    <tr style={{ borderBottom: "0.5px solid var(--border)" }}>
      <td style={cell}>{DATA_REQUEST_TYPE_LABELS[req.type]}</td>
      <td style={cell}>{req.subjectEmail}</td>
      <td style={cell}>{formatDate(req.submittedAt)}</td>
      <td style={{ ...cell, color: overdue ? "#B45309" : "var(--charcoal-light)" }}>
        {formatDate(req.dueBy)} {overdue ? `(${Math.abs(daysUntil(req.dueBy))}d overdue)` : ""}
      </td>
      <td style={cell}>{req.status.replace("_", " ")}</td>
      <td style={{ ...cell, textAlign: "right" }}>
        <div style={{ display: "inline-flex", gap: "0.35rem" }}>
          {req.status !== "IN_PROGRESS" && req.status !== "FULFILLED" && (
            <button
              type="button"
              onClick={() => changeStatus("IN_PROGRESS")}
              disabled={pending}
              style={btnTiny}
            >
              Start
            </button>
          )}
          {req.status !== "FULFILLED" && (
            <button
              type="button"
              onClick={() => changeStatus("FULFILLED")}
              disabled={pending}
              style={btnTiny}
            >
              Fulfill
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

const cell: React.CSSProperties = {
  padding: "0.6rem 0.4rem",
  fontSize: "0.82rem",
  color: "var(--charcoal-light)",
  verticalAlign: "top",
};

const headerCell: React.CSSProperties = {
  padding: "0.5rem 0.4rem",
  fontSize: "0.6rem",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--charcoal-muted)",
  textAlign: "left",
  borderBottom: "0.5px solid var(--border-strong)",
  fontWeight: 400,
};

const btnTiny: React.CSSProperties = {
  background: "transparent",
  color: "var(--charcoal)",
  fontSize: "0.65rem",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  padding: "0.3rem 0.6rem",
  border: "0.5px solid var(--border-strong)",
  cursor: "pointer",
};

// ─── Main ────────────────────────────────────────────────────────────────────

interface Props {
  snapshot: SerializedComplianceSnapshot;
}

export function ComplianceDashboardClient({ snapshot }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();
  const { contracts, coi, dataRequests, salesTax } = snapshot;
  const hasSalesTax =
    salesTax.filingsDueThisQuarter > 0 ||
    salesTax.filingsOverdue > 0 ||
    salesTax.nextFilingDueAt !== null;

  return (
    <div className="page-fade-in" style={{ padding: "2rem", maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <p
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--olive)",
            marginBottom: "0.25rem",
          }}
        >
          Reports
        </p>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontWeight: 300,
            fontSize: "2.4rem",
            margin: 0,
            color: "var(--charcoal)",
          }}
        >
          Compliance
        </h1>
        <p
          style={{
            fontSize: "0.78rem",
            color: "var(--charcoal-muted)",
            marginTop: "0.5rem",
            maxWidth: 720,
          }}
        >
          Signed contracts, certificates of insurance, GDPR/CCPA data-subject requests, and sales-tax filings.
        </p>
      </div>

      {/* 1. Contracts ------------------------------------------------------ */}
      <SectionCard eyebrow="Section 1" title="Contracts & model releases">
        <KpiStrip
          tiles={[
            { label: "Signed", value: String(contracts.totalSigned), accent: "ok" },
            { label: "Pending signature", value: String(contracts.pendingSignature) },
            {
              label: "Booked w/o signed",
              value: String(contracts.bookedWithoutSignedContract),
              accent: contracts.bookedWithoutSignedContract > 0 ? "warn" : undefined,
            },
          ]}
        />
        {contracts.bookedWithoutSignedContractProjects.length === 0 ? (
          <MutedEmpty>Every booked project has a signed contract on file.</MutedEmpty>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={headerCell}>Project</th>
                <th style={headerCell}>Shoot date</th>
                <th style={{ ...headerCell, textAlign: "right" }}>Open</th>
              </tr>
            </thead>
            <tbody>
              {contracts.bookedWithoutSignedContractProjects.map((p) => (
                <tr key={p.id} style={{ borderBottom: "0.5px solid var(--border)" }}>
                  <td style={cell}>{p.title}</td>
                  <td style={cell}>{formatDate(p.shootDate)}</td>
                  <td style={{ ...cell, textAlign: "right" }}>
                    <Link
                      href={`/admin/projects/${p.id}`}
                      style={{
                        fontSize: "0.7rem",
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "var(--olive)",
                        textDecoration: "none",
                      }}
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      {/* 2. COI ------------------------------------------------------------ */}
      <SectionCard eyebrow="Section 2" title="Certificates of insurance">
        <KpiStrip
          tiles={[
            { label: "Required", value: String(coi.required) },
            { label: "Received", value: String(coi.received), accent: "ok" },
            {
              label: "Outstanding",
              value: String(coi.outstanding),
              accent: coi.outstanding > 0 ? "warn" : undefined,
            },
          ]}
        />
        {coi.required === 0 ? (
          <MutedEmpty>
            No projects currently require a COI. Mark a project&apos;s <code>coiRequired</code> field on the project detail page to track venue insurance.
          </MutedEmpty>
        ) : coi.outstandingProjects.length === 0 ? (
          <MutedEmpty>All required certificates of insurance are on file.</MutedEmpty>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={headerCell}>Project</th>
                <th style={headerCell}>Shoot date</th>
                <th style={headerCell}>COI status</th>
                <th style={{ ...headerCell, textAlign: "right" }}>Open</th>
              </tr>
            </thead>
            <tbody>
              {coi.outstandingProjects.map((p) => (
                <tr key={p.id} style={{ borderBottom: "0.5px solid var(--border)" }}>
                  <td style={cell}>{p.title}</td>
                  <td style={cell}>{formatDate(p.shootDate)}</td>
                  <td style={cell}>{COI_STATUS_LABELS[p.coiStatus] ?? p.coiStatus}</td>
                  <td style={{ ...cell, textAlign: "right" }}>
                    <Link
                      href={`/admin/projects/${p.id}`}
                      style={{
                        fontSize: "0.7rem",
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "var(--olive)",
                        textDecoration: "none",
                      }}
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      {/* 3. Data Requests ------------------------------------------------- */}
      <SectionCard
        eyebrow="Section 3"
        title="Data subject requests"
        action={
          <button type="button" onClick={() => setModalOpen(true)} style={btnPrimary}>
            Log new request
          </button>
        }
      >
        <KpiStrip
          tiles={[
            { label: "Open", value: String(dataRequests.open) },
            {
              label: "Overdue",
              value: String(dataRequests.overdueCount),
              accent: dataRequests.overdueCount > 0 ? "warn" : "ok",
            },
            { label: "This year", value: String(dataRequests.totalThisYear) },
          ]}
        />
        {dataRequests.overdueRequests.length === 0 ? (
          <MutedEmpty>No overdue data requests. Standard fulfilment window is 30 days.</MutedEmpty>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={headerCell}>Type</th>
                <th style={headerCell}>Email</th>
                <th style={headerCell}>Submitted</th>
                <th style={headerCell}>Due by</th>
                <th style={headerCell}>Status</th>
                <th style={{ ...headerCell, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {dataRequests.overdueRequests.map((r) => (
                <DataRequestRow key={r.id} req={r} onChanged={() => router.refresh()} />
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      {/* 4. Sales tax ----------------------------------------------------- */}
      <SectionCard eyebrow="Section 4" title="Sales-tax filings">
        <KpiStrip
          tiles={[
            { label: "Due this quarter", value: String(salesTax.filingsDueThisQuarter) },
            {
              label: "Overdue",
              value: String(salesTax.filingsOverdue),
              accent: salesTax.filingsOverdue > 0 ? "warn" : "ok",
            },
            {
              label: "Next due",
              value: salesTax.nextFilingDueAt ? formatDate(salesTax.nextFilingDueAt) : "—",
            },
          ]}
        />
        {hasSalesTax ? (
          <p style={{ fontSize: "0.82rem", color: "var(--charcoal-light)", margin: 0 }}>
            <Link
              href="/admin/reports/sales-tax"
              style={{ color: "var(--olive)", textDecoration: "none" }}
            >
              Open sales-tax dashboard →
            </Link>
          </p>
        ) : (
          <MutedEmpty>Sales-tax dashboard coming soon.</MutedEmpty>
        )}
      </SectionCard>

      <NewDataRequestModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmitted={() => router.refresh()}
      />
    </div>
  );
}
