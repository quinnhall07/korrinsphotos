"use client";

// app/admin/bookings/ViewToggle.tsx
// Segmented control to switch between Kanban and Table view.
// Persists the preference to localStorage.

import { useEffect } from "react";

type View = "kanban" | "table";

interface ViewToggleProps {
  value: View;
  onChange: (v: View) => void;
}

const VIEWS: { id: View; label: string; icon: React.ReactNode }[] = [
  {
    id: "kanban",
    label: "Pipeline",
    icon: (
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
        <rect x="1" y="1" width="3" height="12" rx="0.5" />
        <rect x="5.5" y="1" width="3" height="8" rx="0.5" />
        <rect x="10" y="1" width="3" height="10" rx="0.5" />
      </svg>
    ),
  },
  {
    id: "table",
    label: "Table",
    icon: (
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
        <rect x="1" y="1" width="12" height="12" rx="0.5" />
        <path d="M1 5h12M1 9h12M5 1v12" />
      </svg>
    ),
  },
];

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  // Persist preference
  useEffect(() => {
    try {
      localStorage.setItem("bookings_view", value);
    } catch {}
  }, [value]);

  return (
    <div
      style={{
        display: "inline-flex",
        border: "0.5px solid var(--border-strong)",
        overflow: "hidden",
      }}
    >
      {VIEWS.map((v, i) => {
        const active = value === v.id;
        return (
          <button
            key={v.id}
            onClick={() => onChange(v.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.45rem",
              padding: "0.55rem 1rem",
              fontSize: "0.68rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              cursor: "pointer",
              background: active ? "var(--charcoal)" : "transparent",
              color: active ? "var(--white)" : "var(--charcoal-muted)",
              border: "none",
              borderRight: i < VIEWS.length - 1 ? "0.5px solid var(--border-strong)" : "none",
              fontFamily: "'Jost', sans-serif",
              transition: "all 0.15s",
            }}
          >
            <span style={{ display: "flex" }}>{v.icon}</span>
            {v.label}
          </button>
        );
      })}
    </div>
  );
}