"use client";

// components/site-editor/forms/RichTextForm.tsx

import type { RichTextSection } from "@/lib/site-content/types";
import { Field, TextInput, TextArea } from "./primitives";

export function RichTextForm({
  section,
  onChange,
}: {
  section: RichTextSection;
  onChange: (patch: Partial<RichTextSection>) => void;
}) {
  return (
    <>
      <Field label="Eyebrow">
        <TextInput value={section.eyebrow ?? ""} onChange={(v) => onChange({ eyebrow: v })} />
      </Field>
      <Field label="Heading">
        <TextInput value={section.heading ?? ""} onChange={(v) => onChange({ heading: v })} />
      </Field>
      <Field label="Body (Markdown: paragraphs, **bold**, *italic*, [links](href), - bullets)">
        <TextArea value={section.body} onChange={(v) => onChange({ body: v })} rows={10} />
      </Field>
    </>
  );
}
