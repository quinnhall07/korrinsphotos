"use client";

// components/site-editor/forms/BookingFormForm.tsx

import type { BookingFormSection } from "@/lib/site-content/types";
import { Field, TextInput, TextArea } from "./primitives";

export function BookingFormForm({
  section,
  onChange,
}: {
  section: BookingFormSection;
  onChange: (patch: Partial<BookingFormSection>) => void;
}) {
  return (
    <>
      <Field label="Eyebrow">
        <TextInput value={section.eyebrow ?? ""} onChange={(v) => onChange({ eyebrow: v })} />
      </Field>
      <Field label="Heading">
        <TextInput value={section.heading ?? ""} onChange={(v) => onChange({ heading: v })} />
      </Field>
      <Field label="Intro">
        <TextArea value={section.intro ?? ""} onChange={(v) => onChange({ intro: v })} rows={4} />
      </Field>
    </>
  );
}
