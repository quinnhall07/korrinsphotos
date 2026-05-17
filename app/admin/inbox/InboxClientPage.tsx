"use client";

// app/admin/inbox/InboxClientPage.tsx
// Keyboard-first triage UI for the unified admin inbox.
// Shortcuts: j = next, k = prev, e = archive, s = snooze 24h, m = toggle read, Enter = open link.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "@/components/ui/Toaster";
import {
  archiveInboxItem,
  unarchiveInboxItem,
  unsnoozeInboxItem,
  bulkArchiveInboxItems,
  bulkUnarchiveInboxItems,
  bulkMarkRead,
  markInboxRead,
  markInboxUnread,
  snoozeInboxItem,
  sendReengagementEmail,
  snoozeReengagement30Days,
  getDefaultReengagementBody,
} from "./actions";

export type BrandVoiceAnchor = {
  id: string;
  label: string;
  body: string;
  context: string | null;
};

export type InboxItemView = {
  id: string;
  type:
    | "INQUIRY_RECEIVED"
    | "PAYMENT_RECEIVED"
    | "PAYMENT_FAILED"
    | "PAYMENT_REFUNDED"
    | "PAYMENT_DISPUTE_CREATED"
    | "PAYMENT_DISPUTE_CLOSED"
    | "CONTRACT_SIGNED"
    | "MESSAGE_RECEIVED"
    | "CLIENT_MESSAGE"
    | "GALLERY_REQUESTED"
    | "UNMATCHED_INBOUND"
    | "TASK_FIRED"
    | "PRESS_LINK_DOWN"
    | "RE_ENGAGEMENT_DUE"
    | "FAR_FUTURE_RISK"
    | "COI_REQUESTED"
    | "COI_RECEIVED"
    | "SALES_TAX_OVERDUE";
  projectId: string | null;
  clientId: string | null;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  snoozedUntilIso: string | null;
  createdAtIso: string;
};

const TYPE_LABELS: Record<InboxItemView["type"], string> = {
  INQUIRY_RECEIVED: "INQUIRY",
  PAYMENT_RECEIVED: "PAYMENT",
  PAYMENT_FAILED: "PAYMENT FAILED",
  PAYMENT_REFUNDED: "REFUND",
  PAYMENT_DISPUTE_CREATED: "DISPUTE OPENED",
  PAYMENT_DISPUTE_CLOSED: "DISPUTE CLOSED",
  CONTRACT_SIGNED: "CONTRACT",
  MESSAGE_RECEIVED: "MESSAGE",
  CLIENT_MESSAGE: "CLIENT MESSAGE",
  GALLERY_REQUESTED: "GALLERY",
  UNMATCHED_INBOUND: "UNMATCHED",
  TASK_FIRED: "AUTOMATION",
  PRESS_LINK_DOWN: "PRESS LINK DOWN",
  RE_ENGAGEMENT_DUE: "RE-ENGAGEMENT DUE",
  FAR_FUTURE_RISK: "FAR-FUTURE RISK",
  COI_REQUESTED: "COI REQUESTED",
  COI_RECEIVED: "COI RECEIVED",
  SALES_TAX_OVERDUE: "SALES TAX OVERDUE",
};

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function InboxClientPage({
  openItems,
  snoozedItems,
  archivedItems = [],
  voiceAnchors,
}: {
  openItems: InboxItemView[];
  snoozedItems: InboxItemView[];
  archivedItems?: InboxItemView[];
  voiceAnchors: BrandVoiceAnchor[];
}) {
  const router = useRouter();
  const [view, setView] = useState<"active" | "archived">("active");
  const [typeFilter, setTypeFilter] = useState<InboxItemView["type"] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    openItems[0]?.id ?? null
  );
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [snoozedOpen, setSnoozedOpen] = useState(false);

  const filteredOpen = useMemo(
    () => (typeFilter ? openItems.filter((i) => i.type === typeFilter) : openItems),
    [openItems, typeFilter]
  );

  const filteredArchived = useMemo(
    () => (typeFilter ? archivedItems.filter((i) => i.type === typeFilter) : archivedItems),
    [archivedItems, typeFilter]
  );

  const selected = useMemo(
    () =>
      filteredOpen.find((i) => i.id === selectedId) ??
      snoozedItems.find((i) => i.id === selectedId) ??
      filteredArchived.find((i) => i.id === selectedId) ??
      null,
    [filteredOpen, snoozedItems, filteredArchived, selectedId]
  );

  const inArchivedView = view === "archived";

  // Keep selectedId valid when the list changes (e.g. after a revalidation).
  useEffect(() => {
    if (filteredOpen.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!filteredOpen.some((i) => i.id === selectedId)) {
      setSelectedId(filteredOpen[0].id);
    }
  }, [filteredOpen, selectedId]);

  const moveSelection = useCallback(
    (delta: number) => {
      if (filteredOpen.length === 0) return;
      const idx = filteredOpen.findIndex((i) => i.id === selectedId);
      const next =
        idx === -1
          ? 0
          : Math.min(filteredOpen.length - 1, Math.max(0, idx + delta));
      setSelectedId(filteredOpen[next].id);
    },
    [filteredOpen, selectedId]
  );

  const doArchive = useCallback(
    async (id: string) => {
      const res = await archiveInboxItem(id);
      if (res.success) {
        toast("Archived");
        router.refresh();
      } else {
        toast(res.error ?? "Failed to archive");
      }
    },
    [router]
  );

  const doUnarchive = useCallback(
    async (id: string) => {
      const res = await unarchiveInboxItem(id);
      if (res.success) {
        toast("Restored");
        router.refresh();
      } else {
        toast(res.error ?? "Failed to restore");
      }
    },
    [router]
  );

  const doUnsnooze = useCallback(
    async (id: string) => {
      const res = await unsnoozeInboxItem(id);
      if (res.success) {
        toast("Snooze cleared");
        router.refresh();
      } else {
        toast(res.error ?? "Failed to unsnooze");
      }
    },
    [router]
  );

  const doSnooze = useCallback(
    async (id: string) => {
      const res = await snoozeInboxItem(id, 24);
      if (res.success) {
        toast("Snoozed 24h");
        router.refresh();
      } else {
        toast(res.error ?? "Failed to snooze");
      }
    },
    [router]
  );

  const doToggleRead = useCallback(
    async (item: InboxItemView) => {
      const res = item.read
        ? await markInboxUnread(item.id)
        : await markInboxRead(item.id);
      if (res.success) {
        toast(item.read ? "Marked unread" : "Marked read");
        router.refresh();
      } else {
        toast(res.error ?? "Failed");
      }
    },
    [router]
  );

  // Global keyboard shortcuts. Skip when typing in an input/textarea.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "j") {
        e.preventDefault();
        moveSelection(1);
      } else if (e.key === "k") {
        e.preventDefault();
        moveSelection(-1);
      } else if (e.key === "e" && selected) {
        e.preventDefault();
        if (inArchivedView) {
          void doUnarchive(selected.id);
        } else {
          void doArchive(selected.id);
        }
      } else if (e.key === "s" && selected) {
        e.preventDefault();
        // In active view, `s` snoozes 24h. If the selected item is already
        // snoozed (i.e. we're viewing it inside the Snoozed section), `s` now
        // CLEARS the snooze instead — previously it re-snoozed forever, which
        // was confusing.
        if (selected.snoozedUntilIso && new Date(selected.snoozedUntilIso).getTime() > Date.now()) {
          void doUnsnooze(selected.id);
        } else {
          void doSnooze(selected.id);
        }
      } else if (e.key === "m" && selected) {
        e.preventDefault();
        void doToggleRead(selected);
      } else if (e.key === "Enter" && selected?.link) {
        e.preventDefault();
        router.push(selected.link);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moveSelection, selected, doArchive, doSnooze, doToggleRead, doUnarchive, doUnsnooze, inArchivedView, router]);

  const toggleCheck = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const doBulkMarkRead = async () => {
    const ids = Array.from(checked);
    const res = await bulkMarkRead(ids);
    if (res.success) {
      toast(`Marked ${ids.length} read`);
      setChecked(new Set());
      router.refresh();
    } else {
      toast(res.error ?? "Failed");
    }
  };

  const doBulkArchive = async () => {
    const ids = Array.from(checked);
    const res = await bulkArchiveInboxItems(ids);
    if (res.success) {
      toast(`Archived ${ids.length}`);
      setChecked(new Set());
      router.refresh();
    } else {
      toast(res.error ?? "Failed");
    }
  };

  const doBulkUnarchive = async () => {
    const ids = Array.from(checked);
    const res = await bulkUnarchiveInboxItems(ids);
    if (res.success) {
      toast(`Restored ${ids.length}`);
      setChecked(new Set());
      router.refresh();
    } else {
      toast(res.error ?? "Failed");
    }
  };

  const unreadCount = openItems.filter((i) => !i.read).length;

  return (
    <div style={{ minHeight: "calc(100vh - 72px)", color: "var(--charcoal)" }}>
      {/* Header */}
      <div
        style={{
          padding: "1.5rem 2rem 1rem",
          borderBottom: "0.5px solid var(--border)",
        }}
      >
        <p
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--olive)",
            margin: 0,
          }}
        >
          Triage
        </p>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontWeight: 300,
            fontSize: "2rem",
            margin: "0.25rem 0 0.5rem",
            color: "var(--charcoal)",
          }}
        >
          Inbox
        </h1>
        <p style={{ fontSize: "0.78rem", color: "var(--charcoal-muted)", margin: 0 }}>
          {unreadCount} unread · {openItems.length} open · {snoozedItems.length} snoozed · {archivedItems.length} archived
          <span style={{ marginLeft: "1rem", letterSpacing: "0.08em" }}>
            <KbdHint k="j" /> next · <KbdHint k="k" /> prev · <KbdHint k="e" /> archive ·{" "}
            <KbdHint k="s" /> snooze · <KbdHint k="m" /> toggle read ·{" "}
            <KbdHint k="↵" /> open
          </span>
        </p>

        {/* View switcher: Active ↔ Archived. Archive is now a soft state — the
            Archived tab is the destination, not a black hole. */}
        <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
          {(["active", "archived"] as const).map((mode) => {
            const isActive = view === mode;
            return (
              <button
                key={mode}
                onClick={() => {
                  setView(mode);
                  setTypeFilter(null);
                  setSelectedId(null);
                  setChecked(new Set());
                }}
                style={{
                  padding: "0.4rem 0.85rem",
                  fontSize: "0.7rem",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  fontFamily: "'Jost', sans-serif",
                  border: "0.5px solid var(--border-strong)",
                  background: isActive ? "var(--charcoal)" : "transparent",
                  color: isActive ? "var(--white)" : "var(--charcoal-muted)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {mode === "active"
                  ? `Active (${openItems.length})`
                  : `Archived (${archivedItems.length})`}
              </button>
            );
          })}
        </div>

        {/* Filter chips */}
        {typeFilter && (
          <div style={{ marginTop: "0.75rem" }}>
            <button
              onClick={() => setTypeFilter(null)}
              style={{
                ...chipStyle(true),
                cursor: "pointer",
                background: "var(--olive)",
                color: "var(--white)",
                border: "0.5px solid var(--olive)",
              }}
            >
              {TYPE_LABELS[typeFilter]} ×
            </button>
          </div>
        )}

        {/* Bulk actions */}
        {checked.size > 0 && (
          <div
            style={{
              marginTop: "0.75rem",
              display: "flex",
              gap: "0.5rem",
              alignItems: "center",
              fontSize: "0.78rem",
              color: "var(--charcoal-light)",
            }}
          >
            <span>{checked.size} selected</span>
            {!inArchivedView && (
              <>
                <button onClick={doBulkMarkRead} style={pillButtonStyle()}>
                  Mark all read
                </button>
                <button onClick={doBulkArchive} style={pillButtonStyle()}>
                  Archive all
                </button>
              </>
            )}
            {inArchivedView && (
              <button onClick={doBulkUnarchive} style={pillButtonStyle()}>
                Restore all
              </button>
            )}
            <button
              onClick={() => setChecked(new Set())}
              style={{ ...pillButtonStyle(), background: "transparent" }}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Two-pane layout */}
      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", minHeight: "calc(100vh - 200px)" }}>
        {/* List */}
        <div
          style={{
            borderRight: "0.5px solid var(--border)",
            overflowY: "auto",
            maxHeight: "calc(100vh - 200px)",
          }}
        >
          {inArchivedView ? (
            filteredArchived.length === 0 ? (
              <div style={{ padding: "2rem", color: "var(--charcoal-muted)", fontSize: "0.85rem" }}>
                {archivedItems.length === 0
                  ? "Nothing in the archive yet."
                  : "No archived items match this filter."}
              </div>
            ) : (
              filteredArchived.map((item) => (
                <Row
                  key={item.id}
                  item={item}
                  selected={item.id === selectedId}
                  checked={checked.has(item.id)}
                  onSelect={() => setSelectedId(item.id)}
                  onToggleCheck={() => toggleCheck(item.id)}
                  onFilterType={() => setTypeFilter(item.type)}
                />
              ))
            )
          ) : filteredOpen.length === 0 ? (
            <div style={{ padding: "2rem", color: "var(--charcoal-muted)", fontSize: "0.85rem" }}>
              {openItems.length === 0
                ? "Inbox zero. Nothing to triage."
                : "No items match this filter."}
            </div>
          ) : (
            filteredOpen.map((item) => (
              <Row
                key={item.id}
                item={item}
                selected={item.id === selectedId}
                checked={checked.has(item.id)}
                onSelect={() => setSelectedId(item.id)}
                onToggleCheck={() => toggleCheck(item.id)}
                onFilterType={() => setTypeFilter(item.type)}
              />
            ))
          )}

          {/* Snoozed section — hidden in archived view */}
          {!inArchivedView && snoozedItems.length > 0 && (
            <div style={{ borderTop: "0.5px solid var(--border)", marginTop: "0.5rem" }}>
              <button
                onClick={() => setSnoozedOpen((v) => !v)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  background: "transparent",
                  border: "none",
                  padding: "0.85rem 1rem",
                  cursor: "pointer",
                  fontSize: "0.65rem",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "var(--charcoal-muted)",
                }}
              >
                {snoozedOpen ? "▾" : "▸"} Snoozed ({snoozedItems.length})
              </button>
              {snoozedOpen &&
                snoozedItems.map((item) => (
                  <Row
                    key={item.id}
                    item={item}
                    selected={item.id === selectedId}
                    checked={checked.has(item.id)}
                    onSelect={() => setSelectedId(item.id)}
                    onToggleCheck={() => toggleCheck(item.id)}
                    onFilterType={() => setTypeFilter(item.type)}
                    isSnoozed
                  />
                ))}
            </div>
          )}
        </div>

        {/* Detail */}
        <div style={{ padding: "2rem", overflowY: "auto", maxHeight: "calc(100vh - 200px)" }}>
          {selected ? (
            <DetailPane
              item={selected}
              voiceAnchors={voiceAnchors}
              isArchived={inArchivedView}
              isSnoozedNow={
                !!selected.snoozedUntilIso &&
                new Date(selected.snoozedUntilIso).getTime() > Date.now()
              }
              onArchive={() => doArchive(selected.id)}
              onUnarchive={() => doUnarchive(selected.id)}
              onSnooze={() => doSnooze(selected.id)}
              onUnsnooze={() => doUnsnooze(selected.id)}
              onToggleRead={() => doToggleRead(selected)}
            />
          ) : (
            <div style={{ color: "var(--charcoal-muted)", fontSize: "0.85rem" }}>
              Select an item to see details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  item,
  selected,
  checked,
  onSelect,
  onToggleCheck,
  onFilterType,
  isSnoozed,
}: {
  item: InboxItemView;
  selected: boolean;
  checked: boolean;
  onSelect: () => void;
  onToggleCheck: () => void;
  onFilterType: () => void;
  isSnoozed?: boolean;
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: "0.6rem",
        padding: "0.85rem 1rem",
        borderBottom: "0.5px solid var(--border)",
        borderLeft: selected ? "2px solid var(--olive)" : "2px solid transparent",
        background: selected ? "rgba(107,120,69,0.06)" : "transparent",
        cursor: "pointer",
        opacity: item.read || isSnoozed ? 0.6 : 1,
        transition: "all 0.15s",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onClick={(e) => e.stopPropagation()}
        onChange={onToggleCheck}
        style={{ marginTop: "0.25rem", cursor: "pointer" }}
        aria-label="Select item"
      />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFilterType();
            }}
            style={chipStyle(false)}
            title="Filter by this type"
          >
            {TYPE_LABELS[item.type]}
          </button>
          <span style={{ fontSize: "0.7rem", color: "var(--charcoal-muted)", marginLeft: "auto" }}>
            {relativeTime(item.createdAtIso)}
          </span>
        </div>
        <div
          style={{
            fontFamily: "'Jost', sans-serif",
            fontWeight: item.read ? 300 : 400,
            fontSize: "0.88rem",
            color: "var(--charcoal)",
            marginBottom: "0.2rem",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.title}
        </div>
        {item.body && (
          <div
            style={{
              fontSize: "0.78rem",
              color: "var(--charcoal-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.body}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailPane({
  item,
  voiceAnchors,
  isArchived,
  isSnoozedNow,
  onArchive,
  onUnarchive,
  onSnooze,
  onUnsnooze,
  onToggleRead,
}: {
  item: InboxItemView;
  voiceAnchors: BrandVoiceAnchor[];
  isArchived: boolean;
  isSnoozedNow: boolean;
  onArchive: () => void;
  onUnarchive: () => void;
  onSnooze: () => void;
  onUnsnooze: () => void;
  onToggleRead: () => void;
}) {
  return (
    <div>
      <p
        style={{
          fontSize: "0.65rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--olive)",
          margin: 0,
        }}
      >
        {TYPE_LABELS[item.type]}
      </p>
      <h2
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontWeight: 300,
          fontSize: "1.65rem",
          margin: "0.25rem 0 0.5rem",
          color: "var(--charcoal)",
        }}
      >
        {item.title}
      </h2>
      <p style={{ fontSize: "0.75rem", color: "var(--charcoal-muted)", marginTop: 0 }}>
        {relativeTime(item.createdAtIso)}
        {item.snoozedUntilIso && (
          <span> · snoozed until {new Date(item.snoozedUntilIso).toLocaleString()}</span>
        )}
        {item.read && <span> · read</span>}
      </p>

      {item.body && (
        <div
          style={{
            marginTop: "1.5rem",
            padding: "1.25rem",
            background: "rgba(42,42,40,0.02)",
            border: "0.5px solid var(--border)",
            fontSize: "0.9rem",
            color: "var(--charcoal-light)",
            lineHeight: 1.65,
            whiteSpace: "pre-wrap",
          }}
        >
          {item.body}
        </div>
      )}

      <VoiceAnchorsCard anchors={voiceAnchors} />

      {item.type === "RE_ENGAGEMENT_DUE" && item.clientId && (
        <ReengagementBlock
          inboxItemId={item.id}
          clientId={item.clientId}
        />
      )}

      <div
        style={{
          marginTop: "1.5rem",
          display: "flex",
          gap: "0.6rem",
          flexWrap: "wrap",
        }}
      >
        {item.link && (
          <Link
            href={item.link}
            style={{
              ...pillButtonStyle(),
              background: "var(--olive)",
              color: "var(--white)",
              border: "0.5px solid var(--olive)",
              textDecoration: "none",
            }}
          >
            Open →
          </Link>
        )}
        <button onClick={onToggleRead} style={pillButtonStyle()}>
          {item.read ? "Mark unread" : "Mark read"}
        </button>
        {isSnoozedNow ? (
          <button onClick={onUnsnooze} style={pillButtonStyle()}>
            Unsnooze
          </button>
        ) : !isArchived ? (
          <button onClick={onSnooze} style={pillButtonStyle()}>
            Snooze 24h
          </button>
        ) : null}
        {isArchived ? (
          <button
            onClick={onUnarchive}
            style={{
              ...pillButtonStyle(),
              background: "var(--olive)",
              color: "var(--white)",
              border: "0.5px solid var(--olive)",
            }}
          >
            Restore
          </button>
        ) : (
          <button onClick={onArchive} style={pillButtonStyle()}>
            Archive
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Phase 13.6 — inline re-engagement quick actions, rendered inside the
 * inbox detail panel when an item carries `type === "RE_ENGAGEMENT_DUE"`.
 * Loads the default subject/body lazily on mount so the textarea is
 * pre-populated, then offers two buttons:
 *   - "Send re-engagement email now" → enqueueTrackedMail + advance window 12mo
 *   - "Snooze 30 days"               → bump next-prompt window forward
 */
function ReengagementBlock({
  inboxItemId,
  clientId,
}: {
  inboxItemId: string;
  clientId: string;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [snoozing, setSnoozing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getDefaultReengagementBody(clientId);
        if (cancelled) return;
        setSubject(res.subject);
        setBody(res.body);
      } catch {
        // Keep empty defaults if the lookup fails.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const handleSend = async () => {
    if (sending) return;
    setSending(true);
    const res = await sendReengagementEmail(inboxItemId, clientId, {
      subject,
      body,
    });
    setSending(false);
    if (res.success) {
      toast("Re-engagement email sent");
      router.refresh();
    } else {
      toast(res.error ?? "Failed to send");
    }
  };

  const handleSnooze = async () => {
    if (snoozing) return;
    setSnoozing(true);
    const res = await snoozeReengagement30Days(inboxItemId, clientId);
    setSnoozing(false);
    if (res.success) {
      toast("Snoozed 30 days");
      router.refresh();
    } else {
      toast(res.error ?? "Failed to snooze");
    }
  };

  return (
    <div
      style={{
        marginTop: "1.5rem",
        padding: "1.25rem",
        border: "0.5px solid var(--olive)",
        background: "var(--olive-dim)",
      }}
    >
      <p
        style={{
          fontSize: "0.6rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--olive)",
          margin: 0,
        }}
      >
        Quick action — re-engagement email
      </p>

      <label
        style={{
          display: "block",
          marginTop: "0.85rem",
          fontSize: "0.7rem",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--charcoal-light)",
        }}
      >
        Subject
      </label>
      <input
        type="text"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        disabled={!loaded}
        style={{
          display: "block",
          width: "100%",
          marginTop: "0.3rem",
          padding: "0.55rem 0.75rem",
          border: "0.5px solid var(--border-strong)",
          background: "var(--white)",
          fontFamily: "'Jost', sans-serif",
          fontSize: "0.88rem",
          color: "var(--charcoal)",
        }}
      />

      <label
        style={{
          display: "block",
          marginTop: "0.85rem",
          fontSize: "0.7rem",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--charcoal-light)",
        }}
      >
        Body
      </label>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={8}
        disabled={!loaded}
        style={{
          display: "block",
          width: "100%",
          marginTop: "0.3rem",
          padding: "0.55rem 0.75rem",
          border: "0.5px solid var(--border-strong)",
          background: "var(--white)",
          fontFamily: "'Jost', sans-serif",
          fontSize: "0.88rem",
          color: "var(--charcoal)",
          lineHeight: 1.55,
          resize: "vertical",
        }}
      />

      <div
        style={{
          marginTop: "0.85rem",
          display: "flex",
          gap: "0.6rem",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={handleSend}
          disabled={sending || snoozing || !loaded || !body.trim()}
          style={{
            ...pillButtonStyle(),
            background: "var(--olive)",
            color: "var(--white)",
            border: "0.5px solid var(--olive)",
            cursor: sending ? "wait" : "pointer",
            opacity: sending || !body.trim() ? 0.6 : 1,
          }}
        >
          {sending ? "Sending…" : "Send re-engagement email now"}
        </button>
        <button
          onClick={handleSnooze}
          disabled={sending || snoozing}
          style={{
            ...pillButtonStyle(),
            cursor: snoozing ? "wait" : "pointer",
            opacity: snoozing ? 0.6 : 1,
          }}
        >
          {snoozing ? "Snoozing…" : "Snooze 30 days"}
        </button>
      </div>
    </div>
  );
}

/**
 * Phase 13.13 — Voice anchors reference card. Lives directly above the
 * reply textarea in the inbox detail panel. Reference only — Korrin reads
 * her own writing samples while drafting; the AI hookup ships in Phase 5.
 */
function VoiceAnchorsCard({ anchors }: { anchors: BrandVoiceAnchor[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (anchors.length === 0) {
    return (
      <div
        style={{
          marginTop: "1.5rem",
          padding: "0.75rem 1rem",
          border: "0.5px solid var(--border)",
          background: "rgba(42,42,40,0.02)",
          fontSize: "0.78rem",
          color: "var(--charcoal-muted)",
          fontFamily: "'Jost', sans-serif",
        }}
      >
        No voice anchors yet.{" "}
        <Link
          href="/admin/settings/brand-voice"
          style={{ color: "var(--olive)", textDecoration: "underline" }}
        >
          Add some in Settings → Brand voice.
        </Link>
      </div>
    );
  }

  const handleCopy = async (anchor: BrandVoiceAnchor) => {
    try {
      await navigator.clipboard.writeText(anchor.body);
      setCopiedId(anchor.id);
      window.setTimeout(() => {
        setCopiedId((c) => (c === anchor.id ? null : c));
      }, 1500);
    } catch {
      toast("Could not copy to clipboard");
    }
  };

  const expanded = anchors.find((a) => a.id === expandedId) ?? null;

  return (
    <div
      style={{
        marginTop: "1.5rem",
        padding: "0.85rem 1rem",
        border: "0.5px solid var(--border)",
        background: "var(--olive-dim)",
        fontFamily: "'Jost', sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "0.55rem",
        }}
      >
        <p
          style={{
            fontSize: "0.6rem",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--olive)",
            margin: 0,
          }}
        >
          Voice anchors ({anchors.length})
        </p>
        <Link
          href="/admin/settings/brand-voice"
          style={{
            fontSize: "0.7rem",
            color: "var(--charcoal-muted)",
            textDecoration: "underline",
          }}
        >
          Manage
        </Link>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
        {anchors.map((a) => {
          const isOpen = expandedId === a.id;
          return (
            <button
              key={a.id}
              onClick={() => setExpandedId(isOpen ? null : a.id)}
              style={{
                fontSize: "0.7rem",
                letterSpacing: "0.06em",
                padding: "0.3rem 0.6rem",
                background: isOpen ? "var(--olive)" : "var(--white)",
                color: isOpen ? "var(--white)" : "var(--charcoal-light)",
                border: "0.5px solid var(--border-strong)",
                cursor: "pointer",
                fontFamily: "'Jost', sans-serif",
              }}
              title={a.context ?? undefined}
            >
              {a.label}
            </button>
          );
        })}
      </div>
      {expanded && (
        <div
          style={{
            marginTop: "0.75rem",
            padding: "0.85rem",
            background: "var(--white)",
            border: "0.5px solid var(--border-strong)",
            fontSize: "0.85rem",
            color: "var(--charcoal-light)",
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
          }}
        >
          {expanded.context && (
            <p
              style={{
                margin: "0 0 0.5rem",
                fontSize: "0.7rem",
                color: "var(--charcoal-muted)",
                fontStyle: "italic",
              }}
            >
              {expanded.context}
            </p>
          )}
          <div>{expanded.body}</div>
          <div style={{ marginTop: "0.6rem", display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => handleCopy(expanded)}
              style={{
                fontSize: "0.7rem",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                padding: "0.35rem 0.75rem",
                background: "transparent",
                color: "var(--charcoal)",
                border: "0.5px solid var(--border-strong)",
                cursor: "pointer",
                fontFamily: "'Jost', sans-serif",
              }}
            >
              {copiedId === expanded.id ? "Copied" : "Copy"}
            </button>
            <button
              onClick={() => setExpandedId(null)}
              style={{
                fontSize: "0.7rem",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                padding: "0.35rem 0.75rem",
                background: "transparent",
                color: "var(--charcoal-muted)",
                border: "0.5px solid var(--border-strong)",
                cursor: "pointer",
                fontFamily: "'Jost', sans-serif",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function KbdHint({ k }: { k: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: "monospace",
        fontSize: "0.7rem",
        padding: "0.05rem 0.35rem",
        border: "0.5px solid var(--border-strong)",
        color: "var(--charcoal-light)",
        margin: "0 0.15rem",
      }}
    >
      {k}
    </span>
  );
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    display: "inline-block",
    fontSize: "0.6rem",
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    padding: "0.2rem 0.5rem",
    background: active ? "var(--olive-dim)" : "transparent",
    color: active ? "var(--olive)" : "var(--charcoal-light)",
    border: "0.5px solid var(--border-strong)",
    cursor: "pointer",
  };
}

function pillButtonStyle(): React.CSSProperties {
  return {
    display: "inline-block",
    fontSize: "0.72rem",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    padding: "0.55rem 1rem",
    background: "transparent",
    color: "var(--charcoal)",
    border: "0.5px solid var(--border-strong)",
    cursor: "pointer",
    fontFamily: "'Jost', sans-serif",
  };
}
