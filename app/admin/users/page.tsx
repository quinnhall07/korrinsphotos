// app/admin/users/page.tsx
// User management — paginated list (50/page) of users from Firestore with
// roles, gallery-access counts, and an in-page search filter.

import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { adminDb } from "@/lib/firebase-admin";
import { listUsersPaginated, type UserDoc } from "@/lib/db/users";
import { RemoveUserButton } from "./RemoveUserButton";
import { SearchBar } from "./SearchBar";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Users | Admin" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type UserRow = {
  uid: string;
  email: string;
  role: string;
  eventCount: number;
  createdAt: string;
};

const ROLE_STYLES: Record<string, React.CSSProperties> = {
  ADMIN: { background: "#D1FAE5", color: "#065F46" },
  CLIENT: { background: "#E0E7FF", color: "#3730A3" },
};

async function decorateRow(user: UserDoc): Promise<UserRow> {
  const accessSnap = await adminDb
    .collection("eventAccess")
    .where("userId", "==", user.uid)
    .count()
    .get();

  const createdAtDate: Date | null = user.createdAt?.toDate?.() ?? null;

  return {
    uid: user.uid,
    email: user.email,
    role: user.role,
    eventCount: accessSnap.data().count,
    createdAt: createdAtDate
      ? createdAtDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
      : "—",
  };
}

function buildHref(params: { cursor?: string | null; q?: string }): string {
  const sp = new URLSearchParams();
  if (params.cursor) sp.set("cursor", params.cursor);
  if (params.q) sp.set("q", params.q);
  const qs = sp.toString();
  return qs ? `/admin/users?${qs}` : "/admin/users";
}

export default async function UsersPage(props: {
  searchParams: Promise<{ cursor?: string; q?: string }>;
}) {
  const session = await requireAdmin();
  const { cursor, q } = await props.searchParams;
  const search = q?.trim() ?? "";

  let users: UserRow[] = [];
  let nextCursor: string | null = null;
  let error: string | null = null;

  try {
    const page = await listUsersPaginated({
      pageSize: PAGE_SIZE,
      cursor: cursor ?? null,
      search: search || undefined,
    });
    nextCursor = page.nextCursor;
    users = await Promise.all(page.users.map(decorateRow));
  } catch (err: unknown) {
    console.error("listUsersPaginated error:", err);
    error = err instanceof Error ? err.message : "Failed to load users from Firestore.";
  }

  if (error) {
    return (
      <div className="page-fade-in">
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "2rem", fontWeight: 300, marginBottom: "1rem" }}>
          User Management
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
          <strong>Error loading users</strong>
          <br />
          {error}
          <br />
          <br />
          <span style={{ fontSize: "0.78rem", color: "#B91C1C" }}>
            Check that your Firestore indexes are configured and that FIREBASE_* environment variables are set correctly.
          </span>
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
            Clients
          </p>
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "2rem",
              fontWeight: 300,
            }}
          >
            User Management
          </h2>
        </div>
        <div
          style={{
            fontSize: "0.78rem",
            color: "var(--charcoal-muted)",
            textAlign: "right",
          }}
        >
          <span>
            Showing {users.length} user{users.length !== 1 ? "s" : ""}
            {search ? ` matching "${search}"` : ""}
          </span>
        </div>
      </div>

      <SearchBar initialValue={search} />

      <div style={{ border: "0.5px solid var(--border)", background: "var(--white)" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}
        >
          <thead>
            <tr>
              {["Email", "Role", "Gallery Access", "Joined", ""].map((h) => (
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
            {users.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    padding: "3rem",
                    textAlign: "center",
                    color: "var(--charcoal-muted)",
                    fontSize: "0.88rem",
                  }}
                >
                  {search ? `No users match "${search}".` : "No users yet."}
                </td>
              </tr>
            )}
            {users.map((user) => (
              <tr key={user.uid}>
                <td style={tdStyle}>{user.email}</td>
                <td style={tdStyle}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "0.25rem 0.65rem",
                      fontSize: "0.62rem",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      ...(ROLE_STYLES[user.role] ?? {}),
                    }}
                  >
                    {user.role}
                  </span>
                </td>
                <td style={tdStyle}>
                  {user.role === "ADMIN"
                    ? "All events"
                    : `${user.eventCount} event${user.eventCount !== 1 ? "s" : ""}`}
                </td>
                <td style={tdStyle}>{user.createdAt}</td>
                <td style={tdStyle}>
                  {/* Don't allow removing yourself */}
                  {user.uid !== session.uid && user.role !== "ADMIN" ? (
                    <RemoveUserButton uid={user.uid} email={user.email} />
                  ) : (
                    <span style={{ fontSize: "0.78rem", color: "var(--charcoal-muted)" }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/*
        Forward-only pagination. Tradeoff: keeping a serialised cursor stack in
        the URL doubles every navigation's complexity and breaks under deep
        history; "Back to start" + Next is a clean v1.
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
              href={buildHref({ q: search })}
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
              href={buildHref({ cursor: nextCursor, q: search })}
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
    </div>
  );
}

const tdStyle: React.CSSProperties = {
  padding: "0.9rem 1rem",
  borderBottom: "0.5px solid var(--border)",
  color: "var(--charcoal-light)",
  verticalAlign: "middle",
};
