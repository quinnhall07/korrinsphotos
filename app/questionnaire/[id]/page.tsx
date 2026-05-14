// app/questionnaire/[id]/page.tsx
// Public-facing questionnaire form (Phase 2.9).
//
// No auth required — the URL *is* the credential, same shape as the magic
// link grants. Looks up the questionnaire by Firestore doc id and either
// renders the form or a thank-you state.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { getProject } from "@/lib/db/projects";
import { getClient } from "@/lib/db/clients";
import {
  getQuestionnaire,
  getTemplate,
  type QuestionnaireQuestion,
} from "@/lib/db/questionnaires";
import { QuestionnaireForm } from "./QuestionnaireForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your questionnaire",
  description: "Tell us about your session.",
  robots: { index: false, follow: false },
};

// Serializable subset handed to the client form. Mirrors the QuestionnaireQuestion
// shape but is intentionally re-declared at the route level for clarity.
export interface SerialQuestion {
  id: string;
  type: QuestionnaireQuestion["type"];
  label: string;
  options: string[] | null;
  required: boolean;
  helpText: string | null;
}

function toSerial(q: QuestionnaireQuestion): SerialQuestion {
  return {
    id: q.id,
    type: q.type,
    label: q.label,
    options: q.options && q.options.length ? q.options : null,
    required: !!q.required,
    helpText: q.helpText ?? null,
  };
}

export default async function QuestionnairePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: questionnaireId } = await params;

  const questionnaire = await getQuestionnaire(questionnaireId);
  if (!questionnaire) notFound();

  // Fetch template + related project/client in parallel. Any missing join
  // target = 404 (the link is malformed).
  const [template, project, client] = await Promise.all([
    getTemplate(questionnaire.templateId),
    getProject(questionnaire.projectId),
    getClient(questionnaire.clientId).catch(() => null),
  ]);

  if (!template || !project) notFound();

  const firstName = client?.firstName?.trim() || null;
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";

  // ─── Already submitted state ────────────────────────────────────────────
  if (questionnaire.status === "COMPLETED") {
    return (
      <div style={{ paddingTop: "72px" }} className="page-fade-in">
        <section style={SECTION_WRAP}>
          <Eyebrow>Your Questionnaire</Eyebrow>
          <h1 style={HEADING}>
            Thanks — we&apos;ve got it.<br />
            <em>Already submitted.</em>
          </h1>
          <p style={BODY}>
            {greeting} we&apos;ve received your responses for{" "}
            <em style={{ color: "var(--charcoal)" }}>{project.title}</em>. If
            you need to change an answer, reply to Korrin&apos;s last email and
            she&apos;ll update it.
          </p>
          <div style={{ marginTop: "2.5rem" }}>
            <Link href="/" style={BTN_GHOST}>
              Return Home
            </Link>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  // ─── Form state ─────────────────────────────────────────────────────────
  const questions = (template.questions ?? []).map(toSerial);

  return (
    <div style={{ paddingTop: "72px" }} className="page-fade-in">
      <section style={SECTION_WRAP}>
        <Eyebrow>Your Questionnaire</Eyebrow>
        <h1 style={HEADING}>
          A few questions about<br />
          <em>{project.title}.</em>
        </h1>
        <p style={BODY}>
          {greeting} please take a few minutes to walk us through your vision.
          Every answer helps Korrin show up ready to capture the day the way
          you imagine it.
        </p>

        <QuestionnaireForm
          questionnaireId={questionnaire.id}
          questions={questions}
        />
      </section>

      <Footer />
    </div>
  );
}

// ─── Small server-side presentational helpers ────────────────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: "1.5rem",
        marginBottom: "2.5rem",
      }}
    >
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
        {children}
      </span>
      <div style={{ flex: 1, height: "0.5px", background: "var(--border)" }} />
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const SECTION_WRAP: React.CSSProperties = {
  padding: "7rem 2rem 5rem",
  maxWidth: "760px",
  margin: "0 auto",
};

const HEADING: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: "clamp(2.4rem, 5vw, 3.8rem)",
  fontWeight: 300,
  lineHeight: 1.15,
  letterSpacing: "-0.01em",
  marginBottom: "1.25rem",
};

const BODY: React.CSSProperties = {
  fontSize: "1rem",
  lineHeight: 1.85,
  color: "var(--charcoal-light)",
  fontWeight: 300,
  marginBottom: "2.5rem",
};

const BTN_GHOST: React.CSSProperties = {
  display: "inline-block",
  padding: "0.95rem 2.4rem",
  fontSize: "0.72rem",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  background: "transparent",
  color: "var(--charcoal)",
  border: "0.5px solid var(--border-strong)",
  textDecoration: "none",
};
