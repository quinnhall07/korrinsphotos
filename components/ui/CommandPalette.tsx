"use client";

// components/ui/CommandPalette.tsx
// The Cmd/Ctrl+K modal itself. Mounted only when open (cost-free when closed).
// Owned by CommandPaletteProvider which handles the global keyboard listener.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ItemKind =
  | "client"
  | "project"
  | "event"
  | "vendor"
  | "journal"
  | "command"
  | "nav";

export interface PaletteItem {
  id: string;          // stable id for keying + recents dedupe
  kind: ItemKind;
  label: string;
  sublabel?: string;
  href: string;
}

interface SearchHitJSON {
  id: string;
  label: string;
  sublabel: string;
  href: string;
}

interface SearchResponse {
  clients: SearchHitJSON[];
  projects: SearchHitJSON[];
  events: SearchHitJSON[];
  vendors: SearchHitJSON[];
  journal: SearchHitJSON[];
}

// ── Static lists ──────────────────────────────────────────────────────────────

// Static commands. Each one currently navigates — the spec says
// "for now, all command callbacks just navigate" so we model commands as a
// kind of item with an href.
const STATIC_COMMANDS: PaletteItem[] = [
  { id: "cmd-create-project", kind: "command", label: "Create project",       href: "/admin/projects?new=1" },
  { id: "cmd-send-invoice",   kind: "command", label: "Send invoice",         href: "/admin/projects" },
  { id: "cmd-pipeline",       kind: "command", label: "Go to pipeline",       href: "/admin/projects" },
  { id: "cmd-inbox",          kind: "command", label: "Go to inbox",          href: "/admin/inbox" },
  { id: "cmd-settings",       kind: "command", label: "Open admin settings",  href: "/admin/users" },
];

// Mirrors AdminSidebar's NAV table. Kept in sync manually — small surface.
const NAV_ITEMS: PaletteItem[] = [
  { id: "nav-dashboard", kind: "nav", label: "Dashboard",         href: "/admin" },
  { id: "nav-inbox",     kind: "nav", label: "Inbox",             href: "/admin/inbox" },
  { id: "nav-pipeline",  kind: "nav", label: "Pipeline",          href: "/admin/projects" },
  { id: "nav-events",    kind: "nav", label: "Events",            href: "/admin/events" },
  { id: "nav-users",     kind: "nav", label: "Users",             href: "/admin/users" },
];

const RECENTS_KEY = "cmdk-recents";
const RECENTS_MAX = 10;

// ── localStorage helpers (recents) ────────────────────────────────────────────

function readRecents(): PaletteItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PaletteItem[]) : [];
  } catch {
    return [];
  }
}

function pushRecent(item: PaletteItem): PaletteItem[] {
  if (typeof window === "undefined") return [];
  const existing = readRecents().filter((r) => r.id !== item.id);
  const next = [item, ...existing].slice(0, RECENTS_MAX);
  try {
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // localStorage may be unavailable (private mode); recents are non-critical.
  }
  return next;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<SearchResponse>({
    clients: [], projects: [], events: [], vendors: [], journal: [],
  });
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [recents, setRecents] = useState<PaletteItem[]>([]);

  // Load recents on mount.
  useEffect(() => {
    setRecents(readRecents());
  }, []);

  // Autofocus input on mount.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounce 150ms.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 150);
    return () => clearTimeout(t);
  }, [query]);

  // Fetch matching records when the debounced query updates.
  useEffect(() => {
    if (debounced.length < 2) {
      setResults({ clients: [], projects: [], events: [], vendors: [], journal: [] });
      return;
    }
    const ac = new AbortController();
    fetch(`/api/admin/search?q=${encodeURIComponent(debounced)}`, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: SearchResponse) => setResults(data))
      .catch(() => { /* aborted or auth failure — ignore silently */ });
    return () => ac.abort();
  }, [debounced]);

  // Build flat ordered list for keyboard navigation, grouped for rendering.
  const { groups, flat } = useMemo(() => {
    const g: { label: string; items: PaletteItem[] }[] = [];

    const showRecent = query.trim().length === 0 && recents.length > 0;
    if (showRecent) g.push({ label: "Recent", items: recents.slice(0, 5) });

    const recordItems: PaletteItem[] = [
      ...results.clients.map((c) => ({ ...c, kind: "client" as const })),
      ...results.projects.map((p) => ({ ...p, kind: "project" as const })),
      ...results.events.map((e) => ({ ...e, kind: "event" as const })),
      ...results.vendors.map((v) => ({ ...v, kind: "vendor" as const })),
      ...results.journal.map((j) => ({ ...j, kind: "journal" as const })),
    ];
    if (recordItems.length > 0) g.push({ label: "Records", items: recordItems });

    // Filter commands + nav by query for keyboard-friendly shortcuts.
    const qLower = query.trim().toLowerCase();
    const filteredCommands = qLower
      ? STATIC_COMMANDS.filter((c) => c.label.toLowerCase().includes(qLower))
      : STATIC_COMMANDS;
    const filteredNav = qLower
      ? NAV_ITEMS.filter((n) => n.label.toLowerCase().includes(qLower))
      : NAV_ITEMS;

    if (filteredCommands.length > 0) g.push({ label: "Commands",   items: filteredCommands });
    if (filteredNav.length > 0)      g.push({ label: "Navigation", items: filteredNav });

    const f = g.flatMap((grp) => grp.items);
    return { groups: g, flat: f };
  }, [query, results, recents]);

  // Reset selection when results change.
  useEffect(() => {
    setSelectedIdx(0);
  }, [debounced, query, results]);

  // Activate (commit) an item.
  function activate(item: PaletteItem) {
    pushRecent(item);
    onClose();
    router.push(item.href);
  }

  // Keyboard nav (Escape handled at the provider level; arrows + Enter here).
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (flat.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flat[selectedIdx];
      if (item) activate(item);
    }
  }

  // Pre-compute per-group base offsets so we can derive each item's flat index
  // without mutating state during render (react-hooks/immutability rule).
  const groupOffsets: number[] = [];
  {
    let acc = 0;
    for (const g of groups) {
      groupOffsets.push(acc);
      acc += g.items.length;
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onMouseDown={(e) => {
        // Click on overlay (not on the modal body) closes.
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={onKeyDown}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(42,42,40,0.4)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
        animation: "fadeIn 0.18s ease",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "640px",
          maxHeight: "480px",
          background: "var(--white)",
          border: "0.5px solid var(--border-strong)",
          boxShadow: "0 24px 48px rgba(42,42,40,0.16)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Input row */}
        <div
          style={{
            borderBottom: "0.5px solid var(--border)",
            padding: "0.85rem 1.1rem",
          }}
        >
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients, projects, events, vendors, journal..."
            spellCheck={false}
            autoComplete="off"
            style={{
              width: "100%",
              border: "none",
              outline: "none",
              background: "transparent",
              fontFamily: "'Jost', sans-serif",
              fontSize: "0.95rem",
              color: "var(--charcoal)",
              padding: 0,
            }}
          />
        </div>

        {/* Result body */}
        <div
          style={{
            overflowY: "auto",
            flex: 1,
            padding: "0.5rem 0",
          }}
        >
          {groups.length === 0 && (
            <p
              style={{
                color: "var(--charcoal-muted)",
                fontSize: "0.82rem",
                padding: "1.5rem 1.2rem",
                textAlign: "center",
              }}
            >
              {query.trim().length === 0
                ? "Start typing to search…"
                : query.trim().length < 2
                  ? "Keep typing…"
                  : "No matches."}
            </p>
          )}

          {groups.map((grp, grpIdx) => (
            <div key={grp.label} style={{ marginBottom: "0.5rem" }}>
              <p
                style={{
                  fontSize: "0.65rem",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "var(--olive)",
                  padding: "0.5rem 1.2rem 0.25rem",
                  fontWeight: 500,
                }}
              >
                {grp.label}
              </p>
              {grp.items.map((item, itemIdx) => {
                const myIdx = groupOffsets[grpIdx] + itemIdx;
                const isSelected = myIdx === selectedIdx;
                return (
                  <button
                    key={`${grp.label}-${item.id}`}
                    type="button"
                    onClick={() => activate(item)}
                    onMouseEnter={() => setSelectedIdx(myIdx)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.75rem",
                      width: "100%",
                      padding: "0.55rem 1.2rem",
                      background: isSelected ? "rgba(107,120,69,0.06)" : "transparent",
                      border: "none",
                      borderLeft: isSelected
                        ? "2px solid var(--olive)"
                        : "2px solid transparent",
                      textAlign: "left",
                      cursor: "pointer",
                      fontFamily: "'Jost', sans-serif",
                      fontSize: "0.9rem",
                      color: "var(--charcoal)",
                      transition: "background 0.15s, border-color 0.15s",
                    }}
                  >
                    <span style={{ display: "flex", flexDirection: "column", gap: "0.1rem", minWidth: 0, flex: 1 }}>
                      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {item.label}
                      </span>
                      {item.sublabel && (
                        <span
                          style={{
                            fontSize: "0.72rem",
                            color: "var(--charcoal-muted)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {item.sublabel}
                        </span>
                      )}
                    </span>
                    <span
                      style={{
                        fontSize: "0.6rem",
                        letterSpacing: "0.15em",
                        textTransform: "uppercase",
                        color: "var(--charcoal-muted)",
                        flexShrink: 0,
                      }}
                    >
                      {item.kind}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer hint row */}
        <div
          style={{
            borderTop: "0.5px solid var(--border)",
            padding: "0.6rem 1.1rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "0.65rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--charcoal-muted)",
            background: "rgba(42,42,40,0.02)",
          }}
        >
          <span>↑↓ Navigate · ↵ Open</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
}
