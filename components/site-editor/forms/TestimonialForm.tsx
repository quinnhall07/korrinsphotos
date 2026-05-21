"use client";

// components/site-editor/forms/TestimonialForm.tsx

import type { TestimonialSection } from "@/lib/site-content/types";
import { editorStyles } from "../styles";
import { Field, TextInput, TextArea } from "./primitives";

export function TestimonialForm({
  section,
  onChange,
}: {
  section: TestimonialSection;
  onChange: (patch: Partial<TestimonialSection>) => void;
}) {
  return (
    <>
      <Field label="Eyebrow"><TextInput value={section.eyebrow ?? ""} onChange={(v) => onChange({ eyebrow: v })} /></Field>
      <Field label="Quote"><TextArea value={section.quote} onChange={(v) => onChange({ quote: v })} rows={6} /></Field>
      <Field label="Author"><TextInput value={section.author ?? ""} onChange={(v) => onChange({ author: v })} /></Field>
      <Field label="Author role / context"><TextInput value={section.authorRole ?? ""} onChange={(v) => onChange({ authorRole: v })} /></Field>
      <Field label="Variant">
        <select
          value={section.variant ?? "DARK"}
          onChange={(e) => onChange({ variant: e.target.value as "DARK" | "LIGHT" })}
          style={editorStyles.select}
        >
          <option value="DARK">Dark</option>
          <option value="LIGHT">Light</option>
        </select>
      </Field>
    </>
  );
}
