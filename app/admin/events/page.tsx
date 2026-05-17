// app/admin/events/page.tsx
// Lists events with cursor-based pagination + status pill filters. Server
// component fetches a single page from Firestore, decorates each row with its
// photo + access counts, and delegates table rendering (plus client-side
// title search) to EventsTable.

import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { adminDb } from "@/lib/firebase-admin";
import {
  listEventsPaginated,
  type EventDoc,
  type EventStatus,
} from "@/lib/db/events";
import { createEvent } from "./actions";
import { EventsTable, type SerializedEventRow } from "./EventsTable";
import { StatusFilterPills } from "./StatusFilterPills";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Events | Admin" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

const VALID_EVENT_STATUSES: ReadonlySet<EventStatus> = new Set([
  "UPCOMING",
  "ACTIVE",
  "COMPLETED",
  "DELIVERED",
  "ARCHIVED",
]);

function coerceEventStatus(raw: unknown): EventStatus {
  return typeof raw === "string" && VALID_EVENT_STATUSES.has(raw as EventStatus)
    ? (raw as EventStatus)
    : "UPCOMING";
}

/**
 * Parse a comma-separated `?status=` param into a deduped list of valid
 * `EventStatus` values. Unknown tokens are dropped silently so a stale URL
 * never errors the page.
 */
function parseStatusFilter(raw: string | undefined): EventStatus[] {
  if (!raw) return [];
  const seen = new Set<EventStatus>();
  for (const part of raw.split(",")) {
    const token = part.trim().toUpperCase();
    if (VALID_EVENT_STATUSES.has(token as EventStatus)) {
      seen.add(token as EventStatus);
    }
  }
  return [...seen];
}

async function decorateRow(event: EventDoc): Promise<SerializedEventRow> {
  const [photosSnap, accessSnap] = await Promise.all([
    adminDb.collection("events").doc(event.id).collection("photos").count().get(),
    adminDb.collection("eventAccess").where("eventId", "==", event.id).count().get(),
  ]);

  const createdAtDate: Date = event.createdAt?.toDate?.() ?? new Date();

  return {
    id: event.id,
    title: event.title,
    status: coerceEventStatus(event.status),
    createdAt: createdAtDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    shootDate: event.startDate ?? null,
    photoCount: photosSnap.data().count,
    clientCount: accessSnap.data().count,
  };
}

function buildHref(params: {
  cursor?: string | null;
  status?: EventStatus[];
}): string {
  const sp = new URLSearchParams();
  if (params.cursor) sp.set("cursor", params.cursor);
  if (params.status && params.status.length > 0) {
    sp.set("status", params.status.join(","));
  }
  const qs = sp.toString();
  return qs ? `/admin/events?${qs}` : "/admin/events";
}

export default async function EventsPage(props: {
  searchParams: Promise<{ cursor?: string; status?: string }>;
}) {
  await requireAdmin();
  const { cursor, status } = await props.searchParams;
  const statusFilter = parseStatusFilter(status);

  let rows: SerializedEventRow[] = [];
  let nextCursor: string | null = null;
  let error: string | null = null;

  try {
    const page = await listEventsPaginated({
      pageSize: PAGE_SIZE,
      cursor: cursor ?? null,
      statusFilter: statusFilter.length > 0 ? statusFilter : undefined,
    });
    nextCursor = page.nextCursor;
    rows = await Promise.all(page.events.map(decorateRow));
  } catch (err) {
    console.error("listEventsPaginated error:", err);
    error = err instanceof Error ? err.message : "Failed to load events.";
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
            Content
          </p>
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "2rem",
              fontWeight: 300,
            }}
          >
            All Events
          </h2>
        </div>

        <form action={createEvent}>
          <input type="hidden" name="title" value="New Event" />
          <button type="submit" style={btnOlive}>
            + Create Event
          </button>
        </form>
      </div>

      <StatusFilterPills active={statusFilter} />

      {error ? (
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
          <strong>Error loading events</strong>
          <br />
          {error}
        </div>
      ) : (
        <>
          <p
            style={{
              fontSize: "0.72rem",
              color: "var(--charcoal-muted)",
              marginBottom: "0.75rem",
              letterSpacing: "0.04em",
            }}
          >
            Showing {rows.length} event{rows.length !== 1 ? "s" : ""}
            {statusFilter.length > 0
              ? ` filtered by ${statusFilter
                  .map((s) => s.toLowerCase())
                  .join(", ")}`
              : ""}
          </p>

          <EventsTable events={rows} />

          {/*
            Forward-only pagination. Tradeoff: keeping a serialised cursor stack
            in the URL doubles every navigation's complexity; "Back to start" +
            Next is a clean v1 (mirrors /admin/users).
          */}
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
                  href={buildHref({ status: statusFilter })}
                  style={navBtnGhost}
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
                  href={buildHref({
                    cursor: nextCursor,
                    status: statusFilter,
                  })}
                  style={navBtnOlive}
                >
                  Next →
                </Link>
              ) : (
                <span style={{ opacity: 0.5 }}>End of list</span>
              )}
            </div>
          </nav>
        </>
      )}
    </div>
  );
}

const btnOlive: React.CSSProperties = {
  padding: "0.85rem 2.2rem",
  fontSize: "0.72rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  background: "var(--olive)",
  color: "var(--white)",
  border: "none",
  cursor: "pointer",
  fontFamily: "'Jost', sans-serif",
};

const navBtnGhost: React.CSSProperties = {
  padding: "0.5rem 1rem",
  fontSize: "0.65rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--charcoal)",
  border: "0.5px solid var(--border-strong)",
  background: "transparent",
  textDecoration: "none",
  display: "inline-block",
  fontFamily: "'Jost', sans-serif",
};

const navBtnOlive: React.CSSProperties = {
  padding: "0.5rem 1rem",
  fontSize: "0.65rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--white)",
  background: "var(--olive)",
  border: "0.5px solid var(--olive)",
  textDecoration: "none",
  display: "inline-block",
  fontFamily: "'Jost', sans-serif",
};
