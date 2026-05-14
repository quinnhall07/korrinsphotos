// app/admin/reports/quiet-season/page.tsx
// Phase 13.9 — Quiet-season planner.
//
// Read-only analytical dashboard. Server Component:
//   1. requireAdmin() guard.
//   2. Loads every project + every client (the analysis is global by
//      design — bookings of any age inform the seasonality baseline).
//   3. Loads every PAID invoice so the analyser can build per-client and
//      per-project revenue maps without re-reading the collection.
//   4. Hands all of that to `buildQuietSeasonAnalysis` (pure helper) and
//      renders four sections: header tiles, heatmap, quiet-month callout,
//      re-engagement candidates table.
//
// All math + Firestore reads stay on the server. There is no
// interactive client component here — the page is a static report.
//
// ─── Composite-index note ────────────────────────────────────────────────
// The unfiltered `projectsCol().get()` is intentional. We need every row
// regardless of status / shootDate, and a single bulk read avoids the
// per-status indexes that a multi-where query would require. The same
// pattern is used by `/admin/reports/first-100`.

import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { projectsCol, type ProjectDoc } from "@/lib/db/projects";
import { clientsCol, type ClientDoc } from "@/lib/db/clients";
import { invoicesCol, type InvoiceDoc } from "@/lib/db/invoices";
import {
  buildQuietSeasonAnalysis,
  type ForecastMonth,
  type HistoricalMonthBucket,
  type ReEngagementCandidate,
  type SuggestedCampaign,
} from "@/lib/domain/quiet-season";

export const metadata: Metadata = { title: "Quiet Season | Reports" };
export const dynamic = "force-dynamic";

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatUsd(usd: number): string {
  return usd.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatRelativeMonths(months: number): string {
  if (months <= 0) return "this month";
  if (months === 1) return "1 month ago";
  if (months < 12) return `${months} months ago`;
  const years = Math.floor(months / 12);
  const remainder = months - years * 12;
  if (remainder === 0) return years === 1 ? "1 year ago" : `${years} years ago`;
  return `${years}y ${remainder}m ago`;
}

// ─── Tile + Section primitives (inline so the page is self-contained) ────

function HeaderTile({
  eyebrow,
  value,
  caption,
}: {
  eyebrow: string;
  value: string;
  caption: string;
}) {
  return (
    <div
      style={{
        border: "0.5px solid var(--border)",
        background: "var(--white)",
        padding: "1.25rem 1.4rem",
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
        {eyebrow}
      </p>
      <p
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "2.4rem",
          fontWeight: 300,
          color: "var(--charcoal)",
          margin: "0.4rem 0 0.2rem",
          lineHeight: 1,
        }}
      >
        {value}
      </p>
      <p
        style={{
          fontSize: "0.72rem",
          color: "var(--charcoal-muted)",
          margin: 0,
        }}
      >
        {caption}
      </p>
    </div>
  );
}

function SectionShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
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
          {eyebrow}
        </p>
        <h2
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "1.6rem",
            fontWeight: 300,
            color: "var(--charcoal)",
            margin: "0.25rem 0 0",
          }}
        >
          {title}
        </h2>
        {subtitle ? (
          <p
            style={{
              fontSize: "0.78rem",
              color: "var(--charcoal-muted)",
              margin: "0.4rem 0 0",
              maxWidth: "60ch",
            }}
          >
            {subtitle}
          </p>
        ) : null}
      </header>
      <div style={{ padding: "1.4rem" }}>{children}</div>
    </section>
  );
}

// ─── Heatmap (hand-rolled SVG) ───────────────────────────────────────────

function Heatmap({
  historical,
  forecast,
}: {
  historical: HistoricalMonthBucket[];
  forecast: ForecastMonth[];
}) {
  // 12 cells for the historical row + 6 cells for the forward forecast row.
  const cellW = 60;
  const cellH = 70;
  const padX = 8;
  const padY = 8;
  const labelGutter = 16;
  const rowGap = 30;
  const totalW = padX * 2 + cellW * 12;
  const totalH = padY * 2 + cellH * 2 + rowGap + labelGutter * 2;

  const maxCount = Math.max(1, ...historical.map((m) => m.count));
  const intensity = (count: number): number => {
    if (count === 0) return 0;
    return 0.15 + 0.85 * (count / maxCount);
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${totalW} ${totalH}`}
        width="100%"
        style={{ minWidth: totalW, display: "block" }}
        role="img"
        aria-label="Bookings heatmap by month"
      >
        {/* Historical row label */}
        <text
          x={padX}
          y={padY + labelGutter - 4}
          fontSize="9"
          fontFamily="Jost, sans-serif"
          letterSpacing="2"
          fill="var(--olive)"
        >
          HISTORICAL · ALL YEARS
        </text>

        {historical.map((m, i) => {
          const x = padX + i * cellW;
          const y = padY + labelGutter;
          const a = intensity(m.count);
          return (
            <g key={`hist-${m.month}`}>
              <rect
                x={x + 2}
                y={y}
                width={cellW - 4}
                height={cellH - 8}
                fill={`rgba(107, 120, 69, ${a})`}
                stroke={m.quiet ? "rgba(170, 80, 60, 0.6)" : "rgba(42,42,40,0.12)"}
                strokeWidth={m.quiet ? 1 : 0.5}
              />
              <text
                x={x + cellW / 2}
                y={y + 18}
                fontSize="10"
                fontFamily="Jost, sans-serif"
                textAnchor="middle"
                fill={a > 0.55 ? "var(--white)" : "var(--charcoal-light)"}
              >
                {m.monthLabel}
              </text>
              <text
                x={x + cellW / 2}
                y={y + 38}
                fontSize="16"
                fontFamily="'Cormorant Garamond', serif"
                fontWeight={300}
                textAnchor="middle"
                fill={a > 0.55 ? "var(--white)" : "var(--charcoal)"}
              >
                {m.count}
              </text>
              <text
                x={x + cellW / 2}
                y={y + 53}
                fontSize="8"
                fontFamily="Jost, sans-serif"
                textAnchor="middle"
                letterSpacing="1"
                fill={a > 0.55 ? "var(--white)" : "var(--charcoal-muted)"}
              >
                {m.avgRevenueUsd > 0 ? `$${(m.avgRevenueUsd / 1000).toFixed(1)}k AVG` : "—"}
              </text>
            </g>
          );
        })}

        {/* Forward forecast row label */}
        <text
          x={padX}
          y={padY + cellH + rowGap + labelGutter - 4}
          fontSize="9"
          fontFamily="Jost, sans-serif"
          letterSpacing="2"
          fill="var(--olive)"
        >
          NEXT 6 MONTHS · ON THE BOOKS
        </text>

        {forecast.map((f, i) => {
          const x = padX + i * cellW;
          const y = padY + cellH + rowGap + labelGutter;
          const a = intensity(f.bookedCount);
          return (
            <g key={f.isoMonth}>
              <rect
                x={x + 2}
                y={y}
                width={cellW - 4}
                height={cellH - 8}
                fill={`rgba(107, 120, 69, ${a})`}
                stroke={f.quiet ? "rgba(170, 80, 60, 0.7)" : "rgba(42,42,40,0.22)"}
                strokeWidth={f.quiet ? 1.2 : 0.5}
                strokeDasharray="3 2"
              />
              <text
                x={x + cellW / 2}
                y={y + 18}
                fontSize="9"
                fontFamily="Jost, sans-serif"
                textAnchor="middle"
                fill={a > 0.55 ? "var(--white)" : "var(--charcoal-light)"}
              >
                {f.label.split(" ")[0].slice(0, 3)} {String(f.year).slice(2)}
              </text>
              <text
                x={x + cellW / 2}
                y={y + 38}
                fontSize="16"
                fontFamily="'Cormorant Garamond', serif"
                fontWeight={300}
                textAnchor="middle"
                fill={a > 0.55 ? "var(--white)" : "var(--charcoal)"}
              >
                {f.bookedCount}
              </text>
              <text
                x={x + cellW / 2}
                y={y + 53}
                fontSize="8"
                fontFamily="Jost, sans-serif"
                textAnchor="middle"
                letterSpacing="1"
                fill={a > 0.55 ? "var(--white)" : "var(--charcoal-muted)"}
              >
                vs {f.historicalAvg.toFixed(1)} avg
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: "1.2rem",
          marginTop: "0.8rem",
          fontSize: "0.7rem",
          color: "var(--charcoal-muted)",
          flexWrap: "wrap",
        }}
      >
        <span>
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              background: "rgba(107,120,69,0.85)",
              marginRight: 6,
              verticalAlign: "middle",
            }}
          />
          Busy
        </span>
        <span>
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              background: "rgba(107,120,69,0.15)",
              marginRight: 6,
              verticalAlign: "middle",
            }}
          />
          Slow
        </span>
        <span>
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              border: "1px solid rgba(170,80,60,0.7)",
              marginRight: 6,
              verticalAlign: "middle",
            }}
          />
          Flagged quiet
        </span>
        <span>
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              border: "1px dashed rgba(42,42,40,0.4)",
              marginRight: 6,
              verticalAlign: "middle",
            }}
          />
          Forward forecast
        </span>
      </div>
    </div>
  );
}

// ─── Quiet-month callout cards ────────────────────────────────────────────

function QuietMonthCallouts({
  campaigns,
}: {
  campaigns: SuggestedCampaign[];
}) {
  if (campaigns.length === 0) {
    return (
      <p style={{ color: "var(--charcoal-muted)", fontSize: "0.85rem", margin: 0 }}>
        No predicted quiet months in the next six. Either every month is on
        pace or there isn&rsquo;t enough booking history yet to detect a slow
        season.
      </p>
    );
  }
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "1rem",
      }}
    >
      {campaigns.map((c) => (
        <article
          key={c.isoMonth}
          style={{
            border: "0.5px solid var(--border-strong)",
            background: "var(--olive-dim)",
            padding: "1.1rem 1.2rem",
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
            {c.monthLabel}
          </p>
          <p
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "1.15rem",
              fontWeight: 400,
              color: "var(--charcoal)",
              margin: "0.4rem 0 0.55rem",
              lineHeight: 1.3,
            }}
          >
            {c.headline}
          </p>
          <p
            style={{
              fontSize: "0.78rem",
              color: "var(--charcoal-light)",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            {c.suggestion}
          </p>
          <Link
            href="/admin/broadcasts"
            style={{
              display: "inline-block",
              marginTop: "0.85rem",
              fontSize: "0.7rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--olive)",
              textDecoration: "none",
              borderBottom: "0.5px solid var(--olive)",
              paddingBottom: 1,
            }}
          >
            Compose broadcast →
          </Link>
        </article>
      ))}
    </div>
  );
}

// ─── Candidate table ──────────────────────────────────────────────────────

function CandidatesTable({
  candidates,
}: {
  candidates: ReEngagementCandidate[];
}) {
  if (candidates.length === 0) {
    return (
      <p style={{ color: "var(--charcoal-muted)", fontSize: "0.85rem", margin: 0 }}>
        No re-engagement candidates yet — no clients are sitting in the
        9-to-24-month window with no active project.
      </p>
    );
  }
  const top = candidates.slice(0, 25);
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "0.8rem",
        }}
      >
        <thead>
          <tr
            style={{
              borderBottom: "0.5px solid var(--border)",
              textAlign: "left",
            }}
          >
            <th style={th}>Name</th>
            <th style={th}>Last project type</th>
            <th style={th}>Last delivered</th>
            <th style={{ ...th, textAlign: "right" }}>LTV</th>
            <th style={{ ...th, textAlign: "right" }}> </th>
          </tr>
        </thead>
        <tbody>
          {top.map((c) => (
            <tr
              key={c.clientId}
              style={{ borderBottom: "0.5px solid var(--border)" }}
            >
              <td style={td}>
                <span style={{ color: "var(--charcoal)", fontWeight: 500 }}>
                  {c.fullName}
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: "0.7rem",
                    color: "var(--charcoal-muted)",
                  }}
                >
                  {c.email}
                </span>
              </td>
              <td style={td}>{c.lastSessionType}</td>
              <td style={td}>{formatRelativeMonths(c.monthsSinceDelivered)}</td>
              <td style={{ ...td, textAlign: "right" }}>
                {c.lifetimeValueCents > 0
                  ? formatUsd(c.lifetimeValueCents / 100)
                  : "—"}
              </td>
              <td style={{ ...td, textAlign: "right" }}>
                <Link
                  href={`/admin/projects/${c.lastProjectId}`}
                  style={{
                    fontSize: "0.7rem",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "var(--olive)",
                    textDecoration: "none",
                    borderBottom: "0.5px solid var(--olive)",
                  }}
                >
                  Send re-engagement →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {candidates.length > top.length ? (
        <p
          style={{
            fontSize: "0.7rem",
            color: "var(--charcoal-muted)",
            marginTop: "0.8rem",
          }}
        >
          Showing top {top.length} of {candidates.length} candidates by lifetime value.
        </p>
      ) : null}
    </div>
  );
}

const th: React.CSSProperties = {
  fontSize: "0.6rem",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "var(--charcoal-muted)",
  fontWeight: 500,
  padding: "0.7rem 0.8rem",
};

const td: React.CSSProperties = {
  padding: "0.7rem 0.8rem",
  color: "var(--charcoal-light)",
  verticalAlign: "top",
};

// ─── Page ─────────────────────────────────────────────────────────────────

export default async function QuietSeasonPage() {
  await requireAdmin();

  // Pull every project + every client + every PAID invoice in parallel.
  // The analyser is pure — it does not touch Firestore directly, so we have
  // to stage the inputs here.
  const [projectsSnap, clientsSnap, invoicesSnap] = await Promise.all([
    projectsCol().get(),
    clientsCol().get(),
    invoicesCol().where("status", "==", "PAID").get(),
  ]);

  const projects: ProjectDoc[] = projectsSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as ProjectDoc)
  );
  const clients: ClientDoc[] = clientsSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as ClientDoc)
  );
  const paidInvoices: InvoiceDoc[] = invoicesSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as InvoiceDoc)
  );

  // Build paid-revenue maps so the analyser can compute per-month avg
  // revenue + per-client lifetime value without re-reading the collection.
  const revenueByClientCents = new Map<string, number>();
  const revenueByProjectCents = new Map<string, number>();
  for (const inv of paidInvoices) {
    const amt = typeof inv.amountCents === "number" ? inv.amountCents : 0;
    if (amt <= 0) continue;
    revenueByClientCents.set(
      inv.clientId,
      (revenueByClientCents.get(inv.clientId) ?? 0) + amt
    );
    revenueByProjectCents.set(
      inv.projectId,
      (revenueByProjectCents.get(inv.projectId) ?? 0) + amt
    );
  }

  const analysis = buildQuietSeasonAnalysis({
    projects,
    clients,
    today: new Date(),
    revenueByClientCents,
    revenueByProjectCents,
  });

  return (
    <div style={{ padding: "2.5rem 2.5rem 4rem", maxWidth: 1280, margin: "0 auto" }}>
      {/* ─── Page header ────────────────────────────────────────────── */}
      <div style={{ marginBottom: "1.8rem" }}>
        <p
          style={{
            fontSize: "0.6rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--olive)",
            margin: 0,
          }}
        >
          Reports
        </p>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "2.4rem",
            fontWeight: 300,
            color: "var(--charcoal)",
            margin: "0.25rem 0 0.4rem",
          }}
        >
          Quiet <em>Season</em> Planner
        </h1>
        <p
          style={{
            fontSize: "0.85rem",
            color: "var(--charcoal-light)",
            margin: 0,
            maxWidth: "70ch",
          }}
        >
          Where the calendar tends to slow down, what&rsquo;s on the books for
          the next six months, and which past clients are due for a nudge.
        </p>
      </div>

      {/* ─── Header tile row ─────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <HeaderTile
          eyebrow="Quiet months ahead"
          value={String(analysis.quietMonthsInForecast)}
          caption="In the next 6 months"
        />
        <HeaderTile
          eyebrow="Re-engagement candidates"
          value={String(analysis.reEngagementCandidates.length)}
          caption="Past clients in the 9–24 month window"
        />
        <HeaderTile
          eyebrow="Avg revenue / quiet month"
          value={
            analysis.avgRevenuePerQuietMonthUsd > 0
              ? formatUsd(analysis.avgRevenuePerQuietMonthUsd)
              : "—"
          }
          caption="Historical average for flagged months"
        />
      </div>

      {/* ─── Heatmap ─────────────────────────────────────────────────── */}
      <SectionShell
        eyebrow="Heatmap"
        title="Bookings by month"
        subtitle="Top row is your historical baseline across every year of bookings. Bottom row is what's currently on the books for each of the next six months. Forward cells are dashed; cells flagged as quiet have a copper border."
      >
        {analysis.noHistory ? (
          <p
            style={{
              color: "var(--charcoal-muted)",
              fontSize: "0.85rem",
              margin: 0,
            }}
          >
            Not enough booking history yet. Once a few projects move past
            BOOKED with a shoot date set, the heatmap will start filling in.
          </p>
        ) : (
          <Heatmap
            historical={analysis.historicalMonthly}
            forecast={analysis.forecast}
          />
        )}
      </SectionShell>

      {/* ─── Quiet-month callouts ────────────────────────────────────── */}
      <SectionShell
        eyebrow="Predicted quiet months"
        title="Where to lean in"
        subtitle="Each card pairs a predicted slow month with a suggested re-engagement campaign drawn from your past-client list."
      >
        <QuietMonthCallouts campaigns={analysis.suggestedCampaigns} />
      </SectionShell>

      {/* ─── Re-engagement candidates ────────────────────────────────── */}
      <SectionShell
        eyebrow="Re-engagement candidates"
        title="Who&rsquo;s due for a nudge"
        subtitle="Clients whose last gallery was delivered between 9 and 24 months ago, with no active project today. Sorted by lifetime value descending."
      >
        <CandidatesTable candidates={analysis.reEngagementCandidates} />
      </SectionShell>
    </div>
  );
}
