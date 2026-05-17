"use client";

// app/admin/reports/ad-spend/AdSpendDashboardClient.tsx
// Phase 13.18 — Interactive ad-spend + ROAS dashboard (Wave 8).
//
// All Firestore reads + ROAS math live in the parent Server Component
// (`./page.tsx`). This file owns:
//   - the date-range form (navigates with ?start=&end=)
//   - the four KPI tiles
//   - the per-campaign + per-channel tables
//   - the entries-ledger table (with delete)
//   - the "Add entry" modal (campaign select, channel, period, dollars, notes)
//
// Types are duplicated client-side rather than re-imported from `lib/db/*`
// (server-only). This is the same pattern as `TaxDashboardClient.tsx`.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toaster";
import {
  createAdSpendEntryAction,
  deleteAdSpendEntryAction,
} from "./actions";

// ─── Types (mirror lib/db/ad-spend.ts + lib/domain/roas.ts) ───────────────────

export type AdChannel =
  | "GOOGLE_ADS"
  | "INSTAGRAM_ADS"
  | "META_ADS"
  | "PINTEREST_ADS"
  | "VENUE_PARTNERSHIP"
  | "OTHER";

const AD_CHANNELS: AdChannel[] = [
  "GOOGLE_ADS",
  "INSTAGRAM_ADS",
  "META_ADS",
  "PINTEREST_ADS",
  "VENUE_PARTNERSHIP",
  "OTHER",
];

const AD_CHANNEL_LABELS: Record<AdChannel, string> = {
  GOOGLE_ADS: "Google Ads",
  INSTAGRAM_ADS: "Instagram Ads",
  META_ADS: "Meta Ads",
  PINTEREST_ADS: "Pinterest Ads",
  VENUE_PARTNERSHIP: "Venue partnership",
  OTHER: "Other",
};

export interface SerializedAdSpendEntry {
  id: string;
  campaignId: string | null;
  campaignSlug: string | null;
  channel: AdChannel;
  channelLabel: string;
  periodStart: string; // ISO
  periodEnd: string;   // ISO
  amountCents: number;
  impressions: number | null;
  clicks: number | null;
  notes: string | null;
}

export interface SerializedCampaignOption {
  id: string;
  slug: string;
  title: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
}

export interface SerializedRoasRow {
  campaignId: string | null;
  campaignSlug: string | null;
  campaignTitle: string | null;
  spendCents: number;
  inquiriesCount: number;
  bookedProjectsCount: number;
  revenueCents: number;
  roas: number | null;
  cpaCents: number | null;
}

export interface SerializedChannelRoasRow {
  channel: AdChannel;
  channelLabel: string;
  spendCents: number;
  attributedClientsCount: number;
  revenueCents: number;
  roas: number | null;
}

export interface SerializedRoasSnapshot {
  periodStart: string;
  periodEnd: string;
  byCampaign: SerializedRoasRow[];
  byChannel: SerializedChannelRoasRow[];
  totals: {
    spendCents: number;
    revenueCents: number;
    roas: number | null;
    inquiriesCount: number;
    bookedProjectsCount: number;
  };
}

// ─── Style primitives ────────────────────────────────────────────────────────

const eyebrowStyle: React.CSSProperties = {
  fontSize: "0.65rem",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "var(--olive)",
  fontWeight: 400,
};

const ctaButton: React.CSSProperties = {
  display: "inline-block",
  padding: "0.7rem 1.4rem",
  background: "var(--olive)",
  color: "var(--white)",
  border: "none",
  fontSize: "0.7rem",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  fontFamily: "'Jost', sans-serif",
  cursor: "pointer",
};

const ghostButton: React.CSSProperties = {
  display: "inline-block",
  padding: "0.55rem 1rem",
  border: "0.5px solid var(--border-strong)",
  background: "transparent",
  fontSize: "0.7rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  fontFamily: "'Jost', sans-serif",
  cursor: "pointer",
  color: "var(--charcoal)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "0.5px solid var(--border-strong)",
  background: "transparent",
  padding: "0.55rem 0.7rem",
  fontFamily: "'Jost', sans-serif",
  fontSize: "0.85rem",
  color: "var(--charcoal)",
  outline: "none",
  borderRadius: 0,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.62rem",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--charcoal-muted)",
  marginBottom: "0.35rem",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "0.7rem 0.9rem",
  fontSize: "0.6rem",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--charcoal-muted)",
  borderBottom: "0.5px solid var(--border)",
  fontWeight: 400,
};

const tdStyle: React.CSSProperties = {
  padding: "0.75rem 0.9rem",
  fontSize: "0.85rem",
  color: "var(--charcoal)",
  borderBottom: "0.5px solid var(--border)",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatUsdPrecise(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatNum(n: number): string {
  return n.toLocaleString("en-US");
}

function formatRoas(roas: number | null): string {
  if (roas === null || !Number.isFinite(roas)) return "—";
  return `${roas.toFixed(2)}×`;
}

function formatPeriodDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Olive / green / amber / red wash for the ROAS column. Mirrors the
 * thresholds Korrin uses to triage spend: 3× is healthy, 1.5× is "fine",
 * 0.5× is bleeding.
 */
function roasTone(roas: number | null): { bg: string; fg: string } {
  if (roas === null) return { bg: "transparent", fg: "var(--charcoal-muted)" };
  if (roas >= 3) return { bg: "rgba(34,134,58,0.10)", fg: "#22863A" };
  if (roas >= 1.5) return { bg: "rgba(107,120,69,0.12)", fg: "var(--olive)" };
  if (roas >= 0.5) return { bg: "rgba(180,83,9,0.10)", fg: "#B45309" };
  return { bg: "rgba(220,38,38,0.10)", fg: "#DC2626" };
}

function isoDateInput(iso: string): string {
  // input[type=date] wants yyyy-mm-dd; our ISO is already UTC midnight.
  return iso.slice(0, 10);
}

// ─── Main ────────────────────────────────────────────────────────────────────

interface Props {
  periodStartIso: string; // yyyy-mm-dd
  periodEndIso: string;   // yyyy-mm-dd
  snapshot: SerializedRoasSnapshot;
  entries: SerializedAdSpendEntry[];
  campaigns: SerializedCampaignOption[];
}

export function AdSpendDashboardClient({
  periodStartIso,
  periodEndIso,
  snapshot,
  entries,
  campaigns,
}: Props) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [startInput, setStartInput] = useState(periodStartIso);
  const [endInput, setEndInput] = useState(periodEndIso);

  function applyDateRange() {
    const params = new URLSearchParams();
    if (startInput) params.set("start", startInput);
    if (endInput) params.set("end", endInput);
    router.push(`/admin/reports/ad-spend?${params.toString()}`);
  }

  function jumpThisMonth() {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    const s = isoDateInput(start.toISOString());
    const e = isoDateInput(end.toISOString());
    setStartInput(s);
    setEndInput(e);
    router.push(`/admin/reports/ad-spend?start=${s}&end=${e}`);
  }

  function jumpLast30() {
    const end = new Date();
    const start = new Date(end.getTime() - 29 * 86_400_000);
    const s = isoDateInput(start.toISOString());
    const e = isoDateInput(end.toISOString());
    setStartInput(s);
    setEndInput(e);
    router.push(`/admin/reports/ad-spend?start=${s}&end=${e}`);
  }

  return (
    <div className="page-fade-in" style={{ padding: "2rem 2.5rem", maxWidth: 1400, margin: "0 auto" }}>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: "1.75rem",
          gap: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p style={{ ...eyebrowStyle, marginBottom: "0.4rem" }}>Reports</p>
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "2.4rem",
              fontWeight: 300,
              margin: 0,
              color: "var(--charcoal)",
            }}
          >
            Ad Spend &amp; ROAS
          </h1>
          <p style={{ fontSize: "0.78rem", color: "var(--charcoal-muted)", marginTop: "0.5rem", maxWidth: "44rem" }}>
            Manual ledger. Log monthly spend per campaign × channel; revenue is joined from
            attributed clients ({" "}
            <em>firstTouchCampaign</em> for the per-campaign table, <em>firstTouchMedium</em> for the
            per-channel table) whose first touch falls inside the selected period.
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} style={ctaButton}>
          + Add ad-spend entry
        </button>
      </div>

      {/* ── Period controls ─────────────────────────────────────────────── */}
      <div
        style={{
          border: "0.5px solid var(--border)",
          padding: "1rem 1.1rem",
          marginBottom: "1.5rem",
          display: "flex",
          alignItems: "flex-end",
          gap: "0.9rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <label style={labelStyle}>Period start</label>
          <input
            type="date"
            value={startInput}
            onChange={(e) => setStartInput(e.target.value)}
            style={{ ...inputStyle, width: "11rem" }}
          />
        </div>
        <div>
          <label style={labelStyle}>Period end</label>
          <input
            type="date"
            value={endInput}
            onChange={(e) => setEndInput(e.target.value)}
            style={{ ...inputStyle, width: "11rem" }}
          />
        </div>
        <button onClick={applyDateRange} style={ctaButton}>
          Apply
        </button>
        <button onClick={jumpThisMonth} style={ghostButton}>
          This month
        </button>
        <button onClick={jumpLast30} style={ghostButton}>
          Last 30 days
        </button>
        <div style={{ marginLeft: "auto", fontSize: "0.72rem", color: "var(--charcoal-muted)" }}>
          {formatPeriodDate(snapshot.periodStart)} — {formatPeriodDate(snapshot.periodEnd)}
        </div>
      </div>

      {/* ── KPI strip ───────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1px",
          background: "var(--border)",
          border: "0.5px solid var(--border)",
          marginBottom: "2rem",
        }}
      >
        <KpiTile label="Total Spend" value={formatUsd(snapshot.totals.spendCents)} />
        <KpiTile label="Attributed Revenue" value={formatUsd(snapshot.totals.revenueCents)} />
        <KpiTile
          label="Overall ROAS"
          value={formatRoas(snapshot.totals.roas)}
          tone={roasTone(snapshot.totals.roas)}
        />
        <KpiTile label="Ad-Sourced Inquiries" value={formatNum(snapshot.totals.inquiriesCount)} />
      </div>

      {/* ── By campaign ─────────────────────────────────────────────────── */}
      <Section title="By campaign">
        {snapshot.byCampaign.length === 0 ? (
          <EmptyState text="No ad-spend entries with a campaign attached for this period." />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Campaign</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Spend</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Inquiries</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Booked</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Revenue</th>
                <th style={{ ...thStyle, textAlign: "right" }}>ROAS</th>
                <th style={{ ...thStyle, textAlign: "right" }}>CPA</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.byCampaign.map((row) => {
                const tone = roasTone(row.roas);
                return (
                  <tr key={row.campaignId ?? "__unattributed__"}>
                    <td style={tdStyle}>
                      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.05rem" }}>
                        {row.campaignTitle ?? (row.campaignId ? "(unknown campaign)" : "(no campaign)")}
                      </div>
                      {row.campaignSlug && (
                        <div style={{ fontSize: "0.7rem", color: "var(--charcoal-muted)" }}>
                          /c/{row.campaignSlug}
                        </div>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{formatUsd(row.spendCents)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{formatNum(row.inquiriesCount)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {formatNum(row.bookedProjectsCount)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{formatUsd(row.revenueCents)}</td>
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: "right",
                        background: tone.bg,
                        color: tone.fg,
                        fontWeight: 500,
                      }}
                    >
                      {formatRoas(row.roas)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {row.cpaCents === null ? "—" : formatUsdPrecise(row.cpaCents)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>

      {/* ── By channel ──────────────────────────────────────────────────── */}
      <Section title="By channel">
        {snapshot.byChannel.length === 0 ? (
          <EmptyState text="No ad-spend entries for this period." />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Channel</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Spend</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Attributed clients</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Revenue</th>
                <th style={{ ...thStyle, textAlign: "right" }}>ROAS</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.byChannel.map((row) => {
                const tone = roasTone(row.roas);
                return (
                  <tr key={row.channel}>
                    <td style={tdStyle}>{row.channelLabel}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{formatUsd(row.spendCents)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {formatNum(row.attributedClientsCount)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{formatUsd(row.revenueCents)}</td>
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: "right",
                        background: tone.bg,
                        color: tone.fg,
                        fontWeight: 500,
                      }}
                    >
                      {formatRoas(row.roas)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>

      {/* ── Entries ledger ───────────────────────────────────────────────── */}
      <Section title="All entries">
        {entries.length === 0 ? (
          <EmptyState text="No ad-spend entries logged yet. Click + Add ad-spend entry to log your first." />
        ) : (
          <EntriesTable entries={entries} />
        )}
      </Section>

      {/* ── Create modal ─────────────────────────────────────────────────── */}
      {showCreate && (
        <NewEntryModal
          campaigns={campaigns}
          defaultStart={periodStartIso}
          defaultEnd={periodEndIso}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function KpiTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: { bg: string; fg: string };
}) {
  return (
    <div
      style={{
        padding: "1rem 1.1rem",
        background: tone?.bg ?? "var(--white)",
        display: "flex",
        flexDirection: "column",
        gap: "0.4rem",
        minHeight: 96,
      }}
    >
      <p
        style={{
          fontSize: "0.6rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--charcoal-muted)",
          margin: 0,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontWeight: 400,
          fontSize: "1.7rem",
          color: tone?.fg ?? "var(--charcoal)",
          margin: 0,
          lineHeight: 1.1,
        }}
      >
        {value}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: "2rem" }}>
      <h2
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "1.5rem",
          fontWeight: 300,
          margin: "0 0 0.75rem",
          color: "var(--charcoal)",
        }}
      >
        {title}
      </h2>
      <div style={{ border: "0.5px solid var(--border)", background: "var(--white)" }}>{children}</div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: "2rem 1.5rem",
        textAlign: "center",
        color: "var(--charcoal-muted)",
        fontSize: "0.85rem",
        lineHeight: 1.6,
      }}
    >
      {text}
    </div>
  );
}

function EntriesTable({ entries }: { entries: SerializedAdSpendEntry[] }) {
  const [isPending, startTransition] = useTransition();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  function handleDelete(id: string) {
    if (typeof window !== "undefined" && !window.confirm("Delete this ad-spend entry?")) return;
    setPendingDelete(id);
    startTransition(async () => {
      const res = await deleteAdSpendEntryAction(id);
      if (res.success) {
        toast("Ad-spend entry deleted");
      } else {
        toast(res.error ?? "Failed to delete entry");
      }
      setPendingDelete(null);
    });
  }

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th style={thStyle}>Period</th>
          <th style={thStyle}>Channel</th>
          <th style={thStyle}>Campaign</th>
          <th style={{ ...thStyle, textAlign: "right" }}>Spend</th>
          <th style={{ ...thStyle, textAlign: "right" }}>Impr.</th>
          <th style={{ ...thStyle, textAlign: "right" }}>Clicks</th>
          <th style={thStyle}>Notes</th>
          <th style={{ ...thStyle, textAlign: "right" }}></th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <tr key={e.id}>
            <td style={tdStyle}>
              <div>{formatPeriodDate(e.periodStart)}</div>
              <div style={{ fontSize: "0.7rem", color: "var(--charcoal-muted)" }}>
                → {formatPeriodDate(e.periodEnd)}
              </div>
            </td>
            <td style={tdStyle}>{e.channelLabel}</td>
            <td style={tdStyle}>
              {e.campaignSlug ? (
                <code style={{ fontSize: "0.78rem" }}>/c/{e.campaignSlug}</code>
              ) : (
                <span style={{ color: "var(--charcoal-muted)" }}>—</span>
              )}
            </td>
            <td style={{ ...tdStyle, textAlign: "right" }}>{formatUsdPrecise(e.amountCents)}</td>
            <td style={{ ...tdStyle, textAlign: "right" }}>
              {e.impressions === null ? "—" : formatNum(e.impressions)}
            </td>
            <td style={{ ...tdStyle, textAlign: "right" }}>
              {e.clicks === null ? "—" : formatNum(e.clicks)}
            </td>
            <td style={{ ...tdStyle, color: "var(--charcoal-muted)", fontSize: "0.78rem" }}>
              {e.notes ?? ""}
            </td>
            <td style={{ ...tdStyle, textAlign: "right" }}>
              <button
                onClick={() => handleDelete(e.id)}
                disabled={isPending && pendingDelete === e.id}
                style={{
                  background: "transparent",
                  border: 0,
                  color: "var(--charcoal-muted)",
                  fontSize: "0.7rem",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  padding: "0.3rem 0.4rem",
                }}
              >
                {isPending && pendingDelete === e.id ? "…" : "Delete"}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Create modal ────────────────────────────────────────────────────────────

function NewEntryModal({
  campaigns,
  defaultStart,
  defaultEnd,
  onClose,
}: {
  campaigns: SerializedCampaignOption[];
  defaultStart: string;
  defaultEnd: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [campaignId, setCampaignId] = useState<string>("");
  const [channel, setChannel] = useState<AdChannel>("GOOGLE_ADS");
  const [periodStart, setPeriodStart] = useState(defaultStart);
  const [periodEnd, setPeriodEnd] = useState(defaultEnd);
  const [amountStr, setAmountStr] = useState("");
  const [impressionsStr, setImpressionsStr] = useState("");
  const [clicksStr, setClicksStr] = useState("");
  const [notes, setNotes] = useState("");

  const activeCampaigns = useMemo(
    () => campaigns.filter((c) => c.status !== "ARCHIVED"),
    [campaigns]
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const amount = Number(amountStr);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Amount must be a non-negative number.");
      return;
    }
    if (!periodStart || !periodEnd) {
      setError("Period start and end are required.");
      return;
    }
    if (periodEnd < periodStart) {
      setError("Period end must be on or after period start.");
      return;
    }

    const impressions = impressionsStr === "" ? undefined : Number(impressionsStr);
    const clicks = clicksStr === "" ? undefined : Number(clicksStr);

    startTransition(async () => {
      const res = await createAdSpendEntryAction({
        campaignId: campaignId || null,
        channel,
        periodStart,
        periodEnd,
        amount,
        impressions: typeof impressions === "number" && Number.isFinite(impressions) ? impressions : undefined,
        clicks: typeof clicks === "number" && Number.isFinite(clicks) ? clicks : undefined,
        notes: notes.trim() || undefined,
      });

      if (res.success) {
        toast("Ad-spend entry logged");
        onClose();
        router.refresh();
      } else {
        setError(res.error);
        toast(res.error);
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(42,42,40,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "2rem",
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        style={{
          background: "var(--white)",
          border: "0.5px solid var(--border-strong)",
          padding: "2rem 1.75rem",
          maxWidth: "34rem",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <div>
          <p style={{ ...eyebrowStyle, marginBottom: "0.4rem" }}>New entry</p>
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "1.6rem",
              fontWeight: 300,
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            Log ad spend
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <div>
            <label style={labelStyle}>Campaign</label>
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              style={inputStyle}
            >
              <option value="">— (unattributed) —</option>
              {activeCampaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Channel *</label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as AdChannel)}
              style={inputStyle}
              required
            >
              {AD_CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {AD_CHANNEL_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <div>
            <label style={labelStyle}>Period start *</label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              style={inputStyle}
              required
            />
          </div>
          <div>
            <label style={labelStyle}>Period end *</label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              style={inputStyle}
              required
            />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Amount (USD) *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            placeholder="450.00"
            style={inputStyle}
            required
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <div>
            <label style={labelStyle}>Impressions</label>
            <input
              type="number"
              min="0"
              value={impressionsStr}
              onChange={(e) => setImpressionsStr(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Clicks</label>
            <input
              type="number"
              min="0"
              value={clicksStr}
              onChange={(e) => setClicksStr(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            style={{ ...inputStyle, fontFamily: "'Jost', sans-serif", resize: "vertical" }}
          />
        </div>

        {error && (
          <div
            style={{
              border: "0.5px solid #FCA5A5",
              background: "#FEF2F2",
              color: "#991B1B",
              padding: "0.65rem 0.8rem",
              fontSize: "0.82rem",
              lineHeight: 1.55,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} disabled={isPending} style={ghostButton}>
            Cancel
          </button>
          <button type="submit" disabled={isPending} style={ctaButton}>
            {isPending ? "Saving…" : "Log entry"}
          </button>
        </div>
      </form>
    </div>
  );
}
