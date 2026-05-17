"use client";

// app/admin/questionnaires/templates/TemplateEditor.tsx
// Shared editor UI used by /admin/questionnaires/templates/new and
// /admin/questionnaires/templates/[id]. No server-only imports — types
// are re-declared locally to keep the client/server boundary clean.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toaster";
import {
  createTemplateAction,
  updateTemplateAction,
  type TemplateFormInput,
} from "./actions";

// ─── Local literal types ─────────────────────────────────────────────────────

const QUESTION_TYPES = [
  "text",
  "longtext",
  "multiselect",
  "single",
  "date",
  "number",
] as const;
type QuestionTypeLiteral = (typeof QUESTION_TYPES)[number];

const SESSION_TYPES = [
  "Wedding",
  "Engagement",
  "Portrait",
  "Family",
  "Editorial",
  "Commercial",
] as const;

export interface SerializedTemplateDetail {
  id: string;
  name: string;
  sessionType: string;
  questions: Array<{
    id: string;
    type: QuestionTypeLiteral;
    label: string;
    options: string[];
    required: boolean;
    helpText: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  /** Pass `null` for the new route. Pass a serialised doc for the detail route. */
  template: SerializedTemplateDetail | null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TemplateEditor({ template }: Props) {
  const router = useRouter();
  const [isSaving, startSave] = useTransition();

  const [name, setName] = useState(template?.name ?? "");
  const [sessionType, setSessionType] = useState(
    template?.sessionType ?? "Portrait"
  );
  const [questions, setQuestions] = useState(
    template?.questions ?? [makeEmptyQuestion()]
  );

  function makeEmptyQuestion() {
    return {
      id: `q_${Math.random().toString(36).slice(2, 8)}`,
      type: "text" as QuestionTypeLiteral,
      label: "",
      options: [] as string[],
      required: false,
      helpText: "",
    };
  }

  function updateQuestion(
    idx: number,
    patch: Partial<(typeof questions)[number]>
  ) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, ...patch } : q))
    );
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, makeEmptyQuestion()]);
  }

  function removeQuestion(idx: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  }

  function move(idx: number, dir: -1 | 1) {
    setQuestions((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  function handleSave() {
    if (!name.trim()) {
      toast("Name is required.");
      return;
    }
    if (questions.length === 0) {
      toast("Add at least one question.");
      return;
    }

    const input: TemplateFormInput = {
      name,
      sessionType,
      questions: questions.map((q) => ({
        id: q.id,
        type: q.type,
        label: q.label,
        options: q.options,
        required: q.required,
        helpText: q.helpText,
      })),
    };

    startSave(async () => {
      if (template) {
        const res = await updateTemplateAction(template.id, input);
        if (res.success) {
          toast("Template saved");
          router.refresh();
        } else {
          toast(res.error);
        }
      } else {
        await createTemplateAction(input);
        // createTemplateAction redirects on success.
      }
    });
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "1.75rem" }}>
        <p style={EYEBROW}>
          {template ? "Edit Template" : "New Template"}
        </p>
        <h2 style={PAGE_TITLE}>
          {template ? template.name || "Untitled template" : "New template"}
        </h2>
      </div>

      <div style={CARD}>
        {/* Name */}
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={INPUT}
            placeholder="e.g. Wedding Day Vibe Check"
          />
        </Field>

        {/* Session type */}
        <Field
          label="Session Type"
          helpText="Used to auto-dispatch when a project of this session type hits BOOKED."
        >
          <select
            value={sessionType}
            onChange={(e) => setSessionType(e.target.value)}
            style={INPUT}
          >
            {SESSION_TYPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* Questions */}
      <div style={{ marginTop: "1.75rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: "1rem",
          }}
        >
          <h3 style={SECTION_HEAD}>Questions</h3>
          <button type="button" onClick={addQuestion} style={BTN_GHOST}>
            + Add question
          </button>
        </div>

        {questions.length === 0 && (
          <p style={{ color: "var(--charcoal-muted)", fontSize: "0.85rem" }}>
            No questions yet.
          </p>
        )}

        {questions.map((q, idx) => (
          <div key={q.id} style={{ ...CARD, marginBottom: "1rem" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "0.5rem",
                marginBottom: "0.85rem",
              }}
            >
              <span
                style={{
                  ...EYEBROW,
                  fontSize: "0.6rem",
                  letterSpacing: "0.18em",
                }}
              >
                Question {idx + 1}
              </span>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  style={BTN_TINY}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={idx === questions.length - 1}
                  style={BTN_TINY}
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeQuestion(idx)}
                  style={BTN_TINY}
                >
                  ×
                </button>
              </div>
            </div>

            <Field label="Label">
              <input
                value={q.label}
                onChange={(e) => updateQuestion(idx, { label: e.target.value })}
                style={INPUT}
                placeholder="What's the question?"
              />
            </Field>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.75rem",
              }}
            >
              <Field label="Type">
                <select
                  value={q.type}
                  onChange={(e) =>
                    updateQuestion(idx, {
                      type: e.target.value as QuestionTypeLiteral,
                    })
                  }
                  style={INPUT}
                >
                  {QUESTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Required">
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontSize: "0.85rem",
                    color: "var(--charcoal)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={q.required}
                    onChange={(e) =>
                      updateQuestion(idx, { required: e.target.checked })
                    }
                  />
                  Mark as required
                </label>
              </Field>
            </div>

            <Field
              label="Help text"
              helpText="Optional — shown below the question."
            >
              <input
                value={q.helpText}
                onChange={(e) =>
                  updateQuestion(idx, { helpText: e.target.value })
                }
                style={INPUT}
                placeholder="Optional context for the client"
              />
            </Field>

            {(q.type === "single" || q.type === "multiselect") && (
              <Field
                label="Options"
                helpText="One per line."
              >
                <textarea
                  value={q.options.join("\n")}
                  onChange={(e) =>
                    updateQuestion(idx, {
                      options: e.target.value
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  rows={4}
                  style={{ ...INPUT, minHeight: "5rem", resize: "vertical" }}
                  placeholder={"Option A\nOption B\nOption C"}
                />
              </Field>
            )}
          </div>
        ))}
      </div>

      {/* Save */}
      <div
        style={{
          marginTop: "1.5rem",
          display: "flex",
          gap: "0.75rem",
          alignItems: "center",
        }}
      >
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          style={BTN_PRIMARY}
        >
          {isSaving ? "Saving…" : template ? "Save changes" : "Create template"}
        </button>
        <span style={{ fontSize: "0.75rem", color: "var(--charcoal-muted)" }}>
          {questions.length} question{questions.length === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}

// ─── Small primitives ────────────────────────────────────────────────────────

function Field({
  label,
  helpText,
  children,
}: {
  label: string;
  helpText?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "0.85rem" }}>
      <label
        style={{
          ...EYEBROW,
          display: "block",
          marginBottom: "0.4rem",
          fontSize: "0.6rem",
        }}
      >
        {label}
      </label>
      {children}
      {helpText && (
        <p
          style={{
            fontSize: "0.75rem",
            color: "var(--charcoal-muted)",
            margin: "0.3rem 0 0",
          }}
        >
          {helpText}
        </p>
      )}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const EYEBROW: React.CSSProperties = {
  fontSize: "0.65rem",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "var(--olive)",
  fontWeight: 400,
};

const PAGE_TITLE: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: "2rem",
  fontWeight: 300,
  marginTop: "0.3rem",
};

const SECTION_HEAD: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 300,
  fontSize: "1.6rem",
  margin: 0,
  letterSpacing: "0.01em",
};

const CARD: React.CSSProperties = {
  background: "var(--white)",
  border: "0.5px solid var(--border)",
  padding: "1.25rem",
};

const INPUT: React.CSSProperties = {
  width: "100%",
  padding: "0.6rem 0.8rem",
  border: "0.5px solid var(--border-strong)",
  background: "var(--white)",
  fontFamily: "'Jost', sans-serif",
  fontSize: "0.88rem",
  color: "var(--charcoal)",
  borderRadius: 0,
  boxSizing: "border-box",
};

const BTN_PRIMARY: React.CSSProperties = {
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

const BTN_GHOST: React.CSSProperties = {
  padding: "0.55rem 1.1rem",
  border: "0.5px solid var(--border-strong)",
  background: "transparent",
  color: "var(--charcoal)",
  fontFamily: "'Jost', sans-serif",
  fontSize: "0.72rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  cursor: "pointer",
  borderRadius: 0,
};

const BTN_TINY: React.CSSProperties = {
  padding: "0.3rem 0.5rem",
  border: "0.5px solid var(--border-strong)",
  background: "var(--white)",
  color: "var(--charcoal)",
  fontFamily: "'Jost', sans-serif",
  fontSize: "0.7rem",
  cursor: "pointer",
  borderRadius: 0,
  minWidth: "1.8rem",
};
