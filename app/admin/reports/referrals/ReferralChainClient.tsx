"use client";

// app/admin/reports/referrals/ReferralChainClient.tsx
// Phase 4.5 — Referral chain visualization (client).
//
// Renders:
//   1. Header strip of 4 KPI chips.
//   2. Two-column top-referrer leaderboard (by transitive referrals and by
//      transitive revenue).
//   3. Hand-rolled SVG layout — one radial-style tree per chain root, laid
//      out left-to-right across the canvas. No external graph deps.
//
// Interaction: hover (tooltip), click (highlight subtree / dim the rest).

import { useMemo, useState } from "react";
import type { ReferralGraph, ReferralGraphNode } from "@/lib/domain/referral-graph";

// ─── Formatting helpers ─────────────────────────────────────────────────────

function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

// ─── Layout primitives ──────────────────────────────────────────────────────
//
// Strategy: build adjacency, find chain roots (no referredBy set within the
// graph), compute each subtree's "leaf count", then do a bucketed-y layout per
// root. Each generation goes one Y row deeper; siblings fan horizontally with
// width proportional to their leaf-count, so subtree widths never overlap.
// Roots are placed left-to-right at top.

interface PositionedNode {
  node: ReferralGraphNode;
  x: number;
  y: number;
  radius: number;
  depth: number;
  rootId: string;
  /** All descendants (transitive) of this node — cached for highlight-on-click. */
  descendants: Set<string>;
}

interface LayoutResult {
  positions: Map<string, PositionedNode>;
  edges: Array<{ from: string; to: string }>;
  width: number;
  height: number;
  maxDepth: number;
}

const PADDING_X = 40;
const PADDING_Y = 60;
const ROW_HEIGHT = 110;
const LEAF_WIDTH = 90; // px allocated per leaf in the bucketed layout
const ROOT_GAP = 50;   // px between adjacent root subtrees
const MIN_RADIUS = 14;
const MAX_RADIUS = 36;

function nodeRadius(transitiveCount: number, maxTransitive: number): number {
  if (maxTransitive <= 0) return MIN_RADIUS;
  const t = Math.sqrt(Math.max(0, transitiveCount)) / Math.sqrt(maxTransitive);
  return MIN_RADIUS + t * (MAX_RADIUS - MIN_RADIUS);
}

function buildLayout(graph: ReferralGraph): LayoutResult {
  const nodesById = new Map(graph.nodes.map((n) => [n.clientId, n]));

  // Adjacency: parent -> children
  const children = new Map<string, string[]>();
  for (const e of graph.edges) {
    const arr = children.get(e.from);
    if (arr) arr.push(e.to);
    else children.set(e.from, [e.to]);
  }

  // Roots = nodes whose referredBy is null AND who have at least one child.
  // Also include "orphan-with-children" nodes whose referredBy points outside
  // the graph (these still show as roots).
  const roots: ReferralGraphNode[] = [];
  for (const n of graph.nodes) {
    const isInternalRoot =
      !n.referredBy || !nodesById.has(n.referredBy);
    const hasChildren = (children.get(n.clientId) ?? []).length > 0;
    if (isInternalRoot && hasChildren) roots.push(n);
  }

  // Sort roots: largest subtree first so big chains anchor the left side.
  roots.sort((a, b) => b.transitiveReferralCount - a.transitiveReferralCount);

  // Precompute leaf-count (subtree leaves) for the bucketed layout, plus
  // descendant set for click highlighting.
  const leafCount = new Map<string, number>();
  const descendants = new Map<string, Set<string>>();
  const visiting = new Set<string>();

  function computeLeaves(id: string): number {
    if (leafCount.has(id)) return leafCount.get(id)!;
    if (visiting.has(id)) {
      leafCount.set(id, 1);
      descendants.set(id, new Set());
      return 1;
    }
    visiting.add(id);
    const kids = children.get(id) ?? [];
    const desc = new Set<string>();
    let leaves = 0;
    if (kids.length === 0) {
      leaves = 1;
    } else {
      for (const c of kids) {
        leaves += computeLeaves(c);
        desc.add(c);
        for (const sub of descendants.get(c) ?? []) desc.add(sub);
      }
    }
    leafCount.set(id, leaves);
    descendants.set(id, desc);
    visiting.delete(id);
    return leaves;
  }

  for (const r of roots) computeLeaves(r.clientId);

  const maxTransitive = roots.reduce(
    (max, r) => Math.max(max, r.transitiveReferralCount),
    0,
  );

  // Lay each root subtree out as a horizontal block.
  const positions = new Map<string, PositionedNode>();
  let cursorX = PADDING_X;
  let maxDepth = 0;
  let maxBottomY = PADDING_Y + 80;

  function place(id: string, blockLeftX: number, blockRightX: number, depth: number, rootId: string) {
    const node = nodesById.get(id);
    if (!node) return;
    const cx = (blockLeftX + blockRightX) / 2;
    const cy = PADDING_Y + depth * ROW_HEIGHT;
    if (depth > maxDepth) maxDepth = depth;
    if (cy > maxBottomY) maxBottomY = cy;

    positions.set(id, {
      node,
      x: cx,
      y: cy,
      radius: nodeRadius(node.transitiveReferralCount, maxTransitive),
      depth,
      rootId,
      descendants: descendants.get(id) ?? new Set(),
    });

    const kids = children.get(id) ?? [];
    if (kids.length === 0) return;
    const totalLeaves = kids.reduce((s, c) => s + (leafCount.get(c) ?? 1), 0);
    let runningX = blockLeftX;
    for (const c of kids) {
      const childLeaves = leafCount.get(c) ?? 1;
      const childWidth = ((blockRightX - blockLeftX) * childLeaves) / Math.max(1, totalLeaves);
      const childLeft = runningX;
      const childRight = runningX + childWidth;
      place(c, childLeft, childRight, depth + 1, rootId);
      runningX = childRight;
    }
  }

  for (const root of roots) {
    const leaves = leafCount.get(root.clientId) ?? 1;
    const width = Math.max(LEAF_WIDTH, leaves * LEAF_WIDTH);
    place(root.clientId, cursorX, cursorX + width, 0, root.clientId);
    cursorX += width + ROOT_GAP;
  }

  const layoutWidth = Math.max(800, cursorX - ROOT_GAP + PADDING_X);
  const layoutHeight = maxBottomY + PADDING_Y;

  return {
    positions,
    edges: graph.edges,
    width: layoutWidth,
    height: layoutHeight,
    maxDepth,
  };
}

// ─── Subcomponents ──────────────────────────────────────────────────────────

function KpiChip({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
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
        <p
          style={{
            fontSize: "0.65rem",
            color: "var(--charcoal-muted)",
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

function LeaderboardTable({
  title,
  rows,
  formatValue,
  valueLabel,
}: {
  title: string;
  rows: ReferralGraphNode[];
  formatValue: (n: ReferralGraphNode) => string;
  valueLabel: string;
}) {
  return (
    <div style={{ border: "0.5px solid var(--border)", background: "var(--white)" }}>
      <p
        style={{
          fontSize: "0.6rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--charcoal-muted)",
          padding: "0.85rem 1rem",
          borderBottom: "0.5px solid var(--border)",
          margin: 0,
        }}
      >
        {title}
      </p>
      {rows.length === 0 ? (
        <p
          style={{
            padding: "1.5rem 1rem",
            fontSize: "0.78rem",
            color: "var(--charcoal-muted)",
            margin: 0,
            textAlign: "center",
          }}
        >
          No data yet.
        </p>
      ) : (
        <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {rows.slice(0, 10).map((n, i) => (
            <li
              key={n.clientId}
              style={{
                display: "grid",
                gridTemplateColumns: "24px 1fr auto",
                gap: "0.6rem",
                alignItems: "baseline",
                padding: "0.6rem 1rem",
                borderTop: i === 0 ? "none" : "0.5px solid var(--border)",
                fontSize: "0.82rem",
              }}
            >
              <span
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  color: "var(--olive)",
                  fontSize: "1rem",
                }}
              >
                {i + 1}
              </span>
              <span style={{ color: "var(--charcoal)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {n.name}
              </span>
              <span
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  color: "var(--charcoal)",
                  fontSize: "0.95rem",
                  letterSpacing: "0.02em",
                }}
                title={valueLabel}
              >
                {formatValue(n)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ─── Main client component ──────────────────────────────────────────────────

export function ReferralChainClient({ graph }: { graph: ReferralGraph }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const layout = useMemo(() => buildLayout(graph), [graph]);

  // Highlighted set: selected node + its descendants + ancestors (so an entire
  // chain lights up). If nothing selected, fall back to hover for tooltip only.
  const highlightedIds = useMemo(() => {
    if (!selectedId) return null;
    const result = new Set<string>([selectedId]);
    const sel = layout.positions.get(selectedId);
    if (sel) {
      for (const d of sel.descendants) result.add(d);
      // Walk up via parent pointers in the graph.
      const parentOf = new Map(graph.nodes.map((n) => [n.clientId, n.referredBy]));
      let cur: string | null | undefined = parentOf.get(selectedId);
      while (cur) {
        if (result.has(cur)) break;
        result.add(cur);
        cur = parentOf.get(cur);
      }
    }
    return result;
  }, [selectedId, layout, graph.nodes]);

  const topName =
    graph.leaderboardByTransitiveReferrals[0]?.name ??
    graph.leaderboardByTransitiveRevenue[0]?.name ??
    "—";

  const maxDepth = layout.maxDepth + 1; // depth is 0-indexed

  const isEmpty = graph.totalClientsInChains === 0 && graph.edges.length === 0;

  return (
    <div className="page-fade-in" style={{ padding: "2rem", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
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
          Referrals
        </h1>
        <p
          style={{
            fontSize: "0.78rem",
            color: "var(--charcoal-muted)",
            marginTop: "0.5rem",
            maxWidth: 720,
            lineHeight: 1.6,
          }}
        >
          Each client&apos;s referral attribution rolls up through the chain. Transitive revenue
          credits ancestors with the package value of every descendant booking
          (LOST and ARCHIVED projects excluded).
        </p>
      </div>

      {isEmpty ? (
        <div
          style={{
            border: "0.5px solid var(--border)",
            background: "var(--white)",
            padding: "3rem 2rem",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: "0.65rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--olive)",
              marginBottom: "0.75rem",
            }}
          >
            Empty graph
          </p>
          <p
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "1.4rem",
              color: "var(--charcoal)",
              margin: "0 0 0.5rem",
              fontWeight: 300,
            }}
          >
            No referral chains yet.
          </p>
          <p
            style={{
              fontSize: "0.82rem",
              color: "var(--charcoal-muted)",
              margin: 0,
              maxWidth: 480,
              marginInline: "auto",
              lineHeight: 1.6,
            }}
          >
            As clients use referral codes, their attribution will appear here.
          </p>
        </div>
      ) : (
        <>
          {/* KPI strip */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1px",
              background: "var(--border)",
              border: "0.5px solid var(--border)",
              marginBottom: "2rem",
            }}
          >
            <KpiChip
              label="Clients in chains"
              value={graph.totalClientsInChains.toString()}
              hint="Have a referredBy set"
            />
            <KpiChip
              label="Max chain depth"
              value={maxDepth.toString()}
              hint="Deepest generation"
            />
            <KpiChip
              label="Attributable revenue"
              value={formatUsd(graph.totalAttributableRevenueCents)}
              hint="Sum across root subtrees"
            />
            <KpiChip
              label="Top referrer"
              value={topName}
              hint="By transitive count"
            />
          </div>

          {/* Leaderboards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "1.25rem",
              marginBottom: "2rem",
            }}
          >
            <LeaderboardTable
              title="By referrals"
              rows={graph.leaderboardByTransitiveReferrals}
              formatValue={(n) => n.transitiveReferralCount.toString()}
              valueLabel="transitive referrals"
            />
            <LeaderboardTable
              title="By transitive revenue"
              rows={graph.leaderboardByTransitiveRevenue}
              formatValue={(n) => formatUsd(n.transitiveRevenueCents)}
              valueLabel="transitive revenue"
            />
          </div>

          {/* Graph view */}
          <div
            style={{
              border: "0.5px solid var(--border)",
              background: "var(--white)",
            }}
          >
            <div
              style={{
                padding: "0.85rem 1rem",
                borderBottom: "0.5px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <p
                style={{
                  fontSize: "0.6rem",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "var(--charcoal-muted)",
                  margin: 0,
                }}
              >
                Chain graph
              </p>
              {selectedId && (
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  style={{
                    background: "transparent",
                    border: "0.5px solid var(--border-strong)",
                    padding: "0.3rem 0.7rem",
                    fontSize: "0.7rem",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--charcoal-light)",
                    cursor: "pointer",
                  }}
                >
                  Clear selection
                </button>
              )}
            </div>
            <div style={{ padding: "1rem", overflowX: "auto" }}>
              <ReferralGraphSvg
                layout={layout}
                hoveredId={hoveredId}
                onHover={setHoveredId}
                selectedId={selectedId}
                onSelect={(id) => setSelectedId((prev) => (prev === id ? null : id))}
                highlightedIds={highlightedIds}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── SVG renderer ───────────────────────────────────────────────────────────

function ReferralGraphSvg({
  layout,
  hoveredId,
  onHover,
  selectedId,
  onSelect,
  highlightedIds,
}: {
  layout: LayoutResult;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  highlightedIds: Set<string> | null;
}) {
  const positions = Array.from(layout.positions.values());
  const tooltipNode = hoveredId ? layout.positions.get(hoveredId) ?? null : null;

  const isDimmed = (id: string): boolean => {
    if (!highlightedIds) return false;
    return !highlightedIds.has(id);
  };

  const isEdgeDimmed = (from: string, to: string): boolean => {
    if (!highlightedIds) return false;
    return !(highlightedIds.has(from) && highlightedIds.has(to));
  };

  return (
    <div style={{ position: "relative", width: "100%", minWidth: 800 }}>
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        preserveAspectRatio="xMidYMid meet"
        width="100%"
        style={{ display: "block", height: "auto" }}
        role="img"
        aria-label="Referral chain graph"
      >
        {/* Edges */}
        <g>
          {layout.edges.map((e) => {
            const from = layout.positions.get(e.from);
            const to = layout.positions.get(e.to);
            if (!from || !to) return null;
            const dimmed = isEdgeDimmed(e.from, e.to);
            // Smooth curve via quadratic bezier — control point midway down.
            const midY = (from.y + to.y) / 2;
            const d = `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`;
            return (
              <path
                key={`${e.from}-${e.to}`}
                d={d}
                fill="none"
                stroke="var(--olive)"
                strokeWidth={dimmed ? 0.6 : 1}
                strokeOpacity={dimmed ? 0.15 : 0.55}
              />
            );
          })}
        </g>

        {/* Nodes */}
        <g>
          {positions.map((p) => {
            const dimmed = isDimmed(p.node.clientId);
            const isSelected = selectedId === p.node.clientId;
            const isHovered = hoveredId === p.node.clientId;
            return (
              <g
                key={p.node.clientId}
                transform={`translate(${p.x},${p.y})`}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => onHover(p.node.clientId)}
                onMouseLeave={() => onHover(null)}
                onClick={() => onSelect(p.node.clientId)}
                opacity={dimmed ? 0.2 : 1}
              >
                <circle
                  r={p.radius}
                  fill="var(--white)"
                  stroke={isSelected || isHovered ? "var(--olive)" : "var(--olive)"}
                  strokeWidth={isSelected ? 1.4 : 0.5}
                />
                {/* Tier badge in upper-right corner */}
                {p.node.tier ? (
                  <g transform={`translate(${p.radius * 0.65},${-p.radius * 0.65})`}>
                    <circle
                      r={7}
                      fill="var(--olive)"
                      stroke="var(--white)"
                      strokeWidth={0.5}
                    />
                    <text
                      y={2.5}
                      textAnchor="middle"
                      fontSize={8}
                      fill="var(--white)"
                      fontFamily="'Jost', sans-serif"
                      fontWeight={500}
                    >
                      {p.node.tier}
                    </text>
                  </g>
                ) : null}
                {/* Centered count label */}
                <text
                  y={p.radius + 14}
                  textAnchor="middle"
                  fontSize={10}
                  fill="var(--charcoal)"
                  fontFamily="'Jost', sans-serif"
                >
                  {p.node.name.length > 18 ? `${p.node.name.slice(0, 16)}…` : p.node.name}
                </text>
                <text
                  y={3}
                  textAnchor="middle"
                  fontSize={11}
                  fill="var(--charcoal)"
                  fontFamily="'Cormorant Garamond', serif"
                  fontWeight={400}
                >
                  {p.node.transitiveReferralCount > 0 ? p.node.transitiveReferralCount : ""}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Tooltip — absolutely positioned, anchored to the hovered node's
          approximate viewport coordinates. Because we use viewBox + percent
          width, we cannot compute exact pixel coords without a ref. Render
          as a fixed-position panel near the top of the canvas instead. */}
      {tooltipNode && (
        <div
          style={{
            position: "absolute",
            top: "0.5rem",
            right: "0.5rem",
            background: "var(--white)",
            border: "0.5px solid var(--border-strong)",
            padding: "0.6rem 0.8rem",
            fontSize: "0.74rem",
            maxWidth: 260,
            pointerEvents: "none",
            boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "1.05rem",
              color: "var(--charcoal)",
              lineHeight: 1.2,
            }}
          >
            {tooltipNode.node.name}
          </p>
          {tooltipNode.node.email && (
            <p
              style={{
                margin: "0.15rem 0 0.5rem",
                fontSize: "0.65rem",
                color: "var(--charcoal-muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {tooltipNode.node.email}
            </p>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.15rem 0.6rem" }}>
            <span style={{ color: "var(--charcoal-muted)" }}>Direct</span>
            <span style={{ color: "var(--charcoal)" }}>{tooltipNode.node.directReferralCount}</span>
            <span style={{ color: "var(--charcoal-muted)" }}>Transitive</span>
            <span style={{ color: "var(--charcoal)" }}>{tooltipNode.node.transitiveReferralCount}</span>
            <span style={{ color: "var(--charcoal-muted)" }}>Revenue</span>
            <span style={{ color: "var(--charcoal)" }}>
              {formatUsd(tooltipNode.node.transitiveRevenueCents)}
            </span>
            {tooltipNode.node.tier ? (
              <>
                <span style={{ color: "var(--charcoal-muted)" }}>Tier</span>
                <span style={{ color: "var(--olive)" }}>{tooltipNode.node.tier}</span>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
