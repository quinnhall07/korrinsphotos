"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProjectStatus } from "@/lib/db/projects";
import type { EditingSubStage } from "@/lib/editing-sla";
import { computeEditingStatus, editingStatusColor } from "@/lib/editing-status";
import {
  assessFarFutureRisk,
  farFutureRiskColor,
  type FarFutureRiskInfo,
} from "@/lib/far-future-risk";
import { toast } from "@/components/ui/Toaster";
import {
  bulkArchiveProjects,
  createMySavedView,
  deleteMySavedView,
  listMySavedViews,
  type SavedViewPayload,
} from "./actions";

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
  /** Phase 3.13 — ISO delivered-at timestamp (or null). */
  deliveredAtIso: string | null;
  /** Phase 3.13 — current editing sub-stage (or null). */
  editingSubStage: string | null;
  /** Phase 13.16 — ISO depositPaidAt (or null) — used by far-future-risk. */
  depositPaidAtIso: string | null;
  /** Phase 13.16 — ISO lastRespondedAt (or null) — used by far-future-risk. */
  lastRespondedAtIso: string | null;
  /** Phase 3.9 — COI required flag (set by admin on the workspace). */
  coiRequired: boolean;
  /** Phase 3.9 — COI state-machine value. */
  coiStatus: "NONE" | "REQUESTED" | "RECEIVED" | "EXPIRED";
};

interface Props {
  projects: PipelineProject[];
  /**
   * Wave 12 — server-resolved view. When provided, the URL is the source of
   * truth (kanban=full read, table=paginated read). Falls back to the
   * localStorage preference when omitted so older callers keep working.
   */
  view?: ViewMode;
  /** Wave 12 — opaque cursor for the next page when in table view. */
  nextCursor?: string | null;
  /** Wave 12 — true when this is page 2+ of the table (i.e. `?cursor=` set). */
  hasCursor?: boolean;
  /**
   * Wave 12 — raw `?status=` value preserved across pagination links so the
   * server-side `where("status", "in", …)` filter doesn't reset on Next.
   */
  statusFilterParam?: string | null;
  /** Wave 12 — page size advertised in the "Showing N projects" indicator. */
  pageSize?: number;
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

/**
 * Phase 13.16 — far-future risk lookup for a pipeline row. Returns the full
 * info object; callers gate rendering on `info.risk !== "NONE"`.
 */
function projectFarFutureRisk(p: PipelineProject, now: number): FarFutureRiskInfo {
  return assessFarFutureRisk({
    shootDate: p.shootDateIso ? new Date(p.shootDateIso) : null,
    depositPaidAt: p.depositPaidAtIso ? new Date(p.depositPaidAtIso) : null,
    lastContactedAt: p.lastContactedIso ? new Date(p.lastContactedIso) : null,
    lastRespondedAt: p.lastRespondedAtIso ? new Date(p.lastRespondedAtIso) : null,
    status: p.status as ProjectStatus,
    now: new Date(now),
  });
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

export function ProjectsPipelineClientPage({
  projects,
  view: serverView,
  nextCursor = null,
  hasCursor = false,
  statusFilterParam = null,
  pageSize = 50,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Stable "now" pinned at mount for SLA / sort math — refreshes when
  // the route revalidates (which re-mounts with fresh props).
  const [now] = useState<number>(() => Date.now());

  // When the server has resolved a view (i.e. `?view=` is set), the URL wins.
  // Otherwise fall back to the local-storage preference. We seed local state
  // to the server view to avoid a flicker on first paint.
  const [viewMode, setViewMode] = useState<ViewMode>(serverView ?? "kanban");
  // User-saved views live in Firestore (users/{uid}/views). Defaults are static.
  const [userSavedViews, setUserSavedViews] = useState<SavedViewPayload[]>([]);
  const [activeViewId, setActiveViewId] = useState<string>("all");
  const [isSavingView, setIsSavingView] = useState(false);

  // Table-view state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("leadScore");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Hydrate kanban/table preference from localStorage (purely a UI affordance,
  // not a saved view) and load saved views from Firestore on mount.
  //
  // Wave 12 — when the server has resolved a view from `?view=`, the URL is
  // the source of truth and we skip the localStorage hydration. This keeps a
  // page 2 deep-link from being silently flipped back to "kanban" on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (serverView) return;
    try {
      const persistedView = window.localStorage.getItem(VIEW_STORAGE_KEY);
      if (persistedView === "kanban" || persistedView === "table") {
        setViewMode(persistedView);
      }
    } catch {
      /* ignore */
    }
  }, [serverView]);

  // Persist view mode (kanban/table toggle) — not a "saved view".
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
    } catch {
      /* ignore */
    }
  }, [viewMode]);

  // Load this admin's saved views from Firestore once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listMySavedViews();
        if (!cancelled) setUserSavedViews(rows);
      } catch (err) {
        console.error("[ProjectsPipeline] listMySavedViews failed:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Concatenation: built-ins first, then persisted user views.
  const savedViews: SavedView[] = useMemo(
    () => [
      ...DEFAULT_SAVED_VIEWS,
      ...userSavedViews.map((v) => ({
        id: v.id,
        name: v.name,
        filter: v.filter as SavedViewFilter,
      })),
    ],
    [userSavedViews]
  );

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

  const handleSaveCurrentView = async () => {
    if (isSavingView) return;
    const name = window.prompt(
      "Name this view:",
      `${activeView.name} (copy)`
    );
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;

    setIsSavingView(true);
    try {
      const res = await createMySavedView({
        name: trimmed,
        filter: activeView.filter,
      });
      if (res.success && res.view) {
        setUserSavedViews((prev) => [...prev, res.view!]);
        setActiveViewId(res.view.id);
        toast(`Saved view "${trimmed}"`);
      } else {
        toast(res.error ?? "Failed to save view");
      }
    } catch (err) {
      console.error("createMySavedView failed:", err);
      toast("Failed to save view");
    } finally {
      setIsSavingView(false);
    }
  };

  const handleDeleteActiveView = async () => {
    if (activeView.builtIn) return;
    const confirmed = window.confirm(`Delete saved view "${activeView.name}"?`);
    if (!confirmed) return;
    const idToDelete = activeView.id;
    const res = await deleteMySavedView(idToDelete);
    if (res.success) {
      setUserSavedViews((prev) => prev.filter((v) => v.id !== idToDelete));
      setActiveViewId("all");
      toast("View deleted");
    } else {
      toast(res.error ?? "Failed to delete view");
    }
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
            disabled={isSavingView}
            style={{
              fontFamily: "'Jost', sans-serif",
              fontSize: "0.75rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "0.5rem 0.85rem",
              border: "0.5px solid var(--border-strong)",
              background: "transparent",
              color: "var(--charcoal)",
              cursor: isSavingView ? "wait" : "pointer",
              opacity: isSavingView ? 0.6 : 1,
            }}
            title="Save current filter as a new view"
          >
            {isSavingView ? "Saving…" : "Save view"}
          </button>

          {!activeView.builtIn && (
            <button
              type="button"
              onClick={handleDeleteActiveView}
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
              title="Delete this saved view"
            >
              Delete view
            </button>
          )}

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
                  onClick={() => {
                    setViewMode(mode);
                    // Wave 12 — switching modes navigates to the canonical URL
                    // for that mode so the server can pick the right read path
                    // (full vs paginated). Status filter is preserved; cursor
                    // is dropped because we always land on page 1.
                    const sp = new URLSearchParams();
                    sp.set("view", mode);
                    if (statusFilterParam) sp.set("status", statusFilterParam);
                    router.push(`/admin/projects?${sp.toString()}`);
                  }}
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
        {viewMode === "table" ? (
          // Wave 12 — in table view we're showing one paginated page; the
          // overall collection size is unknown, so describe the visible slice
          // rather than the dataset.
          <span>
            Showing{" "}
            <strong style={{ color: "var(--charcoal)" }}>{filteredProjects.length}</strong>{" "}
            project{filteredProjects.length === 1 ? "" : "s"}
            {hasCursor ? " on this page" : ` (page 1 · up to ${pageSize} per page)`}
          </span>
        ) : (
          <span>
            Showing <strong style={{ color: "var(--charcoal)" }}>{filteredProjects.length}</strong> of{" "}
            {projects.length} projects
          </span>
        )}
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
          nextCursor={nextCursor}
          hasCursor={hasCursor}
          statusFilterParam={statusFilterParam}
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
                const risk = projectFarFutureRisk(p, now);
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
                        <RiskDot info={risk} />
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
  nextCursor,
  hasCursor,
  statusFilterParam,
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
  nextCursor: string | null;
  hasCursor: boolean;
  statusFilterParam: string | null;
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
              <th style={thStyle()}>Editing</th>
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
                  colSpan={9}
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
                        display: "flex",
                        alignItems: "center",
                        gap: "0.45rem",
                      }}
                    >
                      <span>{p.title || `${p.firstName} ${p.lastName}`.trim() || "Untitled"}</span>
                      <CoiChip project={p} now={now} />
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
                  <td style={tdStyle()}>
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <EditingPill project={p} now={now} />
                      <RiskDot info={projectFarFutureRisk(p, now)} />
                    </div>
                  </td>
                  <td style={tdStyle()}>{lastContactedLabel}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/*
        Wave 12 — Forward-only pagination footer. Only renders in table view.
        "Back to start" jumps to page 1 (cursor cleared); Next forwards the
        opaque cursor returned by the server. We preserve `?status=` so the
        Firestore-side filter survives the navigation; the saved-view
        selection lives client-side and is unaffected.
      */}
      {(hasCursor || nextCursor) && (
        <nav
          aria-label="Pipeline pagination"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "1rem",
            fontSize: "0.78rem",
            color: "var(--charcoal-muted)",
            fontFamily: "'Jost', sans-serif",
          }}
        >
          <div>
            {hasCursor ? (
              <Link
                href={buildTablePaginationHref({ statusFilterParam })}
                style={paginationLinkStyle("ghost")}
              >
                ← Back to start
              </Link>
            ) : (
              <span style={{ opacity: 0.5 }}>Page 1</span>
            )}
          </div>
          <div>
            {nextCursor ? (
              <Link
                href={buildTablePaginationHref({
                  cursor: nextCursor,
                  statusFilterParam,
                })}
                style={paginationLinkStyle("primary")}
              >
                Next →
              </Link>
            ) : (
              <span style={{ opacity: 0.5 }}>End of list</span>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}

/**
 * Wave 12 — build a `/admin/projects?view=table&...` href that preserves the
 * server-side status filter and (optionally) the next cursor. Saved-view
 * selection is intentionally NOT round-tripped through the URL because that
 * predicate is applied client-side.
 */
function buildTablePaginationHref(params: {
  cursor?: string;
  statusFilterParam: string | null;
}): string {
  const sp = new URLSearchParams();
  sp.set("view", "table");
  if (params.cursor) sp.set("cursor", params.cursor);
  if (params.statusFilterParam) sp.set("status", params.statusFilterParam);
  return `/admin/projects?${sp.toString()}`;
}

function paginationLinkStyle(variant: "ghost" | "primary"): React.CSSProperties {
  if (variant === "primary") {
    return {
      padding: "0.5rem 1rem",
      fontSize: "0.65rem",
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      color: "var(--white)",
      background: "var(--olive)",
      border: "0.5px solid var(--olive)",
      textDecoration: "none",
      display: "inline-block",
    };
  }
  return {
    padding: "0.5rem 1rem",
    fontSize: "0.65rem",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "var(--charcoal)",
    border: "0.5px solid var(--border-strong)",
    background: "transparent",
    textDecoration: "none",
    display: "inline-block",
  };
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

/**
 * Phase 3.13 — editing-workflow pill. Renders only for IN_EDITING projects
 * that have a shootDate and aren't yet delivered; otherwise emits an em-dash.
 *
 * Color dot is sourced from `editingStatusColor()` so this and the workspace
 * stepper stay in sync.
 */
function EditingPill({ project, now }: { project: PipelineProject; now: number }) {
  if (project.status !== "IN_EDITING") {
    return <span style={{ color: "var(--charcoal-muted)" }}>—</span>;
  }
  const info = computeEditingStatus({
    shootDate: project.shootDateIso ? new Date(project.shootDateIso) : null,
    deliveredAt: project.deliveredAtIso ? new Date(project.deliveredAtIso) : null,
    sessionType: project.sessionType,
    editingSubStage: (project.editingSubStage as EditingSubStage | null) ?? null,
    now: new Date(now),
  });
  if (!info) {
    return <span style={{ color: "var(--charcoal-muted)" }}>—</span>;
  }
  return (
    <span
      title={`SLA ${info.slaDays}d · ${info.status.toLowerCase().replace("_", " ")}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.4rem",
        fontSize: "0.78rem",
        color: "var(--charcoal)",
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: editingStatusColor(info.status),
          flexShrink: 0,
        }}
      />
      {info.pillLabel}
    </span>
  );
}

/**
 * Phase 3.9 — small inline COI chip rendered next to the row title when the
 * project is flagged `coiRequired` and the cert has not been received. Olive
 * outline when REQUESTED, red when NONE-but-shoot-within-14-days, muted
 * olive otherwise. Returns `null` for projects that don't need a chip.
 */
function CoiChip({ project, now }: { project: PipelineProject; now: number }) {
  if (!project.coiRequired) return null;
  if (project.coiStatus === "RECEIVED") return null;

  // Compute proximity to shoot — drives the urgency styling.
  let imminent = false;
  if (project.shootDateIso) {
    const shootMs = new Date(project.shootDateIso).getTime();
    if (!Number.isNaN(shootMs)) {
      const daysToShoot = (shootMs - now) / (1000 * 60 * 60 * 24);
      imminent = daysToShoot >= 0 && daysToShoot <= 14;
    }
  }

  const isUrgent = project.coiStatus === "NONE" && imminent;
  const isRequested = project.coiStatus === "REQUESTED";

  let bg: string;
  let color: string;
  let borderColor: string;
  if (isUrgent) {
    bg = "rgba(176,50,50,0.08)";
    color = "#b03232";
    borderColor = "rgba(176,50,50,0.5)";
  } else if (isRequested) {
    bg = "var(--olive-dim)";
    color = "var(--olive)";
    borderColor = "var(--olive)";
  } else {
    bg = "transparent";
    color = "var(--charcoal-muted)";
    borderColor = "var(--border-strong)";
  }

  const title =
    project.coiStatus === "NONE"
      ? imminent
        ? "COI required — shoot within 14 days and cert not yet requested"
        : "COI required — not yet requested"
      : project.coiStatus === "REQUESTED"
      ? "COI requested — awaiting cert from insurer"
      : "COI expired";

  return (
    <span
      title={title}
      onClick={(e) => e.stopPropagation()}
      style={{
        display: "inline-block",
        fontSize: "0.55rem",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        padding: "0.12rem 0.4rem",
        background: bg,
        color,
        border: `0.5px solid ${borderColor}`,
        fontFamily: "'Jost', sans-serif",
        fontWeight: 500,
        flexShrink: 0,
      }}
    >
      COI
    </span>
  );
}

/**
 * Phase 13.16 — far-future-risk dot/chip. Renders nothing when `risk === "NONE"`.
 * Olive for WATCH, amber for FLAG, red for STALE. Tooltip carries the
 * helper's `reason` string so operators can see why the dot is lit without
 * leaving the table.
 */
function RiskDot({ info }: { info: FarFutureRiskInfo }) {
  if (info.risk === "NONE") return null;
  const color = farFutureRiskColor(info.risk);
  if (!color) return null;
  return (
    <span
      title={info.reason}
      aria-label={info.reason}
      style={{
        display: "inline-block",
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
        marginTop: "3px",
      }}
    />
  );
}
