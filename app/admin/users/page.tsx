// app/admin/users/page.tsx
// User management — lists all users from Firestore with roles and event access counts.

import { requireAdmin } from "@/lib/session";
import { adminDb } from "@/lib/firebase-admin";
import { RemoveUserButton } from "./RemoveUserButton";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Users | Admin" };
export const dynamic = "force-dynamic";

type UserRow = {
  uid: string;
  email: string;
  role: string;
  eventCount: number;
  createdAt: string;
};

async function getUsers(): Promise<UserRow[]> {
  const snap = await adminDb
    .collection("users")
    .orderBy("createdAt", "asc")
    .get();

  return Promise.all(
    snap.docs.map(async (doc) => {
      const data = doc.data();
      const accessSnap = await adminDb
        .collection("eventAccess")
        .where("userId", "==", doc.id)
        .count()
        .get();

      return {
        uid: doc.id,
        email: data.email as string,
        role: data.role as string,
        eventCount: accessSnap.data().count,
        createdAt: data.createdAt?.toDate
          ? data.createdAt.toDate().toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "—",
      };
    })
  );
}

const ROLE_STYLES: Record<string, React.CSSProperties> = {
  ADMIN: { background: "#D1FAE5", color: "#065F46" },
  CLIENT: { background: "#E0E7FF", color: "#3730A3" },
};

export default async function UsersPage() {
  const session = await requireAdmin();

  let users: UserRow[] = [];
  let error: string | null = null;

  try {
    users = await getUsers();
  } catch (err: unknown) {
    console.error("getUsers error:", err);
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
          <span>{users.length} total user{users.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

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
                  No users yet.
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
    </div>
  );
}

const tdStyle: React.CSSProperties = {
  padding: "0.9rem 1rem",
  borderBottom: "0.5px solid var(--border)",
  color: "var(--charcoal-light)",
  verticalAlign: "middle",
};