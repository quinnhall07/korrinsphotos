// app/portal/router/page.tsx
// Resolves the signed-in user's email → their most-recent project →
// redirects to /portal/{projectId}. If the user has 0 projects, redirect
// to "/". If multiple, render a chooser list.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getClientByEmail } from "@/lib/db/clients";
import { getProjectsByClientId } from "@/lib/db/projects";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your portal | Korrin's Photography" };

function ts(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in (value as Record<string, unknown>) &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

export default async function PortalRouterPage() {
  const session = await requireSession();
  const email = (session.email ?? "").toLowerCase();
  if (!email) {
    redirect("/login?next=/portal/router");
  }

  const client = await getClientByEmail(email);
  if (!client) {
    redirect("/");
  }

  const projects = await getProjectsByClientId(client.id);
  const active = projects.filter((p) => p.status !== "ARCHIVED" && p.status !== "LOST");

  if (active.length === 0 && projects.length === 0) {
    redirect("/");
  }

  const list = active.length > 0 ? active : projects;

  if (list.length === 1) {
    redirect(`/portal/${list[0].id}`);
  }

  // Render chooser
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--white)",
        paddingTop: "120px",
        paddingBottom: "5rem",
      }}
    >
      <div
        style={{
          maxWidth: "720px",
          margin: "0 auto",
          padding: "0 1.5rem",
        }}
      >
        <p
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--olive)",
            margin: 0,
          }}
        >
          Your Portal
        </p>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontWeight: 300,
            fontSize: "2.4rem",
            letterSpacing: "0.01em",
            color: "var(--charcoal)",
            margin: "0.5rem 0 2rem 0",
            lineHeight: 1.1,
          }}
        >
          Choose a project
        </h1>

        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "1rem" }}>
          {list.map((p) => (
            <li key={p.id}>
              <Link
                href={`/portal/${p.id}`}
                style={{
                  display: "block",
                  padding: "1.25rem 1.5rem",
                  background: "var(--white)",
                  border: "0.5px solid var(--border)",
                  textDecoration: "none",
                  transition: "border-color 0.2s",
                }}
              >
                <p
                  style={{
                    fontSize: "0.62rem",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--olive)",
                    margin: 0,
                  }}
                >
                  {p.sessionType}
                </p>
                <p
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontWeight: 300,
                    fontSize: "1.3rem",
                    color: "var(--charcoal)",
                    margin: "0.3rem 0",
                  }}
                >
                  {p.title}
                </p>
                <p
                  style={{
                    fontFamily: "'Jost', sans-serif",
                    fontSize: "0.78rem",
                    color: "var(--charcoal-muted)",
                    margin: 0,
                    letterSpacing: "0.02em",
                  }}
                >
                  {ts(p.shootDate)
                    ? new Date(ts(p.shootDate) as string).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "Date TBD"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
