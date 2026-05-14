"use client";

// app/style/StyleQuizClient.tsx
// Card-based A/B style quiz. Eight questions, one per step, with a
// progress bar at the top. On the final step we collect email + first
// name and POST through the `submitStyleQuiz` Server Action.
//
// Success state renders a static 3x3 example mood-board as a stub for
// the AI-generated mood-board feature (Phase 5.8).

import { useState, type FormEvent } from "react";
import { STYLE_QUESTIONS, type StyleOption } from "./questions";
import { submitStyleQuiz } from "./actions";

type QuizStep = "question" | "contact" | "submitting" | "success" | "error";

export function StyleQuizClient() {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [step, setStep] = useState<QuizStep>("question");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tagSummary, setTagSummary] = useState<string[]>([]);

  const totalSteps = STYLE_QUESTIONS.length + 1; // +1 for contact step
  const currentStep =
    step === "contact"
      ? STYLE_QUESTIONS.length
      : Math.min(questionIndex, STYLE_QUESTIONS.length - 1);
  const progressPct = Math.round(((currentStep + 1) / totalSteps) * 100);

  function selectOption(questionId: string, option: StyleOption) {
    const nextAnswers = { ...answers, [questionId]: option.id };
    setAnswers(nextAnswers);

    if (questionIndex < STYLE_QUESTIONS.length - 1) {
      setQuestionIndex(questionIndex + 1);
    } else {
      setStep("contact");
    }
  }

  function goBack() {
    setError(null);
    if (step === "contact") {
      setStep("question");
      return;
    }
    if (questionIndex > 0) {
      setQuestionIndex(questionIndex - 1);
    }
  }

  async function handleContactSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!firstName.trim() || !email.trim()) {
      setError("First name and email are required.");
      return;
    }
    setStep("submitting");
    try {
      const result = await submitStyleQuiz({
        email: email.trim(),
        firstName: firstName.trim(),
        answers,
      });
      if (!result.success) {
        setError(result.error);
        setStep("contact");
        return;
      }
      setTagSummary(result.tagSummary);
      setStep("success");
    } catch (err) {
      console.error(err);
      setError("Unexpected error. Please try again.");
      setStep("contact");
    }
  }

  // ── Success — example mood board ──────────────────────────────────────────
  if (step === "success") {
    return <SuccessMoodBoard firstName={firstName} tagSummary={tagSummary} />;
  }

  return (
    <div>
      {/* Progress bar */}
      <div style={{ marginBottom: "2.5rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.6rem",
          }}
        >
          <span
            style={{
              fontSize: "0.65rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--charcoal-muted)",
            }}
          >
            Step {currentStep + 1} of {totalSteps}
          </span>
          <span
            style={{
              fontSize: "0.65rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--olive)",
            }}
          >
            {progressPct}%
          </span>
        </div>
        <div
          style={{
            position: "relative",
            height: "2px",
            background: "var(--border)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              height: "100%",
              width: `${progressPct}%`,
              background: "var(--olive)",
              transition: "width 0.4s cubic-bezier(0.25,0.46,0.45,0.94)",
            }}
          />
        </div>
      </div>

      {/* Step body */}
      {step === "question" && (
        <QuestionCard
          question={STYLE_QUESTIONS[questionIndex]}
          selectedId={answers[STYLE_QUESTIONS[questionIndex].id] ?? null}
          onSelect={(option) =>
            selectOption(STYLE_QUESTIONS[questionIndex].id, option)
          }
        />
      )}

      {(step === "contact" || step === "submitting") && (
        <ContactStep
          firstName={firstName}
          email={email}
          setFirstName={setFirstName}
          setEmail={setEmail}
          submitting={step === "submitting"}
          error={error}
          onSubmit={handleContactSubmit}
        />
      )}

      {/* Back button */}
      <div style={{ marginTop: "2rem", textAlign: "center" }}>
        {(questionIndex > 0 || step === "contact") &&
          step !== "submitting" && (
            <button
              type="button"
              onClick={goBack}
              style={{
                background: "none",
                border: "none",
                fontSize: "0.72rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--charcoal-muted)",
                cursor: "pointer",
                padding: "0.5rem 1rem",
                fontFamily: "'Jost', sans-serif",
              }}
            >
              ← Back
            </button>
          )}
      </div>
    </div>
  );
}

// ─── Question card ─────────────────────────────────────────────────────────────

function QuestionCard({
  question,
  selectedId,
  onSelect,
}: {
  question: (typeof STYLE_QUESTIONS)[number];
  selectedId: string | null;
  onSelect: (option: StyleOption) => void;
}) {
  return (
    <div>
      <h2
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "1.8rem",
          fontWeight: 300,
          lineHeight: 1.3,
          color: "var(--charcoal)",
          textAlign: "center",
          marginBottom: "2.5rem",
        }}
      >
        {question.prompt}
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "1.5rem",
        }}
      >
        {question.options.map((option) => {
          const isSelected = selectedId === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(option)}
              style={{
                position: "relative",
                background: "transparent",
                border: isSelected
                  ? "0.5px solid var(--olive)"
                  : "0.5px solid var(--border-strong)",
                padding: 0,
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "'Jost', sans-serif",
                transition: "border-color 0.3s, transform 0.3s",
                outline: "none",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--olive)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = isSelected
                  ? "var(--olive)"
                  : "var(--border-strong)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              {/* Swatch visual */}
              <div
                style={{
                  aspectRatio: "4 / 5",
                  background: option.swatch,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <span
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontStyle: "italic",
                    fontWeight: 300,
                    fontSize: "2.2rem",
                    color: "rgba(250,249,246,0.85)",
                    textShadow: "0 2px 12px rgba(0,0,0,0.25)",
                    letterSpacing: "0.02em",
                  }}
                >
                  {option.swatchTitle}
                </span>
              </div>

              {/* Label + description */}
              <div style={{ padding: "1.25rem 1.5rem" }}>
                <p
                  style={{
                    fontSize: "0.65rem",
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    color: isSelected
                      ? "var(--olive)"
                      : "var(--charcoal-muted)",
                    marginBottom: "0.5rem",
                  }}
                >
                  {isSelected ? "Selected" : "Pick this"}
                </p>
                <p
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: "1.4rem",
                    fontWeight: 300,
                    color: "var(--charcoal)",
                    lineHeight: 1.2,
                    marginBottom: "0.5rem",
                  }}
                >
                  {option.label}
                </p>
                <p
                  style={{
                    fontSize: "0.82rem",
                    color: "var(--charcoal-light)",
                    lineHeight: 1.6,
                  }}
                >
                  {option.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Contact step ──────────────────────────────────────────────────────────────

function ContactStep({
  firstName,
  email,
  setFirstName,
  setEmail,
  submitting,
  error,
  onSubmit,
}: {
  firstName: string;
  email: string;
  setFirstName: (s: string) => void;
  setEmail: (s: string) => void;
  submitting: boolean;
  error: string | null;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit}>
      <h2
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "1.8rem",
          fontWeight: 300,
          lineHeight: 1.3,
          color: "var(--charcoal)",
          textAlign: "center",
          marginBottom: "0.5rem",
        }}
      >
        Where should we send your <em>mood board</em>?
      </h2>
      <p
        style={{
          textAlign: "center",
          fontSize: "0.9rem",
          color: "var(--charcoal-muted)",
          lineHeight: 1.7,
          marginBottom: "2.5rem",
          maxWidth: "440px",
          margin: "0 auto 2.5rem",
        }}
      >
        Save your picks so Korrin can use them when planning your session.
      </p>

      <div
        style={{
          maxWidth: "440px",
          margin: "0 auto",
          display: "grid",
          gap: "1.25rem",
          padding: "2rem",
          border: "0.5px solid var(--border-strong)",
          background: "rgba(250,249,246,0.8)",
        }}
      >
        <div>
          <label
            htmlFor="style-firstName"
            style={{
              display: "block",
              fontSize: "0.65rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--charcoal-muted)",
              marginBottom: "0.5rem",
            }}
          >
            First name
          </label>
          <input
            id="style-firstName"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
            required
            disabled={submitting}
            style={{
              width: "100%",
              padding: "0.85rem 0",
              background: "transparent",
              border: "none",
              borderBottom: "0.5px solid var(--border-strong)",
              fontFamily: "'Jost', sans-serif",
              fontSize: "1rem",
              color: "var(--charcoal)",
              outline: "none",
            }}
          />
        </div>

        <div>
          <label
            htmlFor="style-email"
            style={{
              display: "block",
              fontSize: "0.65rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--charcoal-muted)",
              marginBottom: "0.5rem",
            }}
          >
            Email
          </label>
          <input
            id="style-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            disabled={submitting}
            style={{
              width: "100%",
              padding: "0.85rem 0",
              background: "transparent",
              border: "none",
              borderBottom: "0.5px solid var(--border-strong)",
              fontFamily: "'Jost', sans-serif",
              fontSize: "1rem",
              color: "var(--charcoal)",
              outline: "none",
            }}
          />
        </div>

        {error && (
          <p
            style={{
              fontSize: "0.85rem",
              color: "#991B1B",
              padding: "0.6rem 0.75rem",
              background: "#FEF2F2",
              border: "0.5px solid #FCA5A5",
            }}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: "0.95rem 2rem",
            background: "var(--charcoal)",
            color: "var(--white)",
            border: "none",
            fontFamily: "'Jost', sans-serif",
            fontSize: "0.75rem",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            cursor: submitting ? "wait" : "pointer",
            opacity: submitting ? 0.55 : 1,
            transition: "opacity 0.2s",
          }}
        >
          {submitting ? "Saving…" : "Save my style"}
        </button>

        <p
          style={{
            fontSize: "0.72rem",
            color: "var(--charcoal-muted)",
            lineHeight: 1.6,
            textAlign: "center",
          }}
        >
          We&apos;ll never share your email. Unsubscribe at any time.
        </p>
      </div>
    </form>
  );
}

// ─── Success screen — static example mood board ────────────────────────────────

function SuccessMoodBoard({
  firstName,
  tagSummary,
}: {
  firstName: string;
  tagSummary: string[];
}) {
  // Static 3x3 placeholder grid. Phase 5.8 will replace these with an
  // AI-generated set seeded off the user's `tagSummary`.
  const moodTiles: { swatch: string; title: string }[] = [
    {
      swatch: "linear-gradient(135deg, #F8F4EC 0%, #C8B796 100%)",
      title: "Soft light",
    },
    {
      swatch: "linear-gradient(135deg, #6B7845 0%, #2A2A28 100%)",
      title: "Quiet contrast",
    },
    {
      swatch: "linear-gradient(135deg, #E8B88A 0%, #B8744A 100%)",
      title: "Honey hour",
    },
    {
      swatch: "linear-gradient(135deg, #B5A88E 0%, #756E5E 100%)",
      title: "Lived-in",
    },
    {
      swatch: "linear-gradient(135deg, #2A2A28 0%, #4A4435 100%)",
      title: "Cinematic",
    },
    {
      swatch: "linear-gradient(135deg, #8A9A5A 0%, #C8B796 100%)",
      title: "Field light",
    },
    {
      swatch: "linear-gradient(135deg, #E5E2DA 0%, #B8B2A4 100%)",
      title: "Editorial",
    },
    {
      swatch: "linear-gradient(135deg, #A8B8C0 0%, #5C6B7A 100%)",
      title: "Cool shadow",
    },
    {
      swatch: "linear-gradient(135deg, #FAF9F6 0%, #6B7845 100%)",
      title: "Garden",
    },
  ];

  return (
    <div style={{ textAlign: "center" }}>
      <p
        style={{
          fontSize: "0.65rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--olive)",
          marginBottom: "1rem",
        }}
      >
        Your style is saved
      </p>
      <h2
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "2.4rem",
          fontWeight: 300,
          lineHeight: 1.2,
          color: "var(--charcoal)",
          marginBottom: "1rem",
        }}
      >
        Thank you, <em>{firstName}</em>
      </h2>
      <p
        style={{
          fontSize: "0.95rem",
          color: "var(--charcoal-muted)",
          lineHeight: 1.7,
          maxWidth: "540px",
          margin: "0 auto 0.5rem",
        }}
      >
        A glimpse of your aesthetic — Korrin will tailor your session brief
        from this.
      </p>

      {/* Tag chip row */}
      {tagSummary.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "0.5rem",
            margin: "1.5rem auto 0",
            maxWidth: "540px",
          }}
        >
          {tagSummary.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: "0.65rem",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--olive)",
                border: "0.5px solid var(--olive)",
                padding: "0.35rem 0.8rem",
                fontFamily: "'Jost', sans-serif",
                background: "var(--olive-dim)",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* 3x3 example mood board */}
      <div
        style={{
          marginTop: "3rem",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "0.6rem",
          maxWidth: "640px",
          margin: "3rem auto 0",
        }}
      >
        {moodTiles.map((tile, i) => (
          <div
            key={i}
            style={{
              aspectRatio: "1 / 1",
              background: tile.swatch,
              position: "relative",
              overflow: "hidden",
              border: "0.5px solid var(--border)",
            }}
          >
            <span
              style={{
                position: "absolute",
                bottom: "0.75rem",
                left: "0.85rem",
                fontFamily: "'Cormorant Garamond', serif",
                fontStyle: "italic",
                fontSize: "0.95rem",
                fontWeight: 300,
                color: "rgba(250,249,246,0.9)",
                textShadow: "0 1px 8px rgba(0,0,0,0.3)",
              }}
            >
              {tile.title}
            </span>
          </div>
        ))}
      </div>

      <p
        style={{
          marginTop: "2.5rem",
          color: "var(--charcoal-muted)",
          lineHeight: 1.7,
          maxWidth: "540px",
          margin: "2.5rem auto 0",
          fontStyle: "italic",
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "1.05rem",
        }}
      >
        Ready to book?{" "}
        <a
          href="/booking"
          style={{
            color: "var(--olive)",
            textDecoration: "underline",
            fontStyle: "normal",
            fontFamily: "'Jost', sans-serif",
            fontSize: "0.78rem",
            letterSpacing: "0.04em",
          }}
        >
          Start your inquiry →
        </a>
      </p>
    </div>
  );
}
