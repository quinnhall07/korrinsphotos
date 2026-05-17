"use client";

// app/admin/reports/first-100/First100ClientPage.tsx
// Phase 13.15 — First 100 Clients dashboard (client layout).
//
// Pure presentation: receives a fully-computed payload from the server page,
// renders four sections (header tiles, cohort grid, referral lineage, LTV
// histogram) and supports light interactivity for sorting the cohort grid.

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDisplayDate } from "@/lib/date";

export interface CohortRow {
  cohortNumber: number;
  clientId: string;
  fullName: string;
  email: string;
  firstTouchSource: string;
  cohortDateMs: number;
  projectCount: number;
  pillBooked: boolean;
  pillShot: boolean;
  pillDelivered: boolean;
  pillReviewed: boolean;
  /** True when the client has projects but ALL of them are LOST/ARCHIVED. */
  allLost: boolean;
  lifetimeValueCents: number;
}

export interface TopReferrer {
  clientId: string;
  fullName: string;
  referralCount: number;
}

export interface LtvBucket {
  label: string;
  count: number;
}

export interface First100Props {
  cohortSize: number;
  cohortCap: number;
  totalRevenueCents: number;
  referralsWithinCohort: number;
  avgLtvCents: number;
  rows: CohortRow[];
  referrersFromCohort: number;
  topReferrers: TopReferrer[];
  ltvBuckets: LtvBucket[];
}

type SortKey = "cohortNumber" | "cohortDateMs" | "lifetimeValueCents";
type SortDir = "asc" | "desc";

function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function First100ClientPage(props: First100Props) {
  const {
    cohortSize,
    cohortCap,
    totalRevenueCents,
    referralsWithinCohort,
    avgLtvCents,
    rows,
    referrersFromCohort,
    topReferrers,
    ltvBuckets,
  } = props;

  const [sortKey, setSortKey] = useState<SortKey>("cohortNumber");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const delta = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? delta : -delta;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const onSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "lifetimeValueCents" ? "desc" : "asc");
    }
  };

  const headingLabel = cohortSize >= cohortCap
    ? `First ${cohortCap} clients`
    : `First ${cohortSize} client${cohortSize === 1 ? "" : "s"}`;

  return (
    <div className="page-fade-in" style={{ padding: "2rem", maxWidth: 1400, margin: "0 auto" }}>
      {/* ─── Page header ─────────────────────────────────────────────────── */}
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
          {headingLabel}
        </h1>
        <p
          style={{
            fontSize: "0.78rem",
            color: "var(--charcoal-muted)",
            marginTop: "0.5rem",
            maxWidth: 720,
            lineHeight: 1.5,
          }}
        >
          The earliest paying cohort. Pipeline progress, referral lineage, and
          lifetime value distribution. Lost &amp; archived projects are surfaced
          in the grid so attrition stays visible, but excluded from LTV math.
        </p>
      </div>

      {/* ─── Section 1: Header tiles ────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1px",
          background: "var(--border)",
          border: "0.5px solid var(--border)",
          marginBottom: "2.5rem",
        }}
      >
        <Tile label="Cohort size" value={`${cohortSize}`} hint={cohortSize >= cohortCap ? "Capped at first 100" : "All paying clients to date"} />
        <Tile label="Cohort revenue" value={formatUsd(totalRevenueCents)} hint="Sum of paid invoices" />
        <Tile label="Within-cohort referrals" value={`${referralsWithinCohort}`} hint="Clients referred by another cohort member" />
        <Tile label="Average lifetime value" value={formatUsd(avgLtvCents)} hint="Revenue ÷ cohort size" />
      </div>

      {/* ─── Section 2: Cohort grid ─────────────────────────────────────── */}
      <Section title="Cohort grid" caption="Sortable by Client #, Cohort date, and LTV. Pipeline pills fill in once a project crosses the corresponding milestone.">
        <div style={{ overflowX: "auto", border: "0.5px solid var(--border)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
            <thead>
              <tr style={{ background: "rgba(42,42,40,0.03)", textAlign: "left" }}>
                <Th onClick={() => onSort("cohortNumber")} active={sortKey === "cohortNumber"} dir={sortDir} width={60}>#</Th>
                <Th width={260}>Client</Th>
                <Th width={120}>Source</Th>
                <Th onClick={() => onSort("cohortDateMs")} active={sortKey === "cohortDateMs"} dir={sortDir} width={130}>Joined</Th>
                <Th width={70}>Projects</Th>
                <Th width={210}>Pipeline</Th>
                <Th onClick={() => onSort("lifetimeValueCents")} active={sortKey === "lifetimeValueCents"} dir={sortDir} width={110} align="right">LTV</Th>
                <Th width={70} align="right">Open</Th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: "2rem", textAlign: "center", color: "var(--charcoal-muted)" }}>
                    No clients in the cohort yet — the dashboard will fill in as the first inquiries land.
                  </td>
                </tr>
              )}
              {sortedRows.map((row) => (
                <tr key={row.clientId} style={{ borderTop: "0.5px solid var(--border)" }}>
                  <td style={cellStyle()}>{row.cohortNumber}</td>
                  <td style={cellStyle()}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                      <span style={{ color: "var(--charcoal)", fontWeight: 500 }}>{row.fullName}</span>
                      <span style={{ color: "var(--charcoal-muted)", fontSize: "0.72rem" }}>{row.email}</span>
                    </div>
                  </td>
                  <td style={{ ...cellStyle(), color: "var(--charcoal-light)", fontSize: "0.72rem" }}>{row.firstTouchSource}</td>
                  <td style={{ ...cellStyle(), color: "var(--charcoal-light)", whiteSpace: "nowrap" }}>
                    {formatDisplayDate(new Date(row.cohortDateMs)) ?? "—"}
                  </td>
                  <td style={{ ...cellStyle(), textAlign: "center" }}>
                    <span style={{ color: row.allLost ? "#B45309" : "var(--charcoal)" }}>
                      {row.projectCount}
                      {row.allLost ? " · lost" : ""}
                    </span>
                  </td>
                  <td style={cellStyle()}>
                    <PipelinePills
                      booked={row.pillBooked}
                      shot={row.pillShot}
                      delivered={row.pillDelivered}
                      reviewed={row.pillReviewed}
                    />
                  </td>
                  <td style={{ ...cellStyle(), textAlign: "right", fontFamily: "'Cormorant Garamond', serif", fontSize: "1rem" }}>
                    {formatUsd(row.lifetimeValueCents)}
                  </td>
                  <td style={{ ...cellStyle(), textAlign: "right" }}>
                    <Link
                      href={`/admin/clients/${row.clientId}`}
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
        </div>
      </Section>

      {/* ─── Sections 3 + 4 side-by-side on wide screens ────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(280px, 1fr) minmax(360px, 1.6fr)",
          gap: "1.5rem",
          alignItems: "start",
          marginTop: "2rem",
        }}
      >
        {/* Section 3: Referral lineage stats */}
        <Section
          title="Referral lineage"
          caption={`${referrersFromCohort} of ${cohortSize} cohort clients referred at least one new client.`}
        >
          <div style={{ border: "0.5px solid var(--border)", padding: "1rem" }}>
            <p
              style={{
                fontSize: "0.6rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--charcoal-muted)",
                marginBottom: "0.75rem",
              }}
            >
              Top referrers in cohort
            </p>
            {topReferrers.length === 0 ? (
              <p style={{ fontSize: "0.78rem", color: "var(--charcoal-muted)" }}>
                No referrals from cohort members yet.
              </p>
            ) : (
              <ReferrerBars rows={topReferrers} />
            )}
          </div>
        </Section>

        {/* Section 4: LTV distribution */}
        <Section title="Lifetime value distribution" caption="Bucketed across all cohort clients.">
          <div style={{ border: "0.5px solid var(--border)", padding: "1rem" }}>
            <LtvHistogram buckets={ltvBuckets} />
          </div>
        </Section>
      </div>
    </div>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────────────────

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div
      style={{
        padding: "1rem 1.1rem",
        background: "var(--white)",
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
          color: "var(--charcoal)",
          margin: 0,
          lineHeight: 1.1,
        }}
      >
        {value}
      </p>
      {hint && (
        <p style={{ fontSize: "0.65rem", color: "var(--charcoal-muted)", margin: 0, lineHeight: 1.3 }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function Section({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: "1rem" }}>
      <h2
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontWeight: 400,
          fontSize: "1.45rem",
          color: "var(--charcoal)",
          margin: 0,
        }}
      >
        {title}
      </h2>
      {caption && (
        <p
          style={{
            fontSize: "0.72rem",
            color: "var(--charcoal-muted)",
            margin: "0.25rem 0 0.85rem",
            lineHeight: 1.5,
          }}
        >
          {caption}
        </p>
      )}
      {children}
    </section>
  );
}

function cellStyle(): React.CSSProperties {
  return {
    padding: "0.65rem 0.8rem",
    verticalAlign: "middle",
    color: "var(--charcoal)",
  };
}

function Th({
  children,
  width,
  onClick,
  active,
  dir,
  align,
}: {
  children: React.ReactNode;
  width?: number;
  onClick?: () => void;
  active?: boolean;
  dir?: SortDir;
  align?: "left" | "right";
}) {
  const sortable = !!onClick;
  return (
    <th
      onClick={onClick}
      style={{
        padding: "0.6rem 0.8rem",
        fontSize: "0.6rem",
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: active ? "var(--olive)" : "var(--charcoal-muted)",
        fontWeight: 500,
        cursor: sortable ? "pointer" : "default",
        userSelect: "none",
        width: width,
        textAlign: align ?? "left",
        whiteSpace: "nowrap",
      }}
    >
      {children}
      {sortable && active && (
        <span style={{ marginLeft: "0.35rem" }}>{dir === "asc" ? "↑" : "↓"}</span>
      )}
    </th>
  );
}

function PipelinePills({
  booked,
  shot,
  delivered,
  reviewed,
}: {
  booked: boolean;
  shot: boolean;
  delivered: boolean;
  reviewed: boolean;
}) {
  const items: Array<{ label: string; on: boolean }> = [
    { label: "Booked", on: booked },
    { label: "Shot", on: shot },
    { label: "Delivered", on: delivered },
    { label: "Reviewed", on: reviewed },
  ];
  return (
    <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
      {items.map((it) => (
        <span
          key={it.label}
          title={it.label + (it.on ? " — achieved" : " — not yet")}
          style={{
            display: "inline-block",
            padding: "0.18rem 0.55rem",
            fontSize: "0.6rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            border: it.on ? "0.5px solid var(--olive)" : "0.5px solid var(--border-strong)",
            background: it.on ? "var(--olive)" : "transparent",
            color: it.on ? "var(--white)" : "var(--charcoal-muted)",
          }}
        >
          {it.label}
        </span>
      ))}
    </div>
  );
}

function ReferrerBars({ rows }: { rows: TopReferrer[] }) {
  const max = Math.max(...rows.map((r) => r.referralCount), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
      {rows.map((r) => {
        const pct = (r.referralCount / max) * 100;
        return (
          <div key={r.clientId} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
              <Link
                href={`/admin/clients/${r.clientId}`}
                style={{ color: "var(--charcoal)", textDecoration: "none" }}
              >
                {r.fullName}
              </Link>
              <span style={{ color: "var(--charcoal-muted)" }}>{r.referralCount}</span>
            </div>
            <div
              style={{
                position: "relative",
                width: "100%",
                height: 6,
                background: "rgba(42,42,40,0.06)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${pct}%`,
                  background: "var(--olive)",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LtvHistogram({ buckets }: { buckets: LtvBucket[] }) {
  const width = 640;
  const height = 220;
  const margin = { top: 16, right: 16, bottom: 56, left: 32 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const max = Math.max(...buckets.map((b) => b.count), 1);
  const barGap = 6;
  const barW = (innerW - barGap * (buckets.length - 1)) / buckets.length;

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ display: "block", maxWidth: "100%", minWidth: 480 }}
        preserveAspectRatio="xMinYMid meet"
        role="img"
        aria-label="Lifetime value distribution histogram"
      >
        {/* Y axis baseline */}
        <line
          x1={margin.left}
          y1={margin.top + innerH}
          x2={margin.left + innerW}
          y2={margin.top + innerH}
          stroke="var(--border-strong)"
          strokeWidth={0.5}
        />
        {buckets.map((b, i) => {
          const h = (b.count / max) * innerH;
          const x = margin.left + i * (barW + barGap);
          const y = margin.top + innerH - h;
          return (
            <g key={b.label}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                fill="var(--olive)"
                opacity={b.count === 0 ? 0.15 : 0.9}
              />
              <text
                x={x + barW / 2}
                y={y - 4}
                textAnchor="middle"
                fontSize={10}
                fontFamily="Jost, sans-serif"
                fill="var(--charcoal)"
              >
                {b.count > 0 ? b.count : ""}
              </text>
              <text
                x={x + barW / 2}
                y={margin.top + innerH + 14}
                textAnchor="middle"
                fontSize={9}
                fontFamily="Jost, sans-serif"
                fill="var(--charcoal-muted)"
                transform={`rotate(-30 ${x + barW / 2} ${margin.top + innerH + 14})`}
              >
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
