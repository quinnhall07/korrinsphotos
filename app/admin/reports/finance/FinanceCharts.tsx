"use client";

// app/admin/reports/finance/FinanceCharts.tsx
// Phase 3.1 — recharts-driven chart bundle for the Finance dashboard.
// Client component because recharts needs a real DOM to lay out SVG.
//
// Data is passed in pre-aggregated from the server page; no fetching here.

import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const OLIVE = "#6B7845";
const OLIVE_LIGHT = "#8A9A5A";
const CHARCOAL = "#2A2A28";
const CHARCOAL_MUTED = "#8A8A85";
const SLICE_COLORS = [
  "#6B7845", "#8A9A5A", "#B5BB80", "#4A5535", "#3A4528",
  "#A8B07A", "#5E6940", "#7B884E", "#D2D7AC", "#2F3920",
];

interface MonthlyPoint { month: string; cents: number; }
interface Slice { name: string; cents: number; }
interface FunnelStage { stage: string; count: number; }

function formatUsdShort(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
  return `$${dollars.toFixed(0)}`;
}

function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function FinanceCharts({
  monthly,
  typeSlices,
  sourceSlices,
  funnel,
}: {
  monthly: MonthlyPoint[];
  typeSlices: Slice[];
  sourceSlices: Slice[];
  funnel: FunnelStage[];
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
      {/* Monthly revenue bar — full width row */}
      <ChartCard title="Monthly Revenue · Last 12 Months" colSpan={2}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={monthly} margin={{ top: 16, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid stroke="rgba(42,42,40,0.08)" vertical={false} />
            <XAxis dataKey="month" stroke={CHARCOAL_MUTED} fontSize={11} tickLine={false} axisLine={false} />
            <YAxis
              stroke={CHARCOAL_MUTED}
              fontSize={11}
              tickFormatter={formatUsdShort}
              tickLine={false}
              axisLine={false}
              width={50}
            />
            <Tooltip
              cursor={{ fill: "rgba(107,120,69,0.06)" }}
              contentStyle={{
                background: "var(--white, #FAF9F6)",
                border: "0.5px solid rgba(42,42,40,0.22)",
                fontSize: "0.78rem",
                color: CHARCOAL,
              }}
              formatter={(value) => formatUsd(typeof value === "number" ? value : Number(value) || 0)}
            />
            <Bar dataKey="cents" fill={OLIVE} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Revenue by session type — pie */}
      <ChartCard title="Revenue by Session Type">
        {typeSlices.length === 0 ? (
          <EmptyState>No paid revenue in the window yet.</EmptyState>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Tooltip
                formatter={(value) => formatUsd(typeof value === "number" ? value : Number(value) || 0)}
                contentStyle={{
                  background: "var(--white, #FAF9F6)",
                  border: "0.5px solid rgba(42,42,40,0.22)",
                  fontSize: "0.78rem",
                  color: CHARCOAL,
                }}
              />
              <Legend
                verticalAlign="bottom"
                wrapperStyle={{ fontSize: "0.72rem", color: CHARCOAL_MUTED }}
              />
              <Pie
                data={typeSlices}
                dataKey="cents"
                nameKey="name"
                cx="50%"
                cy="45%"
                outerRadius={75}
                innerRadius={40}
                stroke="var(--white, #FAF9F6)"
              >
                {typeSlices.map((s, i) => (
                  <Cell key={s.name} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Revenue by source — pie */}
      <ChartCard title="Revenue by First-Touch Source">
        {sourceSlices.length === 0 ? (
          <EmptyState>No attribution data yet.</EmptyState>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Tooltip
                formatter={(value) => formatUsd(typeof value === "number" ? value : Number(value) || 0)}
                contentStyle={{
                  background: "var(--white, #FAF9F6)",
                  border: "0.5px solid rgba(42,42,40,0.22)",
                  fontSize: "0.78rem",
                  color: CHARCOAL,
                }}
              />
              <Legend
                verticalAlign="bottom"
                wrapperStyle={{ fontSize: "0.72rem", color: CHARCOAL_MUTED }}
              />
              <Pie
                data={sourceSlices}
                dataKey="cents"
                nameKey="name"
                cx="50%"
                cy="45%"
                outerRadius={75}
                innerRadius={40}
                stroke="var(--white, #FAF9F6)"
              >
                {sourceSlices.map((s, i) => (
                  <Cell key={s.name} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Funnel — horizontal bars */}
      <ChartCard title="Pipeline Funnel" colSpan={2}>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={funnel}
            layout="vertical"
            margin={{ top: 8, right: 24, bottom: 8, left: 24 }}
          >
            <CartesianGrid stroke="rgba(42,42,40,0.08)" horizontal={false} />
            <XAxis type="number" stroke={CHARCOAL_MUTED} fontSize={11} tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="stage"
              stroke={CHARCOAL_MUTED}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={80}
            />
            <Tooltip
              cursor={{ fill: "rgba(107,120,69,0.06)" }}
              contentStyle={{
                background: "var(--white, #FAF9F6)",
                border: "0.5px solid rgba(42,42,40,0.22)",
                fontSize: "0.78rem",
                color: CHARCOAL,
              }}
            />
            <Bar dataKey="count" fill={OLIVE_LIGHT} radius={[0, 2, 2, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({
  title,
  colSpan,
  children,
}: {
  title: string;
  colSpan?: number;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        gridColumn: colSpan === 2 ? "1 / -1" : undefined,
        border: "0.5px solid var(--border)",
        padding: "1.25rem",
        background: "var(--white)",
      }}
    >
      <p
        style={{
          fontSize: "0.6rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: CHARCOAL_MUTED,
          marginBottom: "1rem",
        }}
      >
        {title}
      </p>
      {children}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        height: 260,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: CHARCOAL_MUTED,
        fontSize: "0.78rem",
      }}
    >
      {children}
    </div>
  );
}
