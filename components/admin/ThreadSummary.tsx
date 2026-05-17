"use client";

// components/admin/ThreadSummary.tsx
//
// Compact card that summarizes a long project thread. Only fetches when
// `messageCount >= 10`; below that it renders a small placeholder.
//
// Public contract — Agent 6 imports this with the exact shape below.

import { useCallback, useEffect, useState } from "react";
import { toast } from "@/components/ui/Toaster";

export interface ThreadSummaryProps {
  projectId: string;
  messageCount: number;
}

const THRESHOLD = 10;

export function ThreadSummary({
  projectId,
  messageCount,
}: ThreadSummaryProps): React.JSX.Element {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setSummary(null);
    try {
      const res = await fetch("/api/ai/summarize-thread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      if (!res.ok) {
        let message = `Summary failed (${res.status})`;
        try {
          const data = await res.json();
          if (data?.error && typeof data.error === "string") message = data.error;
        } catch {
          // ignore parse errors
        }
        toast(message);
        return;
      }

      const data = await res.json();
      const text = typeof data?.summary === "string" ? data.summary.trim() : "";
      if (!text) {
        toast("AI returned an empty summary.");
        return;
      }
      setSummary(text);
    } catch (err) {
      console.error("[ThreadSummary] fetch failed:", err);
      toast("Network error generating summary");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (messageCount >= THRESHOLD) {
      void fetchSummary();
    } else {
      setSummary(null);
      setLoading(false);
    }
  }, [projectId, messageCount, fetchSummary]);

  // Below threshold — compact placeholder.
  if (messageCount < THRESHOLD) {
    return (
      <p
        style={{
          color: "var(--charcoal-muted)",
          fontSize: "0.8rem",
        }}
      >
        Summary appears after 10 messages.
      </p>
    );
  }

  return (
    <div
      style={{
        border: "0.5px solid var(--border)",
        background: "var(--olive-dim)",
        padding: "1rem 1.1rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "0.6rem",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-jost, 'Jost'), sans-serif",
            fontSize: "0.65rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--olive)",
          }}
        >
          Thread summary
        </span>
        <button
          type="button"
          onClick={() => {
            if (!loading) void fetchSummary();
          }}
          disabled={loading}
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: loading ? "not-allowed" : "pointer",
            fontFamily: "var(--font-jost, 'Jost'), sans-serif",
            fontSize: "0.7rem",
            letterSpacing: "0.06em",
            color: "var(--charcoal-light)",
            textDecoration: "underline",
            textUnderlineOffset: "3px",
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? "Regenerating…" : "Regenerate"}
        </button>
      </div>

      {loading ? (
        <ShimmerBlock />
      ) : summary ? (
        <p
          style={{
            color: "var(--charcoal)",
            fontSize: "0.85rem",
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
            margin: 0,
          }}
        >
          {summary}
        </p>
      ) : (
        <p
          style={{
            color: "var(--charcoal-muted)",
            fontSize: "0.8rem",
            margin: 0,
          }}
        >
          No summary yet.
        </p>
      )}
    </div>
  );
}

function ShimmerBlock() {
  return (
    <div
      aria-label="Generating summary"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.45rem",
      }}
    >
      <ShimmerLine width="100%" />
      <ShimmerLine width="92%" />
      <ShimmerLine width="78%" />
    </div>
  );
}

function ShimmerLine({ width }: { width: string }) {
  return (
    <div
      style={{
        width,
        height: "0.7rem",
        background:
          "linear-gradient(90deg, rgba(42,42,40,0.06) 0%, rgba(42,42,40,0.14) 50%, rgba(42,42,40,0.06) 100%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s linear infinite",
        border: "0.5px solid var(--border)",
        borderRadius: 0,
      }}
    />
  );
}
