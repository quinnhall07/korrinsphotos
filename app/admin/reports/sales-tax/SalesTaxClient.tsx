"use client";

// app/admin/reports/sales-tax/SalesTaxClient.tsx
// Phase 3.11 — Interactive surfaces for the sales-tax dashboard:
//   - date-range picker that pushes `?from=...&to=...` to refresh the page
//   - "Mark filed" / "Mark paid" buttons on filing rows
//   - "Run sweep" button to manually trigger regenerateUpcomingFilings

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/components/ui/Toaster";
import {
  markFilingFiledAction,
  markFilingPaidAction,
  regenerateFilingsAction,
} from "./actions";

interface LedgerRowProps {
  invoiceId: string;
  projectId: string;
  clientName: string;
  stateCode: string;
  subtotalCents: number;
  taxCents: number;
  paidAt: string;
}

interface FilingRowProps {
  id: string;
  stateCode: string;
  periodStartIso: string;
  periodEndIso: string;
  dueByIso: string;
  taxableSalesCents: number;
  taxOwedCents: number;
  status: "DUE_SOON" | "OVERDUE" | "FILED" | "PAID";
}

interface Props {
  fromIso: string;
  toIso: string;
  rows: LedgerRowProps[];
  totalsByState: Record<string, { taxableSalesCents: number; taxOwedCents: number }>;
  upcoming: FilingRowProps[];
  overdue: FilingRowProps[];
}

function fmtUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function SalesTaxClient({
  fromIso,
  toIso,
  rows,
  totalsByState,
  upcoming,
  overdue,
}: Props) {
  const router = useRouter();
  const search = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [from, setFrom] = useState(fromIso);
  const [to, setTo] = useState(toIso);

  function applyRange() {
    const params = new URLSearchParams(search?.toString() ?? "");
    params.set("from", from);
    params.set("to", to);
    router.push(`/admin/reports/sales-tax?${params.toString()}`);
  }

  function onMarkFiled(id: string) {
    startTransition(async () => {
      const r = await markFilingFiledAction(id);
      if (r.success) {
        toast("Marked filed.");
        router.refresh();
      } else {
        toast(r.error || "Failed.");
      }
    });
  }

  function onMarkPaid(id: string) {
    startTransition(async () => {
      const r = await markFilingPaidAction(id, new Date().toISOString());
      if (r.success) {
        toast("Marked paid.");
        router.refresh();
      } else {
        toast(r.error || "Failed.");
      }
    });
  }

  function onRunSweep() {
    startTransition(async () => {
      const r = await regenerateFilingsAction();
      if (r.success) {
        toast(`Sweep complete (${r.data.created} created, ${r.data.skipped} skipped).`);
        router.refresh();
      } else {
        toast(r.error || "Failed.");
      }
    });
  }

  const tileGrid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: "1rem",
    marginBottom: "2rem",
  };

  const tile: React.CSSProperties = {
    border: "0.5px solid var(--border)",
    padding: "1rem 1.1rem",
    background: "var(--white)",
  };

  const tableWrap: React.CSSProperties = {
    border: "0.5px solid var(--border)",
    background: "var(--white)",
    overflowX: "auto",
  };

  const th: React.CSSProperties = {
    textAlign: "left",
    fontSize: "0.66rem",
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color: "var(--charcoal-muted)",
    padding: "0.65rem 0.85rem",
    borderBottom: "0.5px solid var(--border)",
    fontWeight: 500,
  };

  const td: React.CSSProperties = {
    fontSize: "0.82rem",
    color: "var(--charcoal)",
    padding: "0.7rem 0.85rem",
    borderBottom: "0.5px solid var(--border)",
  };

  const stateTotals = Object.entries(totalsByState).sort(
    (a, b) => b[1].taxOwedCents - a[1].taxOwedCents
  );

  return (
    <div className="page-fade-in">
      <header style={{ marginBottom: "2rem" }}>
        <p
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--olive)",
            marginBottom: "0.5rem",
          }}
        >
          Reports · Sales Tax
        </p>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontWeight: 300,
            fontSize: "2.4rem",
            lineHeight: 1.1,
            color: "var(--charcoal)",
            marginBottom: "0.5rem",
          }}
        >
          Sales tax <em>filings</em>
        </h1>
        <p
          style={{
            fontSize: "0.88rem",
            lineHeight: 1.65,
            color: "var(--charcoal-light)",
            maxWidth: 720,
          }}
        >
          Per-state filings, upcoming due dates, and the paid-invoice ledger.
          Filings are auto-regenerated nightly via the cron sweep.
        </p>
      </header>

      {/* Overdue */}
      {overdue.length > 0 && (
        <section style={{ marginBottom: "2rem" }}>
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "1.3rem",
              color: "#991B1B",
              marginBottom: "0.75rem",
            }}
          >
            Overdue filings
          </h2>
          <div style={{ ...tableWrap, borderColor: "#FCA5A5", background: "#FEF2F2" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>State</th>
                  <th style={th}>Period</th>
                  <th style={th}>Due By</th>
                  <th style={th}>Taxable Sales</th>
                  <th style={th}>Tax Owed</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {overdue.map((f) => (
                  <tr key={f.id}>
                    <td style={td}>{f.stateCode}</td>
                    <td style={td}>
                      {fmtDate(f.periodStartIso)} → {fmtDate(f.periodEndIso)}
                    </td>
                    <td style={{ ...td, color: "#991B1B" }}>{fmtDate(f.dueByIso)}</td>
                    <td style={td}>{fmtUsd(f.taxableSalesCents)}</td>
                    <td style={td}>{fmtUsd(f.taxOwedCents)}</td>
                    <td style={td}>
                      <button
                        onClick={() => onMarkFiled(f.id)}
                        disabled={pending}
                        style={{
                          fontSize: "0.7rem",
                          padding: "0.3rem 0.6rem",
                          background: "var(--white)",
                          border: "0.5px solid var(--border-strong)",
                          cursor: pending ? "default" : "pointer",
                          marginRight: "0.4rem",
                        }}
                      >
                        Mark filed
                      </button>
                      <button
                        onClick={() => onMarkPaid(f.id)}
                        disabled={pending}
                        style={{
                          fontSize: "0.7rem",
                          padding: "0.3rem 0.6rem",
                          background: "var(--olive)",
                          color: "var(--white)",
                          border: "none",
                          cursor: pending ? "default" : "pointer",
                        }}
                      >
                        Mark paid
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Upcoming */}
      <section style={{ marginBottom: "2rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: "0.75rem",
          }}
        >
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "1.3rem",
              color: "var(--charcoal)",
            }}
          >
            Upcoming filings (next 90 days)
          </h2>
          <button
            onClick={onRunSweep}
            disabled={pending}
            style={{
              fontSize: "0.7rem",
              padding: "0.4rem 0.8rem",
              background: "var(--white)",
              border: "0.5px solid var(--border-strong)",
              cursor: pending ? "default" : "pointer",
            }}
          >
            {pending ? "Working..." : "Run sweep"}
          </button>
        </div>
        <div style={tableWrap}>
          {upcoming.length === 0 ? (
            <p style={{ padding: "1.2rem", color: "var(--charcoal-muted)", fontSize: "0.85rem" }}>
              No upcoming filings in the next 90 days.
            </p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>State</th>
                  <th style={th}>Period</th>
                  <th style={th}>Due By</th>
                  <th style={th}>Taxable Sales</th>
                  <th style={th}>Tax Owed</th>
                  <th style={th}>Status</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((f) => (
                  <tr key={f.id}>
                    <td style={td}>{f.stateCode}</td>
                    <td style={td}>
                      {fmtDate(f.periodStartIso)} → {fmtDate(f.periodEndIso)}
                    </td>
                    <td style={td}>{fmtDate(f.dueByIso)}</td>
                    <td style={td}>{fmtUsd(f.taxableSalesCents)}</td>
                    <td style={td}>{fmtUsd(f.taxOwedCents)}</td>
                    <td style={td}>{f.status}</td>
                    <td style={td}>
                      <button
                        onClick={() => onMarkFiled(f.id)}
                        disabled={pending}
                        style={{
                          fontSize: "0.7rem",
                          padding: "0.3rem 0.6rem",
                          background: "var(--white)",
                          border: "0.5px solid var(--border-strong)",
                          cursor: pending ? "default" : "pointer",
                          marginRight: "0.4rem",
                        }}
                      >
                        Mark filed
                      </button>
                      <button
                        onClick={() => onMarkPaid(f.id)}
                        disabled={pending}
                        style={{
                          fontSize: "0.7rem",
                          padding: "0.3rem 0.6rem",
                          background: "var(--olive)",
                          color: "var(--white)",
                          border: "none",
                          cursor: pending ? "default" : "pointer",
                        }}
                      >
                        Mark paid
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Ledger window */}
      <section>
        <h2
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "1.3rem",
            color: "var(--charcoal)",
            marginBottom: "0.75rem",
          }}
        >
          Ledger
        </h2>

        <div
          style={{
            display: "flex",
            gap: "0.6rem",
            alignItems: "center",
            marginBottom: "1rem",
            flexWrap: "wrap",
          }}
        >
          <label style={{ fontSize: "0.72rem", color: "var(--charcoal-muted)" }}>
            From{" "}
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={{
                fontSize: "0.82rem",
                padding: "0.3rem 0.5rem",
                border: "0.5px solid var(--border-strong)",
                background: "var(--white)",
              }}
            />
          </label>
          <label style={{ fontSize: "0.72rem", color: "var(--charcoal-muted)" }}>
            To{" "}
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={{
                fontSize: "0.82rem",
                padding: "0.3rem 0.5rem",
                border: "0.5px solid var(--border-strong)",
                background: "var(--white)",
              }}
            />
          </label>
          <button
            onClick={applyRange}
            disabled={pending}
            style={{
              fontSize: "0.72rem",
              padding: "0.35rem 0.7rem",
              background: "var(--charcoal)",
              color: "var(--white)",
              border: "none",
              cursor: pending ? "default" : "pointer",
            }}
          >
            Apply
          </button>
          <a
            href={`/api/sales-tax/export?from=${from}&to=${to}`}
            style={{
              fontSize: "0.72rem",
              padding: "0.35rem 0.7rem",
              background: "var(--white)",
              color: "var(--charcoal)",
              border: "0.5px solid var(--border-strong)",
              textDecoration: "none",
            }}
          >
            Export CSV
          </a>
        </div>

        {/* Per-state KPI tiles */}
        {stateTotals.length > 0 && (
          <div style={tileGrid}>
            {stateTotals.map(([code, t]) => (
              <div key={code} style={tile}>
                <p
                  style={{
                    fontSize: "0.62rem",
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    color: "var(--charcoal-muted)",
                    marginBottom: "0.3rem",
                  }}
                >
                  {code}
                </p>
                <p style={{ fontSize: "1.1rem", color: "var(--charcoal)", marginBottom: "0.15rem" }}>
                  {fmtUsd(t.taxOwedCents)} owed
                </p>
                <p style={{ fontSize: "0.78rem", color: "var(--charcoal-muted)" }}>
                  on {fmtUsd(t.taxableSalesCents)} taxable
                </p>
              </div>
            ))}
          </div>
        )}

        <div style={tableWrap}>
          {rows.length === 0 ? (
            <p style={{ padding: "1.2rem", color: "var(--charcoal-muted)", fontSize: "0.85rem" }}>
              No invoices paid in this window.
            </p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Paid</th>
                  <th style={th}>Client</th>
                  <th style={th}>State</th>
                  <th style={th}>Subtotal</th>
                  <th style={th}>Tax</th>
                  <th style={th}>Invoice</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.invoiceId}>
                    <td style={td}>{fmtDate(r.paidAt)}</td>
                    <td style={td}>{r.clientName}</td>
                    <td style={td}>{r.stateCode}</td>
                    <td style={td}>{fmtUsd(r.subtotalCents)}</td>
                    <td style={td}>{fmtUsd(r.taxCents)}</td>
                    <td style={td}>
                      <a
                        href={`/admin/projects/${r.projectId}`}
                        style={{ color: "var(--olive)", textDecoration: "none" }}
                      >
                        view
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
