"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProjectStatus } from "@/lib/db/projects";
import { toast } from "@/components/ui/Toaster";
import { bulkArchiveProjects } from "./actions";

type PipelineProject = {
  id: string;
  clientId: string;
  firstName: string;
  lastName: string;
  email: string;
  sessionType: string;
  title: string;
  status: string;
  leadScore: number;
  estimatedValue: number | null;
  createdAt: string;
  /** ISO timestamp of the most recent status change (or createdAt fallback). */
  lastStatusChangeIso: string | null;
  /** ISO shoot date, if scheduled. */
  shootDateIso: string | null;
  /** ISO last-contacted timestamp. */
  lastContactedIso: string | null;
};

interface Props {
  projects: PipelineProject[];
}

const PIPELINE_COLUMNS: { id: ProjectStatus; label: string; bg: string }[] = [
  { id: "INQUIRY", label: "Inquiry", bg: "#FEF3C7" },
  { id: "QUALIFYING", label: "Qualifying", bg: "#E0E7FF" },
  { id: "PROPOSAL_SENT", label: "Proposal Sent", bg: "#DBEAFE" },
  { id: "CONTRACT_SENT", label: "Contract Sent", bg: "#FED7AA" },
  { id: "DEPOSIT_PENDING", label: "Deposit Pending", bg: "#FEE2E2" },
  { id: "BOOKED", label: "Booked", bg: "#D1FAE5" },
  { id: "SHOOT_READY", label: "Shoot Ready", bg: "#CCFBF1" },
  { id: "IN_EDITING", label: "In Editing", bg: "#E0E7FF" },
  { id: "GALLERY_DELIVERED", label: "Delivered", bg: "#F3E8FF" },
  { id: "COMPLETED", label: "Completed", bg: "#F1F5F9" },
];

/**
 * Stage SLA in days. If a project sits in a stage longer than its SLA,
 * the card/row is flagged as "rotting" with a red accent.
 *
 * Exported so other surfaces (dashboards, exports, tests) can stay in sync.
 */
export function stageSla(status: ProjectStatus | string): number {
  switch (status) {
    case "INQUIRY":
      return 2;
    case "QUALIFYING":
      return 3;
    case "PROPOSAL_SENT":
      return 5;
    case "NEGOTIATING":
      return 5;
    case "CONTRACT_SENT":
      return 7;
    case "DEPOSIT_PENDING":
      return 3;
    case "SHOOT_READY":
      return 7;
    case "IN_EDITING":
      return 14;
    case "GALLERY_DELIVERED":
      return 7;
    default:
      return 999;
  }
}

const ROT_RED = "#B91C1C";

const VIEW_STORAGE_KEY = "korrin.pipeline.view";
const SAVED_VIEWS_STORAGE_KEY = "korrin.pipeline.savedViews";

type ViewMode = "kanban" | "table";

type SavedView = {
  id: string;
  name: string;
  /** Built-in defaults are not editable / removable. */
  builtIn?: boolean;
  /** Predicate descriptor — applied client-side. */
  filter: SavedViewFilter;
};

type SavedViewFilter =
  | { kind: "HOT_LEADS" }
  | { kind: "STUCK_OVER_7D" }
  | { kind: "GALLERIES_OVERDUE" }
  | { kind: "THIS_WEEKS_SHOOTS" }
  | { kind: "AWAITING_DEPOSIT" }
  | { kind: "ALL" };

const DEFAULT_SAVED_VIEWS: SavedView[] = [
  { id: "all", name: "All projects", builtIn: true, filter: { kind: "ALL" } },
  { id: "hot-leads", name: "Hot leads", builtIn: true, filter: { kind: "HOT_LEADS" } },
  { id: "stuck-7d", name: "Stuck >7d", builtIn: true, filter: { kind: "STUCK_OVER_7D" } },
  {
    id: "galleries-overdue",
    name: "Galleries overdue",
    builtIn: true,
    filter: { kind: "GALLERIES_OVERDUE" },
  },
  {
    id: "this-weeks-shoots",
    name: "This week's shoots",
    builtIn: true,
    filter: { kind: "THIS_WEEKS_SHOOTS" },
  },
  {
    id: "awaiting-deposit",
    name: "Awaiting deposit",
    builtIn: true,
    filter: { kind: "AWAITING_DEPOSIT" },
  },
];

const TERMINAL_STATUSES = new Set<string>(["COMPLETED", "LOST", "ARCHIVED"]);

function daysBetween(fromIso: string | null, now: number): number {
  if (!fromIso) return 0;
  const t = Date.parse(fromIso);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, (now - t) / 86_400_000);
}

function isProjectRotting(p: PipelineProject, now: number): boolean {
  if (TERMINAL_STATUSES.has(p.status)) return false;
  const days = daysBetween(p.lastStatusChangeIso, now);
  return days > stageSla(p.status);
}

function applyViewFilter(
  projects: PipelineProject[],
  filter: SavedViewFilter,
  now: number
): PipelineProject[] {
  switch (filter.kind) {
    case "ALL":
      return projects;
    case "HOT_LEADS":
      return projects.filter(
        (p) =>
          p.leadScore >= 60 &&
          (p.status === "INQUIRY" || p.status === "QUALIFYING" || p.status === "PROPOSAL_SENT")
      );
    case "STUCK_OVER_7D":
      return projects.filter(
        (p) => !TERMINAL_STATUSES.has(p.status) && daysBetween(p.lastStatusChangeIso, now) > 7
      );
    case "GALLERIES_OVERDUE":
      return projects.filter(
        (p) => p.status === "IN_EDITING" && daysBetween(p.lastStatusChangeIso, now) > 14
      );
    case "THIS_WEEKS_SHOOTS": {
      const horizon = now + 7 * 86_400_000;
      return projects.filter((p) => {
        if (p.status !== "BOOKED" && p.status !== "SHOOT_READY") return false;
        if (!p.shootDateIso) return false;
        const t = Date.parse(p.shootDateIso);
        if (Number.isNaN(t)) return false;
        return t >= now && t <= horizon;
      });
    }
    case "AWAITING_DEPOSIT":
      return projects.filter((p) => p.status === "DEPOSIT_PENDING");
    default:
      return projects;
  }
}

type SortKey =
  | "client"
  | "sessionType"
  | "status"
  | "leadScore"
  | "estimatedValue"
  | "daysAtStage"
  | "lastContacted";

type SortDir = "asc" | "desc";

function getSortValue(p: PipelineProject, key: SortKey, now: number): string | number {
  switch (key) {
    case "client":
      return `${p.firstName} ${p.lastName}`.trim().toLowerCase();
    case "sessionType":
      return (p.sessionType || "").toLowerCase();
    case "status":
      return p.status.toLowerCase();
    case "leadScore":
      return p.leadScore;
    case "estimatedValue":
      return p.estimatedValue ?? -1;
    case "daysAtStage":
      return daysBetween(p.lastStatusChangeIso, now);
    case "lastContacted":
      return p.lastContactedIso ? Date.parse(p.lastContactedIso) : -1;
  }
}

function compareProjects(
  a: PipelineProject,
  b: PipelineProject,
  key: SortKey,
  dir: SortDir,
  now: number
): number {
  const av = getSortValue(a, key, now);
  const bv = getSortValue(b, key, now);
  let cmp: number;
  if (typeof av === "number" && typeof bv === "number") {
    cmp = av - bv;
  } else {
    cmp = String(av).localeCompare(String(bv));
  }
  return dir === "asc" ? cmp : -cmp;
}

export function ProjectsPipelineClientPage({ projects }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Stable "now" pinned at mount for SLA / sort math — refreshes when
  // the route revalidates (which re-mounts with fresh props).
  const [now] = useState<number>(() => Date.now());

  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [savedViews, setSavedViews] = useState<SavedView[]>(DEFAULT_SAVED_VIEWS);
  const [activeViewId, setActiveViewId] = useState<string>("all");

  // Table-view state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("leadScore");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Hydrate persisted preferences from localStorage on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const persistedView = window.localStorage.getItem(VIEW_STORAGE_KEY);
      if (persistedView === "kanban" || persistedView === "table") {
        setViewMode(persistedView);
      }
    } catch {
      /* ignore */
    }
    try {
      const raw = window.localStorage.getItem(SAVED_VIEWS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedView[];
        if (Array.isArray(parsed)) {
          // Merge: defaults first, then any user-saved that aren't a default id.
          const defaultIds = new Set(DEFAULT_SAVED_VIEWS.map((v) => v.id));
          const userViews = parsed.filter((v) => v && v.id && !defaultIds.has(v.id));
          setSavedViews([...DEFAULT_SAVED_VIEWS, ...userViews]);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Persist view mode whenever it changes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
    } catch {
      /* ignore */
    }
  }, [viewMode]);

  // Persist saved views whenever they change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(SAVED_VIEWS_STORAGE_KEY, JSON.stringify(savedViews));
    } catch {
      /* ignore */
    }
  }, [savedViews]);

  // Resolve active view → filtered project set.
  const activeView = useMemo(
    () => savedViews.find((v) => v.id === activeViewId) ?? DEFAULT_SAVED_VIEWS[0],
    [savedViews, activeViewId]
  );

  const filteredProjects = useMemo(
    () => applyViewFilter(projects, activeView.filter, now),
    [projects, activeView, now]
  );

  // Kanban column stats — recomputed against the visible (filtered) set so the
  // weighted value reflects the active view.
  const columnStats = useMemo(() => {
    const stats: Record<string, { count: number; weightedValue: number; hidden: number }> = {};
    for (const col of PIPELINE_COLUMNS) {
      stats[col.id] = { count: 0, weightedValue: 0, hidden: 0 };
    }
    const visibleSet = new Set(filteredProjects.map((p) => p.id));
    for (const p of projects) {
      const bucket = stats[p.status];
      if (!bucket) continue;
      if (visibleSet.has(p.id)) {
        bucket.count++;
        bucket.weightedValue += (p.estimatedValue || 0) * (p.leadScore / 100);
      } else {
        bucket.hidden++;
      }
    }
    return stats;
  }, [projects, filteredProjects]);

  const sortedTableProjects = useMemo(() => {
    const copy = [...filteredProjects];
    copy.sort((a, b) => compareProjects(a, b, sortKey, sortDir, now));
    return copy;
  }, [filteredProjects, sortKey, sortDir, now]);

  // Clear selection when the visible row set changes (e.g. view switch).
  useEffect(() => {
    setSelectedIds((prev) => {
      const visible = new Set(filteredProjects.map((p) => p.id));
      const next = new Set<string>();
      for (const id of prev) if (visible.has(id)) next.add(id);
      return next;
    });
  }, [filteredProjects]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "client" || key === "sessionType" || key === "status" ? "asc" : "desc");
    }
  };

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllRows = () => {
    setSelectedIds((prev) => {
      if (prev.size === sortedTableProjects.length && sortedTableProjects.length > 0) {
        return new Set();
      }
      return new Set(sortedTableProjects.map((p) => p.id));
    });
  };

  const handleBulkArchive = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const confirmed = window.confirm(
      `Archive ${ids.length} project${ids.length === 1 ? "" : "s"}? This sets their status to ARCHIVED.`
    );
    if (!confirmed) return;
    startTransition(async () => {
      const res = await bulkArchiveProjects(ids);
      if (res.success) {
        toast(`Archived ${res.archivedCount ?? ids.length} project${ids.length === 1 ? "" : "s"}`);
        setSelectedIds(new Set());
        router.refresh();
      } else {
        toast(res.error ?? "Failed to archive projects");
      }
    });
  };

  const handleSaveCurrentView = () => {
    const name = window.prompt(
      "Name this view:",
      `${activeView.name} (copy)`
    );
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const newView: SavedView = {
      id: `user-${Date.now()}`,
      name: trimmed,
      filter: activeView.filter,
    };
    setSavedViews((prev) => [...prev, newView]);
    setActiveViewId(newView.id);
    toast(`Saved view "${trimmed}"`);
  };

  return (
    <div className="page-fade-in" style={{ padding: "2rem" }}>
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
            Pipeline
          </p>
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "2rem",
              fontWeight: 300,
              margin: 0,
            }}
          >
            Project Pipeline
          </h2>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          {/* Saved views dropdown */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.7rem",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "var(--charcoal-muted)",
            }}
          >
            View
            <select
              value={activeViewId}
              onChange={(e) => setActiveViewId(e.target.value)}
              style={{
                fontFamily: "'Jost', sans-serif",
                fontSize: "0.85rem",
                padding: "0.4rem 0.6rem",
                border: "0.5px solid var(--border-strong)",
                background: "white",
                color: "var(--charcoal)",
                minWidth: "180px",
              }}
            >
              <optgroup label="Built-in">
                {savedViews
                  .filter((v) => v.builtIn)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
              </optgroup>
              {savedViews.some((v) => !v.builtIn) && (
                <optgroup label="Saved">
                  {savedViews
                    .filter((v) => !v.builtIn)
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                </optgroup>
              )}
            </select>
          </label>

          <button
            type="button"
            onClick={handleSaveCurrentView}
            style={{
              fontFamily: "'Jost', sans-serif",
              fontSize: "0.75rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "0.5rem 0.85rem",
              border: "0.5px solid var(--border-strong)",
              background: "transparent",
              color: "var(--charcoal)",
              cursor: "pointer",
            }}
            title="Save current filter as a new view"
          >
            Save view
          </button>

          {/* Kanban / Table toggle */}
          <div
            role="tablist"
            aria-label="View mode"
            style={{
              display: "inline-flex",
              border: "0.5px solid var(--border-strong)",
              background: "white",
            }}
          >
            {(["kanban", "table"] as ViewMode[]).map((mode) => {
              const active = viewMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setViewMode(mode)}
                  style={{
                    fontFamily: "'Jost', sans-serif",
                    fontSize: "0.75rem",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    padding: "0.5rem 0.9rem",
                    border: "none",
                    background: active ? "var(--charcoal)" : "transparent",
                    color: active ? "var(--white)" : "var(--charcoal)",
                    cursor: "pointer",
                  }}
                >
                  {mode === "kanban" ? "Kanban" : "Table"}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active filter / result summary */}
      <div
        style={{
          marginBottom: "1rem",
          fontSize: "0.75rem",
          color: "var(--charcoal-muted)",
          display: "flex",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <span>
          Showing <strong style={{ color: "var(--charcoal)" }}>{filteredProjects.length}</strong> of{" "}
          {projects.length} projects
        </span>
        {activeView.id !== "all" && (
          <span>
            Filter: <strong style={{ color: "var(--charcoal)" }}>{activeView.name}</strong>
          </span>
        )}
      </div>

      {viewMode === "kanban" ? (
        <KanbanView
          projects={filteredProjects}
          columnStats={columnStats}
          now={now}
        />
      ) : (
        <TableView
          projects={sortedTableProjects}
          sortKey={sortKey}
          sortDir={sortDir}
          onToggleSort={toggleSort}
          selectedIds={selectedIds}
          onToggleRow={toggleRow}
          onToggleAllRows={toggleAllRows}
          onBulkArchive={handleBulkArchive}
          isPending={isPending}
          now={now}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────  KANBAN VIEW  ───────────────────────────── */

function KanbanView({
  projects,
  columnStats,
  now,
}: {
  projects: PipelineProject[];
  columnStats: Record<string, { count: number; weightedValue: number; hidden: number }>;
  now: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: "1rem",
        overflowX: "auto",
        paddingBottom: "1rem",
        minHeight: "calc(100vh - 240px)",
      }}
    >
      {PIPELINE_COLUMNS.map((col) => {
        const colProjects = projects.filter((p) => p.status === col.id);
        const stats = columnStats[col.id];

        return (
          <div
            key={col.id}
            style={{
              width: "300px",
              flexShrink: 0,
              background: "#FAF9F6",
              border: "1px solid var(--border-light)",
              display: "flex",
              flexDirection: "column",
              borderRadius: "4px",
            }}
          >
            {/* Column header */}
            <div style={{ padding: "1rem", borderBottom: "1px solid var(--border-light)" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginBottom: "0.5rem",
                }}
              >
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: col.bg,
                    border: "1px solid rgba(0,0,0,0.1)",
                  }}
                />
                <h3
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 500,
                    margin: 0,
                    letterSpacing: "0.05em",
                  }}
                >
                  {col.label}
                </h3>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: "0.75rem",
                    color: "var(--charcoal-muted)",
                  }}
                >
                  {stats?.count ?? 0}
                </span>
              </div>

              {/* Revenue bar */}
              <div
                style={{
                  background: "white",
                  padding: "0.5rem",
                  borderRadius: "4px",
                  border: "1px solid var(--border-light)",
                  fontSize: "0.75rem",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ color: "var(--charcoal-muted)" }}>Pipeline:</span>
                <span style={{ fontWeight: 500, color: "var(--olive)" }}>
                  $
                  {(stats?.weightedValue ?? 0).toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </span>
              </div>
            </div>

            {/* Cards */}
            <div
              style={{
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                overflowY: "auto",
                flex: 1,
              }}
            >
              {colProjects.map((p) => {
                const rotting = isProjectRotting(p, now);
                const days = Math.floor(daysBetween(p.lastStatusChangeIso, now));
                return (
                  <Link
                    href={`/admin/projects/${p.id}`}
                    key={p.id}
                    style={{ textDecoration: "none" }}
                  >
                    <div
                      style={{
                        background: "white",
                        padding: "1rem",
                        border: "1px solid var(--border-light)",
                        borderLeft: rotting ? `2px solid ${ROT_RED}` : "1px solid var(--border-light)",
                        borderRadius: "4px",
                        cursor: "pointer",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                        transition: "transform 0.1s, box-shadow 0.1s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.05)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "none";
                        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.02)";
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "0.5rem",
                        }}
                      >
                        <h4
                          style={{
                            margin: "0 0 0.25rem 0",
                            fontSize: "0.9rem",
                            color: "var(--charcoal)",
                            flex: 1,
                          }}
                        >
                          {p.title}
                        </h4>
                        {rotting && (
                          <span
                            title={`Stuck ${days}d in ${col.label} (SLA ${stageSla(p.status)}d)`}
                            style={{
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              background: ROT_RED,
                              flexShrink: 0,
                              marginTop: "3px",
                            }}
                          />
                        )}
                      </div>
                      <p
                        style={{
                          margin: "0 0 0.5rem 0",
                          fontSize: "0.75rem",
                          color: "var(--charcoal-muted)",
                        }}
                      >
                        {p.firstName} {p.lastName}
                      </p>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: "0.7rem",
                          color: "var(--charcoal-muted)",
                        }}
                      >
                        <span>{p.sessionType}</span>
                        {p.estimatedValue ? (
                          <span style={{ fontWeight: 500, color: "var(--olive)" }}>
                            ${p.estimatedValue}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                );
              })}

              {(stats?.hidden ?? 0) > 0 && (
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: "var(--charcoal-muted)",
                    textAlign: "center",
                    padding: "0.5rem",
                    fontStyle: "italic",
                  }}
                >
                  +{stats.hidden} hidden by filter
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────  TABLE VIEW  ───────────────────────────── */

function TableView({
  projects,
  sortKey,
  sortDir,
  onToggleSort,
  selectedIds,
  onToggleRow,
  onToggleAllRows,
  onBulkArchive,
  isPending,
  now,
}: {
  projects: PipelineProject[];
  sortKey: SortKey;
  sortDir: SortDir;
  onToggleSort: (key: SortKey) => void;
  selectedIds: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAllRows: () => void;
  onBulkArchive: () => void;
  isPending: boolean;
  now: number;
}) {
  const router = useRouter();
  const allSelected =
    projects.length > 0 && selectedIds.size === projects.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  return (
    <div>
      {/* Bulk action bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.6rem 0.85rem",
          border: "0.5px solid var(--border-strong)",
          background: selectedIds.size > 0 ? "var(--olive-dim)" : "white",
          marginBottom: "0.75rem",
          fontFamily: "'Jost', sans-serif",
          fontSize: "0.8rem",
          minHeight: "44px",
        }}
      >
        <span style={{ color: "var(--charcoal-muted)" }}>
          {selectedIds.size > 0
            ? `${selectedIds.size} selected`
            : "Select rows to enable bulk actions"}
        </span>
        {selectedIds.size > 0 && (
          <button
            type="button"
            onClick={onBulkArchive}
            disabled={isPending}
            style={{
              marginLeft: "auto",
              fontFamily: "'Jost', sans-serif",
              fontSize: "0.75rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "0.45rem 0.85rem",
              border: "0.5px solid var(--charcoal)",
              background: isPending ? "var(--charcoal-muted)" : "var(--charcoal)",
              color: "var(--white)",
              cursor: isPending ? "wait" : "pointer",
            }}
          >
            {isPending ? "Archiving…" : "Bulk archive"}
          </button>
        )}
      </div>

      <div
        style={{
          border: "0.5px solid var(--border-strong)",
          background: "white",
          overflowX: "auto",
          maxHeight: "calc(100vh - 280px)",
          overflowY: "auto",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: "'Jost', sans-serif",
            fontSize: "0.85rem",
            color: "var(--charcoal)",
          }}
        >
          <thead
            style={{
              position: "sticky",
              top: 0,
              background: "#FAF9F6",
              zIndex: 1,
            }}
          >
            <tr
              style={{
                borderBottom: "0.5px solid var(--border-strong)",
                textAlign: "left",
              }}
            >
              <th style={thStyle("36px")}>
                <input
                  type="checkbox"
                  aria-label="Select all rows"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={onToggleAllRows}
                />
              </th>
              <SortableTh
                label="Client"
                colKey="client"
                sortKey={sortKey}
                sortDir={sortDir}
                onToggle={onToggleSort}
              />
              <SortableTh
                label="Type"
                colKey="sessionType"
                sortKey={sortKey}
                sortDir={sortDir}
                onToggle={onToggleSort}
              />
              <SortableTh
                label="Status"
                colKey="status"
                sortKey={sortKey}
                sortDir={sortDir}
                onToggle={onToggleSort}
              />
              <SortableTh
                label="Lead Score"
                colKey="leadScore"
                sortKey={sortKey}
                sortDir={sortDir}
                onToggle={onToggleSort}
                align="right"
              />
              <SortableTh
                label="Est Value"
                colKey="estimatedValue"
                sortKey={sortKey}
                sortDir={sortDir}
                onToggle={onToggleSort}
                align="right"
              />
              <SortableTh
                label="Days at Stage"
                colKey="daysAtStage"
                sortKey={sortKey}
                sortDir={sortDir}
                onToggle={onToggleSort}
                align="right"
              />
              <SortableTh
                label="Last Contacted"
                colKey="lastContacted"
                sortKey={sortKey}
                sortDir={sortDir}
                onToggle={onToggleSort}
              />
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    padding: "2.5rem 1rem",
                    textAlign: "center",
                    color: "var(--charcoal-muted)",
                    fontStyle: "italic",
                  }}
                >
                  No projects match the current view.
                </td>
              </tr>
            )}
            {projects.map((p) => {
              const rotting = isProjectRotting(p, now);
              const days = Math.floor(daysBetween(p.lastStatusChangeIso, now));
              const isSelected = selectedIds.has(p.id);
              const lastContactedLabel = p.lastContactedIso
                ? new Date(p.lastContactedIso).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "—";
              return (
                <tr
                  key={p.id}
                  onClick={(e) => {
                    // Don't navigate if the click started on the checkbox.
                    const target = e.target as HTMLElement;
                    if (target.tagName === "INPUT" || target.closest("input")) return;
                    router.push(`/admin/projects/${p.id}`);
                  }}
                  style={{
                    borderBottom: "0.5px solid var(--border)",
                    borderLeft: rotting ? `2px solid ${ROT_RED}` : "2px solid transparent",
                    cursor: "pointer",
                    background: isSelected ? "var(--olive-dim)" : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "#FAF9F6";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  <td style={tdStyle()} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${p.title}`}
                      checked={isSelected}
                      onChange={() => onToggleRow(p.id)}
                    />
                  </td>
                  <td style={tdStyle()}>
                    <div
                      style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: "1.05rem",
                        fontWeight: 400,
                        color: "var(--charcoal)",
                        lineHeight: 1.2,
                      }}
                    >
                      {p.title || `${p.firstName} ${p.lastName}`.trim() || "Untitled"}
                    </div>
                    <div
                      style={{
                        fontSize: "0.72rem",
                        color: "var(--charcoal-muted)",
                        marginTop: "0.15rem",
                      }}
                    >
                      {p.firstName} {p.lastName}
                      {p.email ? ` · ${p.email}` : ""}
                    </div>
                  </td>
                  <td style={tdStyle()}>{p.sessionType || "—"}</td>
                  <td style={tdStyle()}>
                    <span
                      style={{
                        display: "inline-block",
                        fontSize: "0.7rem",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        padding: "0.2rem 0.5rem",
                        background: statusBg(p.status),
                        color: "var(--charcoal)",
                        border: "0.5px solid rgba(0,0,0,0.08)",
                      }}
                    >
                      {p.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td style={tdStyle("right")}>{p.leadScore}</td>
                  <td style={tdStyle("right")}>
                    {p.estimatedValue != null ? `$${p.estimatedValue.toLocaleString()}` : "—"}
                  </td>
                  <td
                    style={{
                      ...tdStyle("right"),
                      color: rotting ? ROT_RED : "var(--charcoal)",
                      fontWeight: rotting ? 500 : 400,
                    }}
                    title={
                      rotting
                        ? `Stuck — SLA ${stageSla(p.status)}d for ${p.status}`
                        : `SLA ${stageSla(p.status)}d for ${p.status}`
                    }
                  >
                    {days}d
                  </td>
                  <td style={tdStyle()}>{lastContactedLabel}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────────────────────────  TABLE HELPERS  ───────────────────────────── */

function SortableTh({
  label,
  colKey,
  sortKey,
  sortDir,
  onToggle,
  align = "left",
}: {
  label: string;
  colKey: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onToggle: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sortKey === colKey;
  const arrow = active ? (sortDir === "asc" ? " ↑" : " ↓") : "";
  return (
    <th
      style={{
        ...thStyle(),
        textAlign: align,
        cursor: "pointer",
        userSelect: "none",
      }}
      onClick={() => onToggle(colKey)}
    >
      {label}
      <span style={{ color: "var(--olive)", fontWeight: 500 }}>{arrow}</span>
    </th>
  );
}

function thStyle(width?: string): React.CSSProperties {
  return {
    padding: "0.65rem 0.85rem",
    fontSize: "0.65rem",
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: "var(--olive)",
    fontWeight: 500,
    fontFamily: "'Jost', sans-serif",
    width,
    whiteSpace: "nowrap",
  };
}

function tdStyle(align: "left" | "right" = "left"): React.CSSProperties {
  return {
    padding: "0.7rem 0.85rem",
    textAlign: align,
    verticalAlign: "middle",
  };
}

function statusBg(status: string): string {
  const col = PIPELINE_COLUMNS.find((c) => c.id === status);
  if (col) return col.bg;
  if (status === "LOST") return "#FEE2E2";
  if (status === "ARCHIVED") return "#F1F5F9";
  if (status === "NEGOTIATING") return "#FEF3C7";
  if (status === "REFERRAL_SENT") return "#F3E8FF";
  if (status === "SITE_VISIT") return "#FEF3C7";
  return "#F1F5F9";
}
