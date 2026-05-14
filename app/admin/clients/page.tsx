// app/admin/clients/page.tsx — Wave 11
//
// Dedicated client directory. The clients collection has been canonical since
// Wave 1 but never had a first-class admin surface — until now. Pulls clients,
// joins each row to its most recent project (status + count) and sums lifetime
// value from PAID invoices only.
//
// Sort modes:
//   recent   — Firestore `orderBy("createdAt", "desc")` (default; supports cursor pagination)
//   ltv      — sorted in-memory by sum of PAID invoices (no cursor)
//   sessions — sorted in-memory by `totalSessionsBooked` (no cursor)
//
// Pagination is forward-only (cursor) for `recent` only — see `lib/db/clients.ts`.

import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import {
  listClientsPaginated,
  searchClients,
  type ClientDoc,
  type ClientSort,
  type LeadSource,
} from "@/lib/db/clients";
import { invoicesCol, type InvoiceDoc } from "@/lib/db/invoices";
import { projectsCol, type ProjectDoc, type ProjectStatus } from "@/lib/db/projects";
import { formatDisplayDate } from "@/lib/date";
import { SearchBar } from "./SearchBar";

export const metadata: Metadata = { title: "Clients | Admin" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

const SOURCE_LABELS: Record<LeadSource, string> = {
  WEBSITE: "Website",
  INSTAGRAM: "Instagram",
  GOOGLE: "Google",
  REFERRAL: "Referral",
  DIRECT: "Direct",
  OTHER: "Other",
};

interface ClientRow {
  id: string;
  fullName: string;
  email: string;
  firstTouchSource: LeadSource;
  totalSessionsBooked: number;
  lifetimeValueCents: number;
  lastProjectStatus: ProjectStatus | null;
  createdAt: string;
}

function fmtUsd(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function statusLabel(status: ProjectStatus | null): string {
  if (!status) return "—";
  return status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildHref(params: { cursor?: string | null; q?: string; sort?: ClientSort }): string {
  const sp = new URLSearchParams();
  if (params.cursor) sp.set("cursor", params.cursor);
  if (params.q) sp.set("q", params.q);
  if (params.sort && params.sort !== "recent") sp.set("sort", params.sort);
  const qs = sp.toString();
  return qs ? `/admin/clients?${qs}` : "/admin/clients";
}

async function decorateRows(clients: ClientDoc[]): Promise<ClientRow[]> {
  if (clients.length === 0) return [];
  const ids = clients.map((c) => c.id);

  // Firestore `in` is capped at 30 values; chunk if needed.
  async function chunkedIn<T>(
    fetcher: (chunk: string[]) => Promise<T[]>,
    chunkSize = 30
  ): Promise<T[]> {
    const out: T[] = [];
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      out.push(...(await fetcher(chunk)));
    }
    return out;
  }

  const [invoices, projects] = await Promise.all([
    chunkedIn(async (chunk) => {
      const snap = await invoicesCol().where("clientId", "in", chunk).get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as InvoiceDoc));
    }),
    chunkedIn(async (chunk) => {
      const snap = await projectsCol().where("clientId", "in", chunk).get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProjectDoc));
    }),
  ]);

  // LTV math — ONLY PAID invoices count toward lifetime value.
  const ltvByClient = new Map<string, number>();
  for (const inv of invoices) {
    if (inv.status !== "PAID") continue;
    const prior = ltvByClient.get(inv.clientId) ?? 0;
    ltvByClient.set(inv.clientId, prior + (Number(inv.amountCents) || 0));
  }

  // Most recent project per client (by createdAt desc).
  const latestProjectByClient = new Map<string, ProjectDoc>();
  for (const p of projects) {
    const existing = latestProjectByClient.get(p.clientId);
    if (!existing) {
      latestProjectByClient.set(p.clientId, p);
      continue;
    }
    const a = p.createdAt?.toMillis?.() ?? 0;
    const b = existing.createdAt?.toMillis?.() ?? 0;
    if (a > b) latestProjectByClient.set(p.clientId, p);
  }

  return clients.map((c) => {
    const fullName = `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "—";
    const latest = latestProjectByClient.get(c.id);
    return {
      id: c.id,
      fullName,
      email: c.email,
      firstTouchSource: c.firstTouchSource ?? "DIRECT",
      totalSessionsBooked: c.totalSessionsBooked ?? 0,
      lifetimeValueCents: ltvByClient.get(c.id) ?? 0,
      lastProjectStatus: latest?.status ?? null,
      createdAt: formatDisplayDate(c.createdAt) ?? "—",
    };
  });
}

export default async function ClientsPage(props: {
  searchParams: Promise<{ q?: string; cursor?: string; sort?: string }>;
}) {
  await requireAdmin();
  const { q, cursor, sort: sortRaw } = await props.searchParams;
  const search = q?.trim() ?? "";
  const sort: ClientSort =
    sortRaw === "ltv" || sortRaw === "sessions" ? sortRaw : "recent";

  let rows: ClientRow[] = [];
  let nextCursor: string | null = null;
  let error: string | null = null;

  try {
    let clients: ClientDoc[];
    if (search) {
      clients = await searchClients(search);
      nextCursor = null;
    } else {
      const page = await listClientsPaginated({
        pageSize: PAGE_SIZE,
        cursor: cursor ?? null,
        sort,
      });
      clients = page.clients;
      nextCursor = page.nextCursor;
    }
    rows = await decorateRows(clients);

    // In-memory sort for ltv / sessions modes (and for searches).
    if (sort === "ltv") {
      rows.sort((a, b) => b.lifetimeValueCents - a.lifetimeValueCents);
    } else if (sort === "sessions") {
      rows.sort((a, b) => b.totalSessionsBooked - a.totalSessionsBooked);
    }
  } catch (err: unknown) {
    console.error("ClientsPage load error:", err);
    error = err instanceof Error ? err.message : "Failed to load clients.";
  }

  if (error) {
    return (
      <div className="page-fade-in">
        <h2
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "2rem",
            fontWeight: 300,
            marginBottom: "1rem",
          }}
        >
          Clients
        </h2>
        <div
          style={{
            padding: "2rem",
            border: "0.5px solid #FCA5A5",
            background: "#FEF2F2",
            color: "#991B1B",
            fontSize: "0.88rem",
            lineHeight: 1.7,
          }}
        >
          <strong>Error loading clients</strong>
          <br />
          {error}
        </div>
      </div>
    );
  }

  const isPaginating = Boolean(cursor);

  return (
    <div className="page-fade-in">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "2rem",
        }}
      >
        <div>
          <p
            style={{
              fontSize: "0.65rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--olive)",
              marginBottom: "0.3rem",
            }}
          >
            Directory
          </p>
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "2rem",
              fontWeight: 300,
            }}
          >
            Clients
          </h2>
        </div>
        <div
          style={{
            fontSize: "0.78rem",
            color: "var(--charcoal-muted)",
            textAlign: "right",
          }}
        >
          Showing {rows.length} client{rows.length !== 1 ? "s" : ""}
          {search ? ` matching "${search}"` : ""}
        </div>
      </div>

      <SearchBar initialValue={search} initialSort={sort} />

      {/* Sort toggle — preserves the current `q` */}
      <div
        style={{
          display: "flex",
          gap: "0.4rem",
          marginBottom: "1rem",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: "0.6rem",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--charcoal-muted)",
            marginRight: "0.4rem",
          }}
        >
          Sort
        </span>
        {(["recent", "ltv", "sessions"] as const).map((s) => {
          const active = s === sort;
          const labelMap: Record<ClientSort, string> = {
            recent: "Recent",
            ltv: "By LTV",
            sessions: "By sessions",
          };
          return (
            <Link
              key={s}
              href={buildHref({ q: search, sort: s })}
              style={{
                padding: "0.35rem 0.75rem",
                fontSize: "0.7rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: active ? "var(--white)" : "var(--charcoal-light)",
                background: active ? "var(--olive)" : "transparent",
                border: `0.5px solid ${active ? "var(--olive)" : "var(--border-strong)"}`,
                textDecoration: "none",
              }}
            >
              {labelMap[s]}
            </Link>
          );
        })}
      </div>

      <div style={{ border: "0.5px solid var(--border)", background: "var(--white)" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}
        >
          <thead>
            <tr>
              {[
                "Name",
                "Email",
                "First touch",
                "Sessions",
                "Lifetime value",
                "Last project",
                "Created",
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: "0.75rem 1rem",
                    fontSize: "0.65rem",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--charcoal-muted)",
                    borderBottom: "0.5px solid var(--border-strong)",
                    fontWeight: 400,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    padding: "3rem",
                    textAlign: "center",
                    color: "var(--charcoal-muted)",
                    fontSize: "0.88rem",
                  }}
                >
                  {search ? `No clients match "${search}".` : "No clients yet."}
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr
                key={row.id}
                style={{ cursor: "pointer" }}
              >
                <td style={tdStyle}>
                  <Link
                    href={`/admin/clients/${row.id}`}
                    style={{
                      color: "var(--charcoal)",
                      textDecoration: "none",
                      fontWeight: 500,
                    }}
                  >
                    {row.fullName}
                  </Link>
                </td>
                <td style={tdStyle}>
                  <Link
                    href={`/admin/clients/${row.id}`}
                    style={{
                      color: "var(--charcoal-light)",
                      textDecoration: "none",
                    }}
                  >
                    {row.email}
                  </Link>
                </td>
                <td style={tdStyle}>{SOURCE_LABELS[row.firstTouchSource] ?? row.firstTouchSource}</td>
                <td style={tdStyle}>{row.totalSessionsBooked}</td>
                <td style={tdStyle}>
                  {row.lifetimeValueCents > 0 ? fmtUsd(row.lifetimeValueCents) : "—"}
                </td>
                <td style={tdStyle}>{statusLabel(row.lastProjectStatus)}</td>
                <td style={tdStyle}>{row.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Forward-only cursor pagination, only meaningful for the `recent` sort. */}
      {sort === "recent" && !search && (
        <nav
          aria-label="Pagination"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "1.25rem",
            fontSize: "0.78rem",
            color: "var(--charcoal-muted)",
          }}
        >
          <div>
            {isPaginating ? (
              <Link
                href={buildHref({ q: search, sort })}
                style={{
                  padding: "0.5rem 1rem",
                  fontSize: "0.65rem",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--charcoal)",
                  border: "0.5px solid var(--border-strong)",
                  background: "transparent",
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                ← Back to start
              </Link>
            ) : (
              <span style={{ opacity: 0.5 }}>Page 1</span>
            )}
          </div>
          <div>
            {nextCursor ? (
              <Link
                href={buildHref({ cursor: nextCursor, q: search, sort })}
                style={{
                  padding: "0.5rem 1rem",
                  fontSize: "0.65rem",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--white)",
                  background: "var(--olive)",
                  border: "0.5px solid var(--olive)",
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                Next →
              </Link>
            ) : (
              <span style={{ opacity: 0.5 }}>End of list</span>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}

const tdStyle: React.CSSProperties = {
  padding: "0.9rem 1rem",
  borderBottom: "0.5px solid var(--border)",
  color: "var(--charcoal-light)",
  verticalAlign: "middle",
};
