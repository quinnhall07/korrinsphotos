"use client";

// app/admin/broadcasts/[id]/BroadcastComposerClientPage.tsx
// Block-based composer + live preview + send / schedule controls.
//
// Five block types per the schema:
//   hero      { title; subtitle? }
//   imageGrid { imageUrls: string[] }
//   text      { html }
//   cta       { label; href }
//   footer    { text }
//
// The preview iframe renders the broadcast HTML via the same renderer the
// real send uses (`renderBroadcastClient` mirrors `renderBroadcastHtml` in
// `lib/db/broadcasts.ts`) — kept in-sync because we can't import the server
// module from a client component (it pulls in firebase-admin).
//
// Server-only modules are never imported from this file.

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toaster";
import {
  saveBroadcastAction,
  sendBroadcastAction,
  scheduleBroadcastAction,
  unscheduleBroadcastAction,
} from "../actions";

// ─── Mirror types ────────────────────────────────────────────────────────────

export type BroadcastBlock =
  | { type: "hero"; title: string; subtitle?: string }
  | { type: "imageGrid"; imageUrls: string[] }
  | { type: "text"; html: string }
  | { type: "cta"; label: string; href: string }
  | { type: "footer"; text: string };

export type BroadcastStatusLiteral = "DRAFT" | "SCHEDULED" | "SENDING" | "SENT";

export interface SerializedBroadcastDetail {
  id: string;
  name: string;
  subject: string;
  segmentId: string;
  blocks: BroadcastBlock[];
  status: BroadcastStatusLiteral;
  scheduledFor: string | null;
  sentAt: string | null;
  recipientCount: number | null;
  sentCount: number | null;
  sendIdsByRecipient: Record<string, string> | null;
}

export interface SerializedSegmentOption {
  id: string;
  name: string;
  lastResolvedCount: number | null;
}

export interface BroadcastEngagementStats {
  totalOpens: number;
  uniqueOpens: number;
  totalClicks: number;
}

interface Props {
  broadcast: SerializedBroadcastDetail;
  segments: SerializedSegmentOption[];
  stats: BroadcastEngagementStats;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BroadcastComposerClientPage({ broadcast, segments, stats }: Props) {
  const router = useRouter();
  const [isSaving, startSave] = useTransition();
  const [isSending, startSend] = useTransition();
  const [isScheduling, startSchedule] = useTransition();

  const [name, setName] = useState(broadcast.name);
  const [subject, setSubject] = useState(broadcast.subject);
  const [segmentId, setSegmentId] = useState(broadcast.segmentId);
  const [blocks, setBlocks] = useState<BroadcastBlock[]>(broadcast.blocks ?? []);

  // Schedule fields. <input type="datetime-local"> uses naive local times.
  const initialScheduleLocal = broadcast.scheduledFor
    ? toLocalDatetimeInputValue(broadcast.scheduledFor)
    : "";
  const [scheduleLocal, setScheduleLocal] = useState(initialScheduleLocal);

  const isLocked = broadcast.status === "SENDING" || broadcast.status === "SENT";

  // ─── Block helpers ─────────────────────────────────────────────────────────
  function addBlock(type: BroadcastBlock["type"]) {
    setBlocks((prev) => [...prev, makeDefaultBlock(type)]);
  }
  function removeBlock(index: number) {
    setBlocks((prev) => prev.filter((_, i) => i !== index));
  }
  function moveBlock(index: number, dir: -1 | 1) {
    setBlocks((prev) => {
      const j = index + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }
  function updateBlock(index: number, patch: Partial<BroadcastBlock>) {
    setBlocks((prev) =>
      prev.map((b, i) =>
        i === index ? ({ ...b, ...patch } as BroadcastBlock) : b
      )
    );
  }

  // ─── Live preview HTML ─────────────────────────────────────────────────────
  const previewHtml = useMemo(
    () => renderBroadcastClient({ subject, blocks }),
    [subject, blocks]
  );

  // ─── Actions ───────────────────────────────────────────────────────────────
  function handleSave() {
    startSave(async () => {
      const result = await saveBroadcastAction(broadcast.id, {
        name,
        subject,
        segmentId,
        blocks,
      });
      if (result.success) toast("Broadcast saved");
      else toast(result.error);
    });
  }

  function handleSend() {
    if (isLocked) {
      toast("Already sent or sending");
      return;
    }
    if (
      !confirm(
        `Send this broadcast to everyone in the selected segment? Capped at 500 recipients.`
      )
    ) {
      return;
    }
    startSend(async () => {
      // Persist any in-flight edits first.
      const saveResult = await saveBroadcastAction(broadcast.id, {
        name,
        subject,
        segmentId,
        blocks,
      });
      if (!saveResult.success) {
        toast(saveResult.error);
        return;
      }
      const result = await sendBroadcastAction(broadcast.id);
      if (result.success) {
        const tail = result.data.capped ? " (capped at 500)" : "";
        toast(`Sent to ${result.data.sentCount} recipient(s)${tail}`);
        router.refresh();
      } else {
        toast(result.error);
      }
    });
  }

  function handleSchedule() {
    if (isLocked) {
      toast("Already sent or sending");
      return;
    }
    if (!scheduleLocal) {
      toast("Pick a schedule time first");
      return;
    }
    startSchedule(async () => {
      const saveResult = await saveBroadcastAction(broadcast.id, {
        name,
        subject,
        segmentId,
        blocks,
      });
      if (!saveResult.success) {
        toast(saveResult.error);
        return;
      }
      const iso = new Date(scheduleLocal).toISOString();
      const result = await scheduleBroadcastAction(broadcast.id, iso);
      if (result.success) {
        toast("Broadcast scheduled");
        router.refresh();
      } else {
        toast(result.error);
      }
    });
  }

  function handleUnschedule() {
    startSchedule(async () => {
      const result = await unscheduleBroadcastAction(broadcast.id);
      if (result.success) {
        toast("Schedule cancelled — back to draft");
        router.refresh();
      } else {
        toast(result.error);
      }
    });
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "1.5rem",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: "16rem" }}>
          <p style={eyebrow}>Marketing · Broadcast</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={titleInput}
            disabled={isLocked}
            placeholder="Broadcast name"
          />
          <StatusBadge status={broadcast.status} />
        </div>
      </div>

      {/* Top row — subject, segment, send/schedule */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr) auto",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <label style={miniLabel}>Subject line</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={inputStyle}
            disabled={isLocked}
            placeholder="e.g. A spring update from the studio"
          />
        </div>
        <div>
          <label style={miniLabel}>Segment</label>
          <select
            value={segmentId}
            onChange={(e) => setSegmentId(e.target.value)}
            style={inputStyle}
            disabled={isLocked}
          >
            {segments.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {typeof s.lastResolvedCount === "number"
                  ? ` (~${s.lastResolvedCount})`
                  : ""}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isLocked}
            style={btnOutline}
          >
            {isSaving ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending || isLocked}
            style={isLocked ? btnDisabled : btnOlive}
          >
            {isSending ? "Sending…" : "Send now"}
          </button>
        </div>
      </div>

      {/* Schedule strip */}
      {!isLocked && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.85rem 1rem",
            border: "0.5px solid var(--border)",
            background: "rgba(245,158,11,0.04)",
            marginBottom: "1.5rem",
            flexWrap: "wrap",
          }}
        >
          <p style={{ ...miniLabel, margin: 0 }}>Schedule for</p>
          <input
            type="datetime-local"
            value={scheduleLocal}
            onChange={(e) => setScheduleLocal(e.target.value)}
            style={{ ...inputStyle, width: "auto" }}
          />
          <button
            type="button"
            onClick={handleSchedule}
            disabled={isScheduling || !scheduleLocal}
            style={btnOutlineSm}
          >
            {isScheduling
              ? "…"
              : broadcast.status === "SCHEDULED"
                ? "Re-schedule"
                : "Schedule"}
          </button>
          {broadcast.status === "SCHEDULED" && (
            <button
              type="button"
              onClick={handleUnschedule}
              disabled={isScheduling}
              style={{ ...btnGhostSm, fontSize: "0.66rem" }}
            >
              Cancel schedule
            </button>
          )}
          {broadcast.scheduledFor && (
            <span
              style={{
                fontSize: "0.7rem",
                color: "var(--charcoal-muted)",
                letterSpacing: "0.04em",
              }}
            >
              currently scheduled for {formatDateTime(broadcast.scheduledFor)}
            </span>
          )}
        </div>
      )}

      {/* Engagement report (only after send) */}
      {broadcast.status === "SENT" && (
        <EngagementReport broadcast={broadcast} stats={stats} />
      )}

      {/* Two-pane editor + preview */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: "1.5rem",
        }}
      >
        {/* Block editor */}
        <div>
          <p style={eyebrow}>Blocks</p>
          <div
            style={{
              border: "0.5px solid var(--border)",
              background: "var(--white)",
              padding: "1rem",
            }}
          >
            {blocks.length === 0 && (
              <p
                style={{
                  fontSize: "0.85rem",
                  color: "var(--charcoal-muted)",
                  fontStyle: "italic",
                  padding: "1rem 0",
                  textAlign: "center",
                }}
              >
                No blocks yet — add one below.
              </p>
            )}
            {blocks.map((block, i) => (
              <BlockEditor
                key={i}
                block={block}
                index={i}
                total={blocks.length}
                disabled={isLocked}
                onChange={(patch) => updateBlock(i, patch)}
                onRemove={() => removeBlock(i)}
                onMove={(dir) => moveBlock(i, dir)}
              />
            ))}

            {!isLocked && (
              <div
                style={{
                  display: "flex",
                  gap: "0.4rem",
                  flexWrap: "wrap",
                  paddingTop: "1rem",
                  borderTop: blocks.length ? "0.5px solid var(--border)" : "none",
                  marginTop: blocks.length ? "0.5rem" : "0",
                }}
              >
                {(["hero", "imageGrid", "text", "cta", "footer"] as const).map(
                  (t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => addBlock(t)}
                      style={chipBase}
                    >
                      + {labelForType(t)}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        </div>

        {/* Live preview */}
        <div>
          <p style={eyebrow}>Live preview</p>
          <PreviewFrame html={previewHtml} />
        </div>
      </div>
    </div>
  );
}

// ─── Engagement report card ──────────────────────────────────────────────────

function EngagementReport({
  broadcast,
  stats,
}: {
  broadcast: SerializedBroadcastDetail;
  stats: BroadcastEngagementStats;
}) {
  const recipients = broadcast.sentCount ?? broadcast.recipientCount ?? 0;
  const openRate =
    recipients > 0 ? Math.round((stats.uniqueOpens / recipients) * 100) : 0;
  const clickRate =
    recipients > 0 ? Math.round((stats.totalClicks / recipients) * 100) : 0;

  return (
    <div
      style={{
        border: "0.5px solid var(--border-strong)",
        background: "var(--white)",
        padding: "1.2rem 1.4rem",
        marginBottom: "1.5rem",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(8rem, 1fr))",
        gap: "1rem",
      }}
    >
      <Stat label="Recipients" value={String(recipients)} />
      <Stat label="Opens (unique)" value={String(stats.uniqueOpens)} sub={`${openRate}%`} />
      <Stat label="Opens (total)" value={String(stats.totalOpens)} />
      <Stat label="Clicks" value={String(stats.totalClicks)} sub={`${clickRate}%`} />
      <Stat
        label="Sent at"
        value={broadcast.sentAt ? formatDateTime(broadcast.sentAt) : "—"}
      />
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p style={{ ...eyebrow, marginBottom: "0.3rem" }}>{label}</p>
      <p
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "1.8rem",
          fontWeight: 300,
          lineHeight: 1.1,
          color: "var(--charcoal)",
        }}
      >
        {value}
      </p>
      {sub && (
        <p
          style={{
            fontSize: "0.7rem",
            color: "var(--charcoal-muted)",
            letterSpacing: "0.04em",
            marginTop: "0.2rem",
          }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

// ─── Per-block editor ────────────────────────────────────────────────────────

function BlockEditor({
  block,
  index,
  total,
  disabled,
  onChange,
  onRemove,
  onMove,
}: {
  block: BroadcastBlock;
  index: number;
  total: number;
  disabled: boolean;
  onChange: (patch: Partial<BroadcastBlock>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  return (
    <div
      style={{
        border: "0.5px solid var(--border)",
        padding: "0.85rem 1rem",
        marginBottom: "0.6rem",
        background: "rgba(42,42,40,0.02)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.65rem",
        }}
      >
        <p
          style={{
            fontSize: "0.62rem",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--olive)",
            margin: 0,
          }}
        >
          {labelForType(block.type)}
        </p>
        <div style={{ display: "flex", gap: "0.3rem" }}>
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={disabled || index === 0}
            style={btnGhostXs}
            title="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={disabled || index === total - 1}
            style={btnGhostXs}
            title="Move down"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            style={{ ...btnGhostXs, color: "#991B1B" }}
            title="Remove block"
          >
            ×
          </button>
        </div>
      </div>

      {block.type === "hero" && (
        <>
          <input
            value={block.title}
            onChange={(e) => onChange({ title: e.target.value })}
            disabled={disabled}
            placeholder="Title"
            style={inputStyle}
          />
          <input
            value={block.subtitle ?? ""}
            onChange={(e) => onChange({ subtitle: e.target.value })}
            disabled={disabled}
            placeholder="Subtitle (optional)"
            style={{ ...inputStyle, marginTop: "0.5rem" }}
          />
        </>
      )}

      {block.type === "imageGrid" && (
        <>
          <textarea
            value={(block.imageUrls ?? []).join("\n")}
            onChange={(e) =>
              onChange({
                imageUrls: e.target.value
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            disabled={disabled}
            placeholder="One image URL per line"
            rows={4}
            style={{ ...inputStyle, fontFamily: "monospace", fontSize: "0.78rem" }}
          />
          <p style={hintText}>
            Use absolute CDN URLs (`https://imagedelivery.net/...`). Two-column layout for ≥2 images.
          </p>
        </>
      )}

      {block.type === "text" && (
        <>
          <textarea
            value={block.html}
            onChange={(e) => onChange({ html: e.target.value })}
            disabled={disabled}
            placeholder="<p>HTML body</p>"
            rows={5}
            style={{ ...inputStyle, fontFamily: "monospace", fontSize: "0.78rem" }}
          />
          <p style={hintText}>HTML allowed. Scripts are stripped.</p>
        </>
      )}

      {block.type === "cta" && (
        <>
          <input
            value={block.label}
            onChange={(e) => onChange({ label: e.target.value })}
            disabled={disabled}
            placeholder="Button label"
            style={inputStyle}
          />
          <input
            value={block.href}
            onChange={(e) => onChange({ href: e.target.value })}
            disabled={disabled}
            placeholder="https://..."
            style={{ ...inputStyle, marginTop: "0.5rem" }}
          />
        </>
      )}

      {block.type === "footer" && (
        <input
          value={block.text}
          onChange={(e) => onChange({ text: e.target.value })}
          disabled={disabled}
          placeholder="Studio · City · Unsubscribe link if applicable"
          style={inputStyle}
        />
      )}
    </div>
  );
}

// ─── Preview frame ───────────────────────────────────────────────────────────

function PreviewFrame({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const ifr = iframeRef.current;
    if (!ifr) return;
    // srcdoc handles full-document strings cleanly across browsers.
    ifr.srcdoc = html;
  }, [html]);

  return (
    <div
      style={{
        border: "0.5px solid var(--border)",
        background: "var(--white)",
        overflow: "hidden",
        minHeight: "32rem",
      }}
    >
      <iframe
        ref={iframeRef}
        title="Broadcast preview"
        sandbox=""
        style={{
          width: "100%",
          height: "40rem",
          border: "none",
          display: "block",
        }}
      />
    </div>
  );
}

// ─── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: BroadcastStatusLiteral }) {
  const palette: Record<BroadcastStatusLiteral, { bg: string; fg: string }> = {
    DRAFT: { bg: "rgba(42,42,40,0.06)", fg: "var(--charcoal-light)" },
    SCHEDULED: { bg: "rgba(245,158,11,0.12)", fg: "#92400E" },
    SENDING: { bg: "rgba(107,120,69,0.12)", fg: "var(--olive)" },
    SENT: { bg: "rgba(34,197,94,0.12)", fg: "#15803D" },
  };
  const c = palette[status];
  return (
    <span
      style={{
        fontSize: "0.62rem",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        background: c.bg,
        color: c.fg,
        padding: "0.35rem 0.55rem",
        display: "inline-block",
        marginTop: "0.6rem",
        fontFamily: "'Jost', sans-serif",
      }}
    >
      {status}
    </span>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeDefaultBlock(type: BroadcastBlock["type"]): BroadcastBlock {
  switch (type) {
    case "hero":
      return { type: "hero", title: "Title goes here", subtitle: "" };
    case "imageGrid":
      return { type: "imageGrid", imageUrls: [] };
    case "text":
      return { type: "text", html: "<p>Body copy.</p>" };
    case "cta":
      return { type: "cta", label: "Book a session", href: "https://" };
    case "footer":
      return { type: "footer", text: "Korrin's Photography · Cary, NC" };
  }
}

function labelForType(t: BroadcastBlock["type"]): string {
  switch (t) {
    case "hero":
      return "Hero";
    case "imageGrid":
      return "Image grid";
    case "text":
      return "Text";
    case "cta":
      return "Call to action";
    case "footer":
      return "Footer";
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/**
 * Convert an ISO UTC string into the local "YYYY-MM-DDTHH:mm" format that
 * `<input type="datetime-local">` requires. Returns "" when the value is empty.
 */
function toLocalDatetimeInputValue(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

// ─── Render mirror ───────────────────────────────────────────────────────────

/**
 * Mirror of `renderBroadcastHtml` in `lib/db/broadcasts.ts`. Kept in this file
 * because the server module imports `firebase-admin` (forbidden in client
 * bundles). The two functions must stay in lockstep — see the matching
 * comment in `lib/db/broadcasts.ts`. Tests live in the broadcast send path:
 * an integration test that exercises both paths would catch any drift.
 */
function renderBroadcastClient(b: {
  subject: string;
  blocks: BroadcastBlock[];
}): string {
  const blocksHtml = b.blocks.map(renderBlockClient).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(b.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#FAF9F6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#2A2A28;-webkit-font-smoothing:antialiased;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAF9F6;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="620" style="max-width:620px;width:100%;background:#FFFFFF;border:0.5px solid rgba(42,42,40,0.12);">
${blocksHtml}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderBlockClient(block: BroadcastBlock): string {
  switch (block.type) {
    case "hero": {
      const subtitle = block.subtitle
        ? `<p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#4A4A47;letter-spacing:0.04em;">${escapeHtml(
            block.subtitle
          )}</p>`
        : "";
      return `          <tr>
            <td style="padding:48px 40px 24px;text-align:center;border-bottom:0.5px solid rgba(42,42,40,0.12);">
              <h1 style="margin:0;font-family:Georgia,'Cormorant Garamond',serif;font-size:32px;font-weight:300;line-height:1.2;color:#2A2A28;">${escapeHtml(
                block.title
              )}</h1>
              ${subtitle}
            </td>
          </tr>`;
    }
    case "imageGrid": {
      const urls = (block.imageUrls ?? []).filter((u) => typeof u === "string" && u.trim());
      if (urls.length === 0) return "";
      if (urls.length === 1) {
        return `          <tr>
            <td style="padding:24px 40px;text-align:center;">
              <img src="${escapeHtmlAttr(urls[0])}" alt="" width="540" style="max-width:100%;height:auto;display:block;margin:0 auto;border:0;" />
            </td>
          </tr>`;
      }
      const rows: string[] = [];
      for (let i = 0; i < urls.length; i += 2) {
        const row = urls
          .slice(i, i + 2)
          .map(
            (u) =>
              `              <td width="50%" style="padding:6px;text-align:center;"><img src="${escapeHtmlAttr(
                u
              )}" alt="" width="260" style="max-width:100%;height:auto;display:block;border:0;" /></td>`
          )
          .join("\n");
        rows.push(`            <tr>\n${row}\n            </tr>`);
      }
      return `          <tr>
            <td style="padding:18px 34px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
${rows.join("\n")}
              </table>
            </td>
          </tr>`;
    }
    case "text":
      return `          <tr>
            <td style="padding:20px 40px;font-size:15px;line-height:1.7;color:#2A2A28;">
              ${stripScripts(block.html ?? "")}
            </td>
          </tr>`;
    case "cta":
      return `          <tr>
            <td style="padding:24px 40px 32px;text-align:center;">
              <a href="${escapeHtmlAttr(block.href)}"
                 style="display:inline-block;padding:14px 36px;background:#6B7845;color:#FFFFFF;text-decoration:none;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;border:none;">
                ${escapeHtml(block.label)}
              </a>
            </td>
          </tr>`;
    case "footer":
      return `          <tr>
            <td style="padding:24px 40px 32px;border-top:0.5px solid rgba(42,42,40,0.12);font-size:12px;line-height:1.6;color:#8A8A85;text-align:center;letter-spacing:0.04em;">
              ${escapeHtml(block.text)}
            </td>
          </tr>`;
  }
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function escapeHtmlAttr(s: string): string {
  return escapeHtml(s).replace(/`/g, "&#96;");
}
function stripScripts(html: string): string {
  return String(html ?? "").replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    ""
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const eyebrow: React.CSSProperties = {
  fontSize: "0.65rem",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "var(--olive)",
  marginBottom: "0.5rem",
};

const titleInput: React.CSSProperties = {
  display: "block",
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: "2rem",
  fontWeight: 300,
  border: "none",
  background: "transparent",
  outline: "none",
  width: "100%",
  padding: "0.1rem 0",
  color: "var(--charcoal)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.65rem 0.85rem",
  fontSize: "0.85rem",
  border: "0.5px solid var(--border)",
  background: "var(--white)",
  color: "var(--charcoal)",
  fontFamily: "'Jost', sans-serif",
  outline: "none",
};

const hintText: React.CSSProperties = {
  fontSize: "0.7rem",
  color: "var(--charcoal-muted)",
  marginTop: "0.4rem",
  letterSpacing: "0.04em",
};

const miniLabel: React.CSSProperties = {
  display: "block",
  fontSize: "0.6rem",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--charcoal-muted)",
  marginBottom: "0.35rem",
};

const chipBase: React.CSSProperties = {
  padding: "0.45rem 0.75rem",
  fontSize: "0.7rem",
  letterSpacing: "0.06em",
  background: "var(--white)",
  color: "var(--charcoal)",
  border: "0.5px solid var(--border-strong)",
  cursor: "pointer",
  fontFamily: "'Jost', sans-serif",
};

const btnOlive: React.CSSProperties = {
  padding: "0.85rem 2.2rem",
  fontSize: "0.72rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  background: "var(--olive)",
  color: "var(--white)",
  border: "none",
  cursor: "pointer",
  fontFamily: "'Jost', sans-serif",
};

const btnDisabled: React.CSSProperties = {
  ...btnOlive,
  background: "rgba(42,42,40,0.12)",
  color: "var(--charcoal-muted)",
  cursor: "not-allowed",
};

const btnOutline: React.CSSProperties = {
  padding: "0.85rem 1.6rem",
  fontSize: "0.72rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  background: "none",
  color: "var(--charcoal)",
  border: "0.5px solid var(--border-strong)",
  cursor: "pointer",
  fontFamily: "'Jost', sans-serif",
};

const btnOutlineSm: React.CSSProperties = {
  padding: "0.55rem 1rem",
  fontSize: "0.66rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  background: "none",
  color: "var(--charcoal)",
  border: "0.5px solid var(--border-strong)",
  cursor: "pointer",
  fontFamily: "'Jost', sans-serif",
};

const btnGhostSm: React.CSSProperties = {
  padding: "0.4rem 0.7rem",
  fontSize: "0.7rem",
  background: "none",
  border: "0.5px solid var(--border)",
  cursor: "pointer",
  fontFamily: "'Jost', sans-serif",
  lineHeight: 1,
};

const btnGhostXs: React.CSSProperties = {
  padding: "0.25rem 0.5rem",
  fontSize: "0.78rem",
  background: "none",
  border: "0.5px solid var(--border)",
  cursor: "pointer",
  fontFamily: "'Jost', sans-serif",
  lineHeight: 1,
};

