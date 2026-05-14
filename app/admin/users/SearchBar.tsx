"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function SearchBar({ initialValue }: { initialValue: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = value.trim();
    const params = new URLSearchParams();
    if (trimmed) params.set("q", trimmed);
    const qs = params.toString();
    router.push(qs ? `/admin/users?${qs}` : "/admin/users");
  }

  function onClear() {
    setValue("");
    router.push("/admin/users");
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: "flex",
        gap: "0.5rem",
        alignItems: "center",
        marginBottom: "1.25rem",
      }}
    >
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search by email or name…"
        style={{
          flex: "0 1 320px",
          padding: "0.55rem 0.8rem",
          fontSize: "0.85rem",
          fontFamily: "'Jost', sans-serif",
          border: "0.5px solid var(--border-strong)",
          background: "var(--white)",
          color: "var(--charcoal)",
          outline: "none",
        }}
      />
      <button
        type="submit"
        style={{
          padding: "0.55rem 1.1rem",
          fontSize: "0.65rem",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--white)",
          background: "var(--olive)",
          border: "0.5px solid var(--olive)",
          cursor: "pointer",
          fontFamily: "'Jost', sans-serif",
        }}
      >
        Search
      </button>
      {initialValue && (
        <button
          type="button"
          onClick={onClear}
          style={{
            padding: "0.55rem 0.9rem",
            fontSize: "0.65rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--charcoal-muted)",
            background: "transparent",
            border: "0.5px solid var(--border-strong)",
            cursor: "pointer",
            fontFamily: "'Jost', sans-serif",
          }}
        >
          Clear
        </button>
      )}
    </form>
  );
}
