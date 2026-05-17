// app/admin/search/page.tsx
// Standalone admin search results page. Renders the same unified search the
// Cmd/Ctrl+K palette uses, grouped by collection. Imports the search helper
// directly (no HTTP hop) since the page renders server-side.
//
// Server Component. requireAdmin() runs on the first line.

import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import {
  searchAdminAll,
  type SearchHit,
  type SearchHitKind,
  type SearchResults,
} from "@/lib/admin/search";
import { SearchBox } from "./SearchBox";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

const SECTION_ORDER: { key: keyof SearchResults; label: string; kind: SearchHitKind }[] = [
  { key: "clients", label: "Clients", kind: "client" },
  { key: "projects", label: "Projects", kind: "project" },
  { key: "events", label: "Events", kind: "event" },
  { key: "vendors", label: "Vendors", kind: "vendor" },
  { key: "journal", label: "Journal", kind: "journal" },
];

function totalHits(results: SearchResults): number {
  return SECTION_ORDER.reduce((sum, s) => sum + results[s.key].length, 0);
}

export default async function AdminSearchPage({ searchParams }: PageProps) {
  await requireAdmin();
  const { q: rawQ } = await searchParams;
  const q = (rawQ ?? "").trim();
  const results = q.length >= 2 ? await searchAdminAll(q) : null;

  return (
    <div style={{ maxWidth: "780px" }}>
      <p
        style={{
          fontSize: "0.65rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--olive)",
          marginBottom: "0.4rem",
          fontWeight: 500,
        }}
      >
        Search
      </p>
      <h1
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontWeight: 300,
          fontSize: "2.4rem",
          margin: "0 0 1.5rem",
          color: "var(--charcoal)",
        }}
      >
        Find anything
      </h1>

      <SearchBox initialQuery={q} />

      {q.length === 0 && (
        <EmptyState message="Type to search across clients, projects, events, vendors, and journal posts." />
      )}

      {q.length > 0 && q.length < 2 && (
        <EmptyState message="Keep typing — at least 2 characters." />
      )}

      {results && totalHits(results) === 0 && (
        <EmptyState message={`No results for "${q}".`} />
      )}

      {results && totalHits(results) > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
          {SECTION_ORDER.map((section) => {
            const hits = results[section.key];
            if (hits.length === 0) return null;
            return (
              <ResultsSection
                key={section.key}
                label={section.label}
                hits={hits}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <p
      style={{
        color: "var(--charcoal-muted)",
        fontSize: "0.92rem",
        padding: "1.25rem 0",
      }}
    >
      {message}
    </p>
  );
}

function ResultsSection({
  label,
  hits,
}: {
  label: string;
  hits: SearchHit[];
}) {
  return (
    <section>
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          borderBottom: "0.5px solid var(--border)",
          paddingBottom: "0.4rem",
          marginBottom: "0.6rem",
        }}
      >
        <p
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--olive)",
            fontWeight: 500,
            margin: 0,
          }}
        >
          {label}
        </p>
        <p
          style={{
            fontSize: "0.7rem",
            color: "var(--charcoal-muted)",
            margin: 0,
          }}
        >
          {hits.length} {hits.length === 1 ? "result" : "results"}
        </p>
      </header>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {hits.map((hit) => (
          <li key={`${hit.kind}-${hit.id}`}>
            <Link
              href={hit.href}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.75rem",
                padding: "0.65rem 0",
                borderBottom: "0.5px solid var(--border)",
                textDecoration: "none",
                color: "var(--charcoal)",
                fontFamily: "'Jost', sans-serif",
              }}
            >
              <span
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.15rem",
                  minWidth: 0,
                  flex: 1,
                }}
              >
                <span
                  style={{
                    fontSize: "0.95rem",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {hit.label}
                </span>
                {hit.sublabel && (
                  <span
                    style={{
                      fontSize: "0.78rem",
                      color: "var(--charcoal-muted)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {hit.sublabel}
                  </span>
                )}
              </span>
              <span
                style={{
                  fontSize: "0.6rem",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: "var(--charcoal-muted)",
                  flexShrink: 0,
                }}
              >
                {hit.kind}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
