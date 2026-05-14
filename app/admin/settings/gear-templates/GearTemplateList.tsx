"use client";

// app/admin/settings/gear-templates/GearTemplateList.tsx
// Client list view with a sessionType filter. Receives a serialised summary
// from the parent Server Component.

import { useMemo, useState } from "react";
import Link from "next/link";

interface TemplateRow {
  id: string;
  name: string;
  sessionType: string;
  itemCount: number;
  requiredCount: number;
  isDefault: boolean;
  updatedAt: string | null;
}

export function GearTemplateList({ templates }: { templates: TemplateRow[] }) {
  const sessionTypes = useMemo(() => {
    const set = new Set<string>();
    for (const t of templates) set.add(t.sessionType);
    return ["ALL", ...Array.from(set).sort()];
  }, [templates]);

  const [filter, setFilter] = useState<string>("ALL");

  const filtered = useMemo(
    () =>
      filter === "ALL"
        ? templates
        : templates.filter((t) => t.sessionType === filter),
    [filter, templates]
  );

  if (templates.length === 0) {
    return (
      <div
        style={{
          padding: "4rem 2rem",
          textAlign: "center",
          border: "0.5px dashed var(--border-strong)",
          background: "var(--white)",
        }}
      >
        <p style={{ ...eyebrow, marginBottom: "0.8rem" }}>Empty</p>
        <p
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "1.3rem",
            fontWeight: 300,
            color: "var(--charcoal)",
            lineHeight: 1.4,
            maxWidth: "32rem",
            margin: "0 auto",
          }}
        >
          No gear kits yet. Seed defaults with{" "}
          <code style={{ fontSize: "0.85rem" }}>
            npx tsx scripts/seed-gear-templates.ts
          </code>{" "}
          or build one from scratch.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Filter chip row */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.4rem",
          marginBottom: "1.25rem",
        }}
      >
        {sessionTypes.map((s) => {
          const active = filter === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              style={{
                padding: "0.4rem 0.85rem",
                fontSize: "0.7rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontFamily: "'Jost', sans-serif",
                background: active ? "var(--olive-dim)" : "transparent",
                color: active ? "var(--olive)" : "var(--charcoal-light)",
                border: active
                  ? "0.5px solid var(--olive)"
                  : "0.5px solid var(--border-strong)",
                borderRadius: 0,
                cursor: "pointer",
              }}
            >
              {s}
            </button>
          );
        })}
      </div>

      <div
        style={{
          border: "0.5px solid var(--border)",
          background: "var(--white)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(0, 1.6fr) minmax(0, 1fr) 5rem 6rem 8rem",
            gap: "1rem",
            padding: "0.9rem 1.25rem",
            borderBottom: "0.5px solid var(--border)",
            fontSize: "0.62rem",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--charcoal-muted)",
          }}
        >
          <span>Name</span>
          <span>Session Type</span>
          <span>Items</span>
          <span>Required</span>
          <span style={{ textAlign: "right" }}>Updated</span>
        </div>

        {filtered.map((t, i) => (
          <Link
            key={t.id}
            href={`/admin/settings/gear-templates/${t.id}`}
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(0, 1.6fr) minmax(0, 1fr) 5rem 6rem 8rem",
              gap: "1rem",
              padding: "1.1rem 1.25rem",
              borderBottom:
                i === filtered.length - 1
                  ? "none"
                  : "0.5px solid var(--border)",
              alignItems: "center",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <span
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "1.2rem",
                fontWeight: 300,
                color: "var(--charcoal)",
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
              }}
            >
              {t.name}
              {t.isDefault && (
                <span
                  style={{
                    fontFamily: "'Jost', sans-serif",
                    fontSize: "0.6rem",
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    padding: "0.15rem 0.5rem",
                    background: "var(--olive-dim)",
                    color: "var(--olive)",
                    border: "0.5px solid var(--olive)",
                  }}
                >
                  Default
                </span>
              )}
            </span>
            <span
              style={{
                fontSize: "0.78rem",
                color: "var(--charcoal-light)",
              }}
            >
              {t.sessionType}
            </span>
            <span
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "1.05rem",
                color: "var(--charcoal)",
              }}
            >
              {t.itemCount}
            </span>
            <span
              style={{
                fontSize: "0.78rem",
                color: "var(--charcoal-light)",
              }}
            >
              {t.requiredCount}
            </span>
            <span
              style={{
                fontSize: "0.78rem",
                color: "var(--charcoal-muted)",
                textAlign: "right",
              }}
            >
              {t.updatedAt
                ? new Date(t.updatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "—"}
            </span>
          </Link>
        ))}

        {filtered.length === 0 && (
          <div
            style={{
              padding: "2.5rem 1.25rem",
              textAlign: "center",
              fontSize: "0.85rem",
              color: "var(--charcoal-muted)",
              fontFamily: "'Jost', sans-serif",
            }}
          >
            No kits for {filter}.
          </div>
        )}
      </div>
    </>
  );
}

const eyebrow: React.CSSProperties = {
  fontSize: "0.65rem",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "var(--olive)",
};
