"use client";

// app/admin/search/SearchBox.tsx
// Lightweight client form for the /admin/search page. Submits on Enter to
// /admin/search?q=<value>, keeps the input populated with the current `q`,
// and uses the standard editorial input styling.

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function SearchBox({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = value.trim();
    const params = new URLSearchParams();
    if (trimmed) params.set("q", trimmed);
    const qs = params.toString();
    router.push(qs ? `/admin/search?${qs}` : "/admin/search");
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: "flex",
        gap: "0.5rem",
        alignItems: "stretch",
        marginBottom: "2rem",
      }}
    >
      <input
        type="search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search clients, projects, events, vendors, journal…"
        autoFocus
        spellCheck={false}
        autoComplete="off"
        style={{
          flex: 1,
          padding: "0.7rem 0.95rem",
          border: "0.5px solid var(--border-strong)",
          background: "var(--white)",
          fontFamily: "'Jost', sans-serif",
          fontSize: "0.95rem",
          color: "var(--charcoal)",
          outline: "none",
        }}
      />
      <button
        type="submit"
        style={{
          padding: "0.7rem 1.4rem",
          border: "0.5px solid var(--charcoal)",
          background: "var(--charcoal)",
          color: "var(--white)",
          fontFamily: "'Jost', sans-serif",
          fontSize: "0.78rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          cursor: "pointer",
        }}
      >
        Search
      </button>
    </form>
  );
}
