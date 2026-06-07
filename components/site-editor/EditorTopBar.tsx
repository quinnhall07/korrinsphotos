"use client";
// components/site-editor/EditorTopBar.tsx
import { editorStyles } from "./styles";
import type { SaveStatus } from "./useAutosave";

export const TOP_BAR_HEIGHT = 56;
export type DeviceMode = "desktop" | "tablet" | "mobile";

const STATUS_TEXT: Record<SaveStatus, string> = {
  saved: "All changes saved", unsaved: "Editing…", saving: "Saving…", error: "Save failed — retrying on next change",
};

export function EditorTopBar({
  pageLabel, status, canUndo, canRedo, device,
  onUndo, onRedo, onDeviceChange, onPublish, onDiscard, onOpenRevisions, onExit,
}: {
  pageLabel: string; status: SaveStatus; canUndo: boolean; canRedo: boolean; device: DeviceMode;
  onUndo: () => void; onRedo: () => void; onDeviceChange: (d: DeviceMode) => void;
  onPublish: () => void; onDiscard: () => void; onOpenRevisions: () => void; onExit: () => void;
}) {
  return (
    <div role="toolbar" aria-label="Site editor" style={bar}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", minWidth: 0 }}>
        <span style={eyebrow}>Editing</span>
        <span style={label}>{pageLabel}</span>
        <span style={{ fontSize: "0.7rem", color: status === "error" ? "#9a3434" : "var(--charcoal-muted)", letterSpacing: "0.06em" }}>
          • {STATUS_TEXT[status]}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <button type="button" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl/Cmd+Z)"
          style={{ ...editorStyles.secondaryBtn, opacity: canUndo ? 1 : 0.4 }}>↶</button>
        <button type="button" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl/Cmd+Shift+Z)"
          style={{ ...editorStyles.secondaryBtn, opacity: canRedo ? 1 : 0.4 }}>↷</button>
        <div role="group" aria-label="Preview width" style={{ display: "flex", border: "0.5px solid var(--border-strong)", borderRadius: 4, overflow: "hidden" }}>
          {(["desktop", "tablet", "mobile"] as DeviceMode[]).map((d) => (
            <button key={d} type="button" onClick={() => onDeviceChange(d)} aria-pressed={device === d}
              title={d} style={{ border: "none", padding: "0.3rem 0.6rem", cursor: "pointer", fontSize: "0.85rem",
                background: device === d ? "var(--olive-dim)" : "transparent", color: "var(--charcoal)" }}>
              {d === "desktop" ? "▭" : d === "tablet" ? "▢" : "▯"}
            </button>
          ))}
        </div>
        <button type="button" onClick={onOpenRevisions} style={editorStyles.secondaryBtn}>Revisions</button>
        <button type="button" onClick={onDiscard} style={editorStyles.secondaryBtn}>Discard</button>
        <button type="button" onClick={onPublish} style={editorStyles.publishBtn}>Publish</button>
        <button type="button" onClick={onExit} style={editorStyles.secondaryBtn}>Exit</button>
      </div>
    </div>
  );
}

const bar: React.CSSProperties = { position: "sticky", top: 0, zIndex: 8600, height: TOP_BAR_HEIGHT, background: "var(--white)", borderBottom: "0.5px solid var(--border-strong)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 1.25rem", gap: "1rem", boxShadow: "0 1px 0 rgba(42,42,40,0.04)" };
const eyebrow: React.CSSProperties = { fontSize: "0.62rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--olive)" };
const label: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontSize: "1.1rem", fontWeight: 300, color: "var(--charcoal)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
