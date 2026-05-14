// app/questionnaire/[id]/page.tsx
// Public placeholder for the per-project client questionnaire.
// The questionnaire engine ships in Phase 2.9 — for now we acknowledge the
// project and surface a fallback contact path so emailed links never 404.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { getProject } from "@/lib/db/projects";
import { getClient } from "@/lib/db/clients";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your questionnaire",
  description: "Tell us about your session.",
  robots: { index: false, follow: false },
};

// Generic studio inbox — no contact address is documented in the repo, so we
// use the brand-aligned default. Swap in a real address when one exists.
const CONTACT_EMAIL = "hello@korrinsphotos.com";

export default async function QuestionnairePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = await params;
  const project = await getProject(projectId);

  if (!project) {
    notFound();
  }

  let firstName: string | null = null;
  try {
    const client = await getClient(project.clientId);
    firstName = client?.firstName?.trim() || null;
  } catch {
    firstName = null;
  }

  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  const subject = encodeURIComponent(`Questionnaire — ${project.title}`);
  const mailtoHref = `mailto:${CONTACT_EMAIL}?subject=${subject}`;

  return (
    <div style={{ paddingTop: "72px" }} className="page-fade-in">
      <section
        style={{
          padding: "7rem 2rem 5rem",
          maxWidth: "760px",
          margin: "0 auto",
        }}
      >
        {/* Eyebrow */}
        <div style={{ display: "flex", alignItems: "baseline", gap: "1.5rem", marginBottom: "2.5rem" }}>
          <span
            style={{
              fontSize: "0.65rem",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "var(--olive)",
              fontWeight: 400,
              whiteSpace: "nowrap",
            }}
          >
            Your Questionnaire
          </span>
          <div style={{ flex: 1, height: "0.5px", background: "var(--border)" }} />
        </div>

        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "clamp(2.4rem, 5vw, 3.8rem)",
            fontWeight: 300,
            lineHeight: 1.15,
            letterSpacing: "-0.01em",
            marginBottom: "1.25rem",
          }}
        >
          A few questions,<br />
          <em>coming soon.</em>
        </h1>

        <p
          style={{
            fontSize: "1rem",
            lineHeight: 1.85,
            color: "var(--charcoal-light)",
            fontWeight: 300,
            marginBottom: "1.25rem",
          }}
        >
          {greeting} we&apos;re refining our questionnaire experience and aren&apos;t quite ready to share it here.
          Korrin will email you the form for{" "}
          <em style={{ color: "var(--charcoal)" }}>{project.title}</em> shortly.
        </p>

        <p
          style={{
            fontSize: "0.95rem",
            lineHeight: 1.85,
            color: "var(--charcoal-light)",
            fontWeight: 300,
            marginBottom: "2.5rem",
          }}
        >
          If you&apos;d like to start the conversation now, send anything you&apos;d like to share to{" "}
          <a
            href={mailtoHref}
            style={{
              color: "var(--olive)",
              textDecoration: "none",
              borderBottom: "0.5px solid var(--olive)",
            }}
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>

        {/* Session card */}
        <div
          style={{
            borderTop: "0.5px solid var(--border)",
            borderBottom: "0.5px solid var(--border)",
            padding: "1.5rem 0",
            marginBottom: "3rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: "2rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <p
              style={{
                fontSize: "0.65rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--charcoal-muted)",
                marginBottom: "0.4rem",
              }}
            >
              Session
            </p>
            <p
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "1.5rem",
                fontWeight: 300,
                lineHeight: 1.2,
              }}
            >
              {project.title}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p
              style={{
                fontSize: "0.65rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--charcoal-muted)",
                marginBottom: "0.4rem",
              }}
            >
              Type
            </p>
            <p style={{ fontSize: "1rem", color: "var(--charcoal)" }}>
              {project.sessionType}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <a
            href={mailtoHref}
            style={{
              display: "inline-block",
              padding: "0.95rem 2.4rem",
              fontSize: "0.72rem",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              background: "var(--olive)",
              color: "var(--white)",
              textDecoration: "none",
            }}
          >
            Email Korrin
          </a>
          <Link
            href="/"
            style={{
              display: "inline-block",
              padding: "0.95rem 2.4rem",
              fontSize: "0.72rem",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              background: "transparent",
              color: "var(--charcoal)",
              border: "0.5px solid var(--border-strong)",
              textDecoration: "none",
            }}
          >
            Return Home
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
