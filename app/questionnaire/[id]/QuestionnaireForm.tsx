"use client";

// app/questionnaire/[id]/QuestionnaireForm.tsx
// Client-side form for the public questionnaire page. Maps each question
// to its appropriate input and posts to the server action. Server-only
// modules are never imported here — types are mirrored locally to stay on
// the right side of the client/server boundary.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toaster";
import { submitQuestionnaireAction } from "./actions";
import type { SerialQuestion } from "./page";

interface Props {
  questionnaireId: string;
  questions: SerialQuestion[];
}

type ResponseMap = Record<string, unknown>;

export function QuestionnaireForm({ questionnaireId, questions }: Props) {
  const router = useRouter();
  const [responses, setResponses] = useState<ResponseMap>(() =>
    initialResponses(questions)
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const requiredIds = useMemo(
    () => questions.filter((q) => q.required).map((q) => q.id),
    [questions]
  );

  function setValue(id: string, value: unknown) {
    setResponses((prev) => ({ ...prev, [id]: value }));
  }

  function toggleMulti(id: string, option: string) {
    setResponses((prev) => {
      const current = Array.isArray(prev[id]) ? (prev[id] as string[]) : [];
      const next = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option];
      return { ...prev, [id]: next };
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    for (const id of requiredIds) {
      const v = responses[id];
      const empty =
        v == null ||
        v === "" ||
        (Array.isArray(v) && v.length === 0);
      if (empty) {
        const q = questions.find((q) => q.id === id);
        setError(`Please answer: ${q?.label ?? id}`);
        return;
      }
    }
    setError(null);

    startTransition(async () => {
      const res = await submitQuestionnaireAction(questionnaireId, responses);
      if (res.success) {
        toast("Thanks — submitted.");
        router.refresh();
      } else {
        setError(res.error);
        toast(res.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "block", marginTop: "1rem" }}>
      {questions.map((q) => (
        <fieldset
          key={q.id}
          style={{
            border: "none",
            borderTop: "0.5px solid var(--border)",
            padding: "1.75rem 0 0.25rem",
            margin: 0,
          }}
        >
          <legend
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "1.35rem",
              fontWeight: 300,
              color: "var(--charcoal)",
              padding: 0,
              lineHeight: 1.35,
            }}
          >
            {q.label}
            {q.required && (
              <span style={{ color: "var(--olive)", marginLeft: "0.35rem" }}>
                *
              </span>
            )}
          </legend>
          {q.helpText && (
            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--charcoal-muted)",
                margin: "0.5rem 0 0.85rem",
                lineHeight: 1.5,
              }}
            >
              {q.helpText}
            </p>
          )}

          <div style={{ marginTop: "0.85rem" }}>
            <QuestionInput
              question={q}
              value={responses[q.id]}
              onChange={(v) => setValue(q.id, v)}
              onToggleMulti={(option) => toggleMulti(q.id, option)}
            />
          </div>
        </fieldset>
      ))}

      {error && (
        <p
          style={{
            color: "#991B1B",
            fontSize: "0.85rem",
            marginTop: "1.5rem",
          }}
        >
          {error}
        </p>
      )}

      <div
        style={{
          marginTop: "2.5rem",
          display: "flex",
          gap: "0.75rem",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button type="submit" style={BTN_PRIMARY} disabled={isPending}>
          {isPending ? "Submitting…" : "Submit responses"}
        </button>
        <span style={{ fontSize: "0.75rem", color: "var(--charcoal-muted)" }}>
          Required fields are marked with{" "}
          <span style={{ color: "var(--olive)" }}>*</span>
        </span>
      </div>
    </form>
  );
}

// ─── Per-question input renderer ─────────────────────────────────────────────

function QuestionInput({
  question,
  value,
  onChange,
  onToggleMulti,
}: {
  question: SerialQuestion;
  value: unknown;
  onChange: (v: unknown) => void;
  onToggleMulti: (option: string) => void;
}) {
  switch (question.type) {
    case "text":
      return (
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          style={INPUT}
          required={question.required}
        />
      );
    case "longtext":
      return (
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
          style={{ ...INPUT, minHeight: "9rem", resize: "vertical" }}
          required={question.required}
        />
      );
    case "number":
      return (
        <input
          type="number"
          value={
            typeof value === "number"
              ? value
              : typeof value === "string"
              ? value
              : ""
          }
          onChange={(e) =>
            onChange(e.target.value === "" ? "" : Number(e.target.value))
          }
          style={INPUT}
          required={question.required}
        />
      );
    case "date":
      return (
        <input
          type="date"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          style={INPUT}
          required={question.required}
        />
      );
    case "single": {
      const options: string[] = question.options ?? [];
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {options.map((opt: string) => (
            <label
              key={opt}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.65rem",
                fontSize: "0.92rem",
                color: "var(--charcoal)",
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name={question.id}
                value={opt}
                checked={value === opt}
                onChange={() => onChange(opt)}
                required={question.required}
              />
              {opt}
            </label>
          ))}
        </div>
      );
    }
    case "multiselect": {
      const options: string[] = question.options ?? [];
      const current = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {options.map((opt: string) => (
            <label
              key={opt}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.65rem",
                fontSize: "0.92rem",
                color: "var(--charcoal)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={current.includes(opt)}
                onChange={() => onToggleMulti(opt)}
              />
              {opt}
            </label>
          ))}
        </div>
      );
    }
    default:
      return null;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initialResponses(questions: SerialQuestion[]): ResponseMap {
  const out: ResponseMap = {};
  for (const q of questions) {
    if (q.type === "multiselect") out[q.id] = [];
    else out[q.id] = "";
  }
  return out;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  width: "100%",
  padding: "0.7rem 0.85rem",
  border: "0.5px solid var(--border-strong)",
  background: "var(--white)",
  fontFamily: "'Jost', sans-serif",
  fontSize: "0.95rem",
  color: "var(--charcoal)",
  borderRadius: 0,
  boxSizing: "border-box",
};

const BTN_PRIMARY: React.CSSProperties = {
  padding: "0.95rem 2.4rem",
  fontSize: "0.72rem",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  background: "var(--olive)",
  color: "var(--white)",
  border: "none",
  cursor: "pointer",
  fontFamily: "'Jost', sans-serif",
};
