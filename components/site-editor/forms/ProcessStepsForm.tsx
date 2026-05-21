"use client";

// components/site-editor/forms/ProcessStepsForm.tsx

import type { ProcessStepsSection } from "@/lib/site-content/types";
import { editorStyles } from "../styles";
import { Field, TextInput, TextArea } from "./primitives";

export function ProcessStepsForm({
  section,
  onChange,
}: {
  section: ProcessStepsSection;
  onChange: (patch: Partial<ProcessStepsSection>) => void;
}) {
  function setStep(i: number, patch: Partial<{ n: string; title: string; body: string }>) {
    const next = section.steps.map((s, j) => (j === i ? { ...s, ...patch } : s));
    onChange({ steps: next });
  }
  function addStep() {
    const n = String(section.steps.length + 1).padStart(2, "0");
    onChange({ steps: [...section.steps, { n, title: "New step", body: "" }] });
  }
  function removeStep(i: number) {
    if (!confirm("Remove this step?")) return;
    onChange({ steps: section.steps.filter((_, j) => j !== i) });
  }
  return (
    <>
      <Field label="Eyebrow"><TextInput value={section.eyebrow ?? ""} onChange={(v) => onChange({ eyebrow: v })} /></Field>
      <Field label="Heading (Markdown allowed)"><TextInput value={section.heading ?? ""} onChange={(v) => onChange({ heading: v })} /></Field>
      <Field label="Intro paragraph"><TextArea value={section.intro ?? ""} onChange={(v) => onChange({ intro: v })} /></Field>
      <Field label="Steps">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {section.steps.map((s, i) => (
            <div key={i} style={{ border: "0.5px solid var(--border)", padding: "0.75rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "80px 1fr auto", gap: "0.5rem", alignItems: "start" }}>
                <input
                  value={s.n}
                  onChange={(e) => setStep(i, { n: e.target.value })}
                  placeholder="01"
                  style={editorStyles.input}
                />
                <input
                  value={s.title}
                  onChange={(e) => setStep(i, { title: e.target.value })}
                  placeholder="Step title"
                  style={editorStyles.input}
                />
                <button type="button" onClick={() => removeStep(i)} style={editorStyles.miniBtn}>×</button>
              </div>
              <textarea
                value={s.body}
                onChange={(e) => setStep(i, { body: e.target.value })}
                placeholder="Step body"
                rows={3}
                style={{ ...editorStyles.textarea, marginTop: "0.4rem" }}
              />
            </div>
          ))}
          <button type="button" onClick={addStep} style={editorStyles.addBtn}>+ Add step</button>
        </div>
      </Field>
    </>
  );
}
