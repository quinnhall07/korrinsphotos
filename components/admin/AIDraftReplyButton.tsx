"use client";

// components/admin/AIDraftReplyButton.tsx
//
// Renders a button that requests an AI-drafted reply for a project thread.
// On success, calls `onDraftReady(text)` so the parent can paste the draft
// into its composer. On failure, toasts.
//
// Public contract — Agent 6 imports this with the exact shape below.

import { useState } from "react";
import { toast } from "@/components/ui/Toaster";

export interface AIDraftReplyButtonProps {
  projectId: string;
  onDraftReady: (draft: string) => void;
  disabled?: boolean;
}

export function AIDraftReplyButton({
  projectId,
  onDraftReady,
  disabled = false,
}: AIDraftReplyButtonProps): React.JSX.Element {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading || disabled) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai/draft-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      if (!res.ok) {
        let message = `Draft failed (${res.status})`;
        try {
          const data = await res.json();
          if (data?.error && typeof data.error === "string") message = data.error;
        } catch {
          // ignore JSON parse errors — fall through to status-only message
        }
        toast(message);
        return;
      }

      const data = await res.json();
      const text = typeof data?.text === "string" ? data.text.trim() : "";
      if (!text) {
        toast("AI returned an empty draft. Try again.");
        return;
      }

      onDraftReady(text);
      toast("Draft generated");
    } catch (err) {
      console.error("[AIDraftReplyButton] fetch failed:", err);
      toast("Network error generating draft");
    } finally {
      setLoading(false);
    }
  }

  const isDisabled = loading || disabled;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      aria-busy={loading}
      style={{
        fontFamily: "var(--font-jost, 'Jost'), sans-serif",
        fontSize: "0.7rem",
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: "var(--olive)",
        background: "transparent",
        border: "0.5px solid var(--olive)",
        borderRadius: 0,
        padding: "0.55rem 1.1rem",
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.55 : 1,
        transition: "var(--transition)",
        whiteSpace: "nowrap",
      }}
    >
      {loading ? "Drafting…" : "AI draft reply"}
    </button>
  );
}
