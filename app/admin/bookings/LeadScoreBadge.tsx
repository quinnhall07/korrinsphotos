"use client";

// app/admin/bookings/LeadScoreBadge.tsx
// Visual indicator of the 0-100 lead score with color coding and label.

import { getScoreColor, getScoreBackground, getScoreLabel } from "@/lib/lead-scoring";

interface LeadScoreBadgeProps {
  score: number;
  showLabel?: boolean;
  size?: "sm" | "md";
}

export function LeadScoreBadge({
  score,
  showLabel = false,
  size = "sm",
}: LeadScoreBadgeProps) {
  const color = getScoreColor(score);
  const bg    = getScoreBackground(score);
  const label = getScoreLabel(score);

  if (size === "md") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {/* Circular gauge */}
        <div style={{ position: "relative", width: 48, height: 48, flexShrink: 0 }}>
          <svg viewBox="0 0 36 36" width="48" height="48" style={{ transform: "rotate(-90deg)" }}>
            <circle
              cx="18" cy="18" r="15.5"
              fill="none"
              stroke="rgba(42,42,40,0.08)"
              strokeWidth="3"
            />
            <circle
              cx="18" cy="18" r="15.5"
              fill="none"
              stroke={color}
              strokeWidth="3"
              strokeDasharray={`${(score / 100) * 97.4} 97.4`}
              strokeLinecap="round"
              style={{ transition: "stroke-dasharray 0.6s ease" }}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.72rem",
              fontWeight: 600,
              color,
              fontFamily: "'Jost', sans-serif",
            }}
          >
            {score}
          </div>
        </div>
        <div>
          <p style={{ fontSize: "1rem", fontWeight: 500, color, fontFamily: "'Jost', sans-serif" }}>
            {label}
          </p>
          <p style={{ fontSize: "0.7rem", color: "var(--charcoal-muted)", marginTop: "0.1rem" }}>
            Lead score
          </p>
        </div>
      </div>
    );
  }

  return (
    <span
      title={`Lead score: ${score}/100 — ${label}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3rem",
        padding: "0.2rem 0.55rem",
        background: bg,
        color,
        fontSize: "0.62rem",
        fontWeight: 600,
        letterSpacing: "0.06em",
        fontFamily: "'Jost', sans-serif",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {score}
      {showLabel && <span style={{ fontWeight: 400, opacity: 0.8 }}>· {label}</span>}
    </span>
  );
}