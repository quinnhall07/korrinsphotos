"use client";
// components/site-editor/ConfirmDialog.tsx
import { useEffect } from "react";
import { editorStyles } from "./styles";

export function ConfirmDialog({
  open, title, body, confirmLabel = "Confirm", cancelLabel = "Cancel",
  destructive = false, onConfirm, onCancel,
}: {
  open: boolean; title: string; body?: string;
  confirmLabel?: string; cancelLabel?: string; destructive?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onCancel(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div onClick={onCancel} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={panel} role="dialog" aria-modal="true" aria-label={title}>
        <h3 style={dialogTitle}>{title}</h3>
        {body && <p style={dialogBody}>{body}</p>}
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1.25rem" }}>
          <button type="button" onClick={onCancel} style={editorStyles.secondaryBtn}>{cancelLabel}</button>
          <button type="button" onClick={onConfirm} autoFocus
            style={destructive ? { ...editorStyles.primaryBtn, background: "#9a3434", borderColor: "#9a3434" } : editorStyles.primaryBtn}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(42,42,40,0.28)", zIndex: 8800, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" };
const panel: React.CSSProperties = { background: "var(--white)", border: "0.5px solid var(--border-strong)", borderRadius: 8, padding: "1.5rem", maxWidth: 420, width: "100%", boxShadow: "0 20px 50px rgba(0,0,0,0.18)" };
const dialogTitle: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: "1.4rem", margin: 0 };
const dialogBody: React.CSSProperties = { fontWeight: 300, lineHeight: 1.7, color: "var(--charcoal-light)", marginTop: "0.5rem", fontSize: "0.92rem" };
