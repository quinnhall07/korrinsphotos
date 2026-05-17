"use client";

// app/admin/calendar/CapacityHeatmapClient.tsx
//
// Phase 3.14 — weekly capacity heatmap.
//
// Renders the 64-week bucket list (12 back + 52 forward) as a grid of cells
// coloured by load ratio (shoots / weekly cap). Clicking a cell opens a side
// panel showing the projects in that week.
//
// Color scale (uses --olive-dim / --olive-light / --olive plus amber/red):
//   ratio < 0.5  →  --olive-dim
//   0.5 ≤ r < 1  →  --olive-light
//   1 ≤ r < 1.5  →  amber  (#D97706)
//   r ≥ 1.5      →  red    (#DC2626)
//
// All math is "now"-pinned at mount so the active-week highlight stays stable
// across re-renders within a single mount.

import { useMemo, useState } from "react";
import Link from "next/link";
import type { BucketProject, WeekBucket } from "@/lib/domain/capacity";
import {
  assessFarFutureRisk,
  farFutureRiskColor,
  type FarFutureRiskInfo,
} from "@/lib/far-future-risk";
import type { ProjectStatus } from "@/lib/db/projects";

interface Props {
  buckets: WeekBucket[];
  weeklyCap: number;
}

const AMBER = "#D97706";
const RED = "#DC2626";

/** Day-name labels for the side panel. */
const WEEK_FMT: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
};

/** Cell background by load ratio. Uses the project's olive palette + amber/red. */
function cellBackground(count: number, cap: number): string {
  if (count <= 0) return "var(--white)";
  const ratio = count / cap;
  if (ratio < 0.5) return "var(--olive-dim)";
  if (ratio < 1) return "var(--olive-light)";
  if (ratio < 1.5) return AMBER;
  return RED;
}

/** Foreground for the count chip — picks a readable colour for each bg. */
function cellForeground(count: number, cap: number): string {
  if (count <= 0) return "var(--charcoal-muted)";
  const ratio = count / cap;
  // The amber + red cells need light text.
  if (ratio >= 1) return "var(--white)";
  // Olive cells stay charcoal.
  return "var(--charcoal)";
}

function fmtMonthDay(iso: string): string {
  // Render the Monday-UTC ISO date as "Mon Jan 14" in en-US.
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function fmtShootDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", WEEK_FMT);
  } catch {
    return iso;
  }
}

/**
 * Phase 13.16 — far-future-risk lookup for a bucket project. Pure wrapper
 * around `assessFarFutureRisk` that materialises the ISO inputs into Dates.
 */
function bucketProjectRisk(p: BucketProject, now: Date): FarFutureRiskInfo {
  return assessFarFutureRisk({
    shootDate: p.shootDate ? new Date(p.shootDate) : null,
    depositPaidAt: p.depositPaidAt ? new Date(p.depositPaidAt) : null,
    lastContactedAt: p.lastContactedAt ? new Date(p.lastContactedAt) : null,
    lastRespondedAt: p.lastRespondedAt ? new Date(p.lastRespondedAt) : null,
    status: p.status as ProjectStatus,
    now,
  });
}

export function CapacityHeatmapClient({ buckets, weeklyCap }: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Pin "now" at mount so risk math stays stable across re-renders within
  // a single page visit.
  const [now] = useState<Date>(() => new Date());

  // Bucket lookup for the side panel.
  const bucketByKey = useMemo(() => {
    const m = new Map<string, WeekBucket>();
    for (const b of buckets) m.set(b.weekStart, b);
    return m;
  }, [buckets]);

  // Phase 13.16 — per-bucket worst-case far-future risk (FLAG or STALE only).
  // Used to render a small warning glyph in the cell corner.
  const bucketWarning = useMemo(() => {
    const out = new Map<string, "FLAG" | "STALE">();
    for (const b of buckets) {
      let worst: "FLAG" | "STALE" | null = null;
      for (const p of b.projects) {
        const r = bucketProjectRisk(p, now).risk;
        if (r === "STALE") {
          worst = "STALE";
          break;
        }
        if (r === "FLAG" && worst === null) worst = "FLAG";
      }
      if (worst) out.set(b.weekStart, worst);
    }
    return out;
  }, [buckets, now]);

  const selected = selectedKey ? bucketByKey.get(selectedKey) ?? null : null;

  // Resolve which key is "this week" so we can outline it.
  const currentWeekKey = useMemo(() => {
    const now = new Date();
    const u = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const dow = u.getUTCDay();
    const mondayOffset = (dow + 6) % 7;
    u.setUTCDate(u.getUTCDate() - mondayOffset);
    return u.toISOString().slice(0, 10);
  }, []);

  // Aggregate stats for the header strip.
  const stats = useMemo(() => {
    let totalShoots = 0;
    let overCap = 0;
    let atRisk = 0;
    for (const b of buckets) {
      totalShoots += b.shootCount;
      if (b.shootCount > weeklyCap) overCap += 1;
      else if (b.shootCount === weeklyCap) atRisk += 1;
    }
    return { totalShoots, overCap, atRisk };
  }, [buckets, weeklyCap]);

  return (
    <div className="page-fade-in" style={{ padding: "2rem" }}>
      {/* Header */}
      <div
        style={{
          marginBottom: "1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
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
            Capacity
          </p>
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "2rem",
              fontWeight: 300,
              margin: 0,
            }}
          >
            Booking heatmap
          </h2>
          <p
            style={{
              fontFamily: "'Jost', sans-serif",
              fontSize: "0.8rem",
              color: "var(--charcoal-muted)",
              marginTop: "0.4rem",
            }}
          >
            12 weeks back · 52 weeks ahead · cap {weeklyCap} shoot
            {weeklyCap === 1 ? "" : "s"}/week
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "1rem",
            fontFamily: "'Jost', sans-serif",
            fontSize: "0.75rem",
            color: "var(--charcoal-muted)",
            flexWrap: "wrap",
          }}
        >
          <Stat label="Total shoots" value={stats.totalShoots} />
          <Stat label="At cap" value={stats.atRisk} />
          <Stat label="Over cap" value={stats.overCap} />
        </div>
      </div>

      {/* Legend */}
      <Legend cap={weeklyCap} />

      {/* Heatmap grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(13, minmax(0, 1fr))",
          gap: "0.4rem",
          marginTop: "1.25rem",
        }}
      >
        {buckets.map((b) => {
          const isSelected = b.weekStart === selectedKey;
          const isCurrent = b.weekStart === currentWeekKey;
          const bg = cellBackground(b.shootCount, weeklyCap);
          const fg = cellForeground(b.shootCount, weeklyCap);
          const warning = bucketWarning.get(b.weekStart) ?? null;
          const warningColor =
            warning === "STALE" ? "#DC2626" : warning === "FLAG" ? "#D97706" : null;
          return (
            <button
              key={b.weekStart}
              type="button"
              onClick={() =>
                setSelectedKey((prev) => (prev === b.weekStart ? null : b.weekStart))
              }
              title={`Week of ${fmtMonthDay(b.weekStart)} — ${b.shootCount} shoot${
                b.shootCount === 1 ? "" : "s"
              }${warning ? ` · ${warning.toLowerCase()} far-future risk` : ""}`}
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: "0.25rem",
                padding: "0.55rem 0.6rem",
                minHeight: "76px",
                background: bg,
                color: fg,
                border: "0.5px solid",
                borderColor: isSelected
                  ? "var(--charcoal)"
                  : isCurrent
                  ? "var(--olive)"
                  : "var(--border-strong)",
                cursor: "pointer",
                fontFamily: "'Jost', sans-serif",
                textAlign: "left",
                transition: "transform 0.1s",
                boxShadow: isSelected ? "0 0 0 1px var(--charcoal) inset" : "none",
              }}
            >
              {warningColor && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: "3px",
                    right: "4px",
                    fontSize: "0.7rem",
                    color: warningColor,
                    lineHeight: 1,
                    fontWeight: 600,
                    textShadow: "0 0 2px rgba(255,255,255,0.85)",
                  }}
                  title={`Far-future risk: ${warning?.toLowerCase()}`}
                >
                  ⚠
                </span>
              )}
              <span
                style={{
                  fontSize: "0.62rem",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  opacity: 0.85,
                }}
              >
                {fmtMonthDay(b.weekStart).replace(/^[A-Za-z]+ /, "")}
              </span>
              <span
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: "1.4rem",
                  fontWeight: 300,
                  lineHeight: 1,
                }}
              >
                {b.shootCount}
              </span>
              <span
                style={{
                  fontSize: "0.6rem",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  opacity: 0.7,
                }}
              >
                of {weeklyCap}
              </span>
            </button>
          );
        })}
      </div>

      {/* Side panel — slides in from the right when a week is selected */}
      <SidePanel
        bucket={selected}
        weeklyCap={weeklyCap}
        now={now}
        onClose={() => setSelectedKey(null)}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: "0.4rem",
      }}
    >
      <span
        style={{
          fontSize: "0.62rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--olive)",
        }}
      >
        {label}
      </span>
      <strong
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "1.4rem",
          fontWeight: 300,
          color: "var(--charcoal)",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function Legend({ cap }: { cap: number }) {
  const swatches: { label: string; bg: string; fg: string }[] = [
    { label: "Empty", bg: "var(--white)", fg: "var(--charcoal-muted)" },
    { label: `<${Math.ceil(cap * 0.5)}`, bg: "var(--olive-dim)", fg: "var(--charcoal)" },
    {
      label: `${Math.ceil(cap * 0.5)}–${cap - 1}`,
      bg: "var(--olive-light)",
      fg: "var(--charcoal)",
    },
    { label: `${cap}+ at cap`, bg: AMBER, fg: "var(--white)" },
    { label: "Over cap", bg: RED, fg: "var(--white)" },
  ];
  return (
    <div
      style={{
        display: "flex",
        gap: "0.5rem",
        flexWrap: "wrap",
        marginTop: "0.5rem",
        alignItems: "center",
      }}
    >
      {swatches.map((s) => (
        <div
          key={s.label}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.25rem 0.6rem",
            background: s.bg,
            color: s.fg,
            border: "0.5px solid var(--border-strong)",
            fontFamily: "'Jost', sans-serif",
            fontSize: "0.65rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          {s.label}
        </div>
      ))}
    </div>
  );
}

function SidePanel({
  bucket,
  weeklyCap,
  now,
  onClose,
}: {
  bucket: WeekBucket | null;
  weeklyCap: number;
  now: Date;
  onClose: () => void;
}) {
  if (!bucket) return null;

  return (
    <>
      {/* Backdrop — clicking it closes the panel. */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(42,42,40,0.18)",
          zIndex: 800,
        }}
      />

      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(420px, 100vw)",
          background: "var(--white)",
          borderLeft: "0.5px solid var(--border-strong)",
          zIndex: 810,
          padding: "1.5rem 1.5rem 2rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          overflowY: "auto",
          fontFamily: "'Jost', sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "1rem",
          }}
        >
          <div>
            <p
              style={{
                fontSize: "0.62rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--olive)",
                margin: 0,
              }}
            >
              Week of
            </p>
            <h3
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "1.5rem",
                fontWeight: 300,
                margin: "0.15rem 0 0",
              }}
            >
              {fmtMonthDay(bucket.weekStart)}
            </h3>
            <p
              style={{
                fontSize: "0.78rem",
                color: "var(--charcoal-muted)",
                marginTop: "0.35rem",
              }}
            >
              {bucket.shootCount} of {weeklyCap} shoot
              {weeklyCap === 1 ? "" : "s"} booked
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "0.5px solid var(--border-strong)",
              padding: "0.35rem 0.7rem",
              fontFamily: "'Jost', sans-serif",
              fontSize: "0.65rem",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              cursor: "pointer",
              color: "var(--charcoal)",
            }}
          >
            Close
          </button>
        </div>

        {bucket.projects.length === 0 && (
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--charcoal-muted)",
              fontStyle: "italic",
              margin: 0,
            }}
          >
            No shoots booked this week.
          </p>
        )}

        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          {bucket.projects.map((p) => {
            const risk = bucketProjectRisk(p, now);
            const riskColor = farFutureRiskColor(risk.risk);
            return (
            <li
              key={p.id}
              style={{
                border: "0.5px solid var(--border)",
                padding: "0.85rem 0.95rem",
                background: "var(--white)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: "0.5rem",
                }}
              >
                <Link
                  href={`/admin/projects/${p.id}`}
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: "1.05rem",
                    fontWeight: 400,
                    color: "var(--charcoal)",
                    textDecoration: "none",
                  }}
                >
                  {p.title}
                </Link>
                <span
                  style={{
                    fontSize: "0.62rem",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "var(--olive)",
                  }}
                >
                  {p.sessionType || "—"}
                </span>
              </div>
              <p
                style={{
                  margin: "0.3rem 0 0",
                  fontSize: "0.78rem",
                  color: "var(--charcoal-muted)",
                }}
              >
                {p.clientName || "Unnamed client"}
                {" · "}
                {fmtShootDate(p.shootDate)}
                {" · "}
                travel: —
              </p>
              <p
                style={{
                  margin: "0.2rem 0 0",
                  fontSize: "0.7rem",
                  color: "var(--charcoal-muted)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Status · {p.status.replace(/_/g, " ").toLowerCase()}
              </p>
              {risk.risk !== "NONE" && riskColor && (
                <p
                  style={{
                    margin: "0.45rem 0 0",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    padding: "0.2rem 0.5rem",
                    border: `0.5px solid ${riskColor}`,
                    color: riskColor,
                    fontSize: "0.65rem",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                  title={risk.reason}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: riskColor,
                    }}
                  />
                  {risk.risk}: {risk.reason.replace(/^[A-Z]+:\s*/, "")}
                </p>
              )}
            </li>
            );
          })}
        </ul>
      </aside>
    </>
  );
}
