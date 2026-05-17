// app/admin/questionnaires/templates/page.tsx
// Lists every questionnaire template. Server Component fetches the docs,
// serialises Timestamps, and hands off to the client list view.

import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { listTemplates } from "@/lib/db/questionnaires";

export const metadata: Metadata = { title: "Questionnaire Templates | Admin" };
export const dynamic = "force-dynamic";

export default async function QuestionnaireTemplatesPage() {
  await requireAdmin();

  let templates: Array<{
    id: string;
    name: string;
    sessionType: string;
    questionCount: number;
    updatedAt: string | null;
  }> = [];
  let error: string | null = null;

  try {
    const docs = await listTemplates();
    templates = docs.map((d) => ({
      id: d.id,
      name: d.name,
      sessionType: d.sessionType as string,
      questionCount: Array.isArray(d.questions) ? d.questions.length : 0,
      updatedAt: d.updatedAt?.toDate().toISOString() ?? null,
    }));
  } catch (err) {
    console.error("Failed to list templates:", err);
    error = err instanceof Error ? err.message : "Failed to load templates.";
  }

  if (error) {
    return (
      <div className="page-fade-in">
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
          <strong>Error loading templates</strong>
          <br />
          {error}
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
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p style={eyebrow}>Questionnaire Engine</p>
          <h2 style={pageTitle}>Templates</h2>
          <p
            style={{
              fontSize: "0.78rem",
              color: "var(--charcoal-muted)",
              marginTop: "0.4rem",
              letterSpacing: "0.04em",
            }}
          >
            {templates.length} template{templates.length === 1 ? "" : "s"}
          </p>
        </div>

        <Link href="/admin/questionnaires/templates/new" style={btnOlive}>
          + New template
        </Link>
      </div>

      {templates.length === 0 ? (
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
            No templates yet. Build one — questionnaires auto-send when a
            project hits BOOKED and the session type matches.
          </p>
        </div>
      ) : (
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
                "minmax(0, 1.6fr) minmax(0, 1fr) 6rem 8rem",
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
            <span>Questions</span>
            <span style={{ textAlign: "right" }}>Updated</span>
          </div>

          {templates.map((t, i) => (
            <Link
              key={t.id}
              href={`/admin/questionnaires/templates/${t.id}`}
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(0, 1.6fr) minmax(0, 1fr) 6rem 8rem",
                gap: "1rem",
                padding: "1.1rem 1.25rem",
                borderBottom:
                  i === templates.length - 1
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
                }}
              >
                {t.name}
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
                {t.questionCount}
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
        </div>
      )}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const eyebrow: React.CSSProperties = {
  fontSize: "0.65rem",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "var(--olive)",
  marginBottom: "0.3rem",
};

const pageTitle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: "2rem",
  fontWeight: 300,
};

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
  textDecoration: "none",
  display: "inline-block",
};
