"use client";

// app/admin/exports/ExpenseYearPicker.tsx
// Wave 11 — small interactive control for the Expenses card on /admin/exports.
// Updates the download link target when the year changes; the rest of the
// /admin/exports page is a Server Component.

import { useState } from "react";

interface Props {
  years: number[];
  defaultYear: number;
}

export function ExpenseYearPicker({ years, defaultYear }: Props) {
  const [year, setYear] = useState<number>(defaultYear);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
      <label
        htmlFor="exp-year"
        style={{
          fontSize: "0.65rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--charcoal-muted)",
        }}
      >
        Year
      </label>
      <select
        id="exp-year"
        value={year}
        onChange={(e) => setYear(Number(e.target.value))}
        style={{
          background: "transparent",
          border: "0.5px solid var(--border-strong)",
          padding: "0.4rem 0.6rem",
          fontFamily: "inherit",
          fontSize: "0.78rem",
          color: "var(--charcoal)",
        }}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <a
        href={`/api/expenses/export?year=${year}`}
        download
        style={{
          fontSize: "0.72rem",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--olive)",
          borderBottom: "0.5px solid var(--olive)",
          paddingBottom: "2px",
          textDecoration: "none",
        }}
      >
        Download CSV
      </a>
    </div>
  );
}
