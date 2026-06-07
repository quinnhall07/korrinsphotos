"use client";
// components/site-editor/PublishDialog.tsx
import { useEffect, useState } from "react";
import { editorStyles } from "./styles";

export function PublishDialog({
  open, isPending, onPublish, onCancel,
}: { open: boolean; isPending?: boolean; onPublish: (note?: string) => void; onCancel: () => void }) {
  const [note, setNote] = useState("");
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onCancel(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);
  useEffect(() => { if (open) setNote(""); }, [open]);
  if (!open) return null;
  return (
    <div onClick={onCancel} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={panel} role="dialog" aria-modal="true" aria-label="Publish page">
        <h3 style={dialogTitle}>Publish this page?</h3>
        <p style={dialogBody}>Your draft will go live immediately. Add an optional note for the revision history.</p>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} autoFocus
          placeholder="e.g. Updated pricing copy" style={textareaStyle} />
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1.25rem" }}>
          <button type="button" onClick={onCancel} disabled={isPending} style={editorStyles.secondaryBtn}>Cancel</button>
          <button type="button" onClick={() => onPublish(note.trim() || undefined)} disabled={isPending} style={editorStyles.publishBtn}>
            {isPending ? "Publishing…" : "Publish now"}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(42,42,40,0.28)", zIndex: 8800, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" };
const panel: React.CSSProperties = { background: "var(--white)", border: "0.5px solid var(--border-strong)", borderRadius: 8, padding: "1.5rem", maxWidth: 460, width: "100%", boxShadow: "0 20px 50px rgba(0,0,0,0.18)" };
const dialogTitle: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: "1.4rem", margin: 0 };
const dialogBody: React.CSSProperties = { fontWeight: 300, lineHeight: 1.7, color: "var(--charcoal-light)", margin: "0.5rem 0 1rem", fontSize: "0.92rem" };
const textareaStyle: React.CSSProperties = { width: "100%", padding: "0.6rem 0.7rem", border: "0.5px solid var(--border-strong)", borderRadius: 4, font: "inherit", fontSize: "0.9rem", resize: "vertical" };
