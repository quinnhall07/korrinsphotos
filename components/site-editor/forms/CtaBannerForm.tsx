"use client";

// components/site-editor/forms/CtaBannerForm.tsx

import type { CtaBannerSection } from "@/lib/site-content/types";
import { editorStyles } from "../styles";
import { Field, TextInput } from "./primitives";

export function CtaBannerForm({
  section,
  onChange,
}: {
  section: CtaBannerSection;
  onChange: (patch: Partial<CtaBannerSection>) => void;
}) {
  return (
    <>
      <Field label="Eyebrow">
        <TextInput value={section.eyebrow ?? ""} onChange={(v) => onChange({ eyebrow: v })} />
      </Field>
      <Field label="Headline (Markdown: **bold**, *italic*)">
        <TextInput value={section.headline} onChange={(v) => onChange({ headline: v })} />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <Field label="Primary CTA label">
          <TextInput value={section.primaryCtaLabel ?? ""} onChange={(v) => onChange({ primaryCtaLabel: v })} />
        </Field>
        <Field label="Primary CTA href">
          <TextInput value={section.primaryCtaHref ?? ""} onChange={(v) => onChange({ primaryCtaHref: v })} />
        </Field>
        <Field label="Secondary CTA label">
          <TextInput value={section.secondaryCtaLabel ?? ""} onChange={(v) => onChange({ secondaryCtaLabel: v })} />
        </Field>
        <Field label="Secondary CTA href">
          <TextInput value={section.secondaryCtaHref ?? ""} onChange={(v) => onChange({ secondaryCtaHref: v })} />
        </Field>
      </div>
      <Field label="Variant">
        <select
          value={section.variant ?? "DARK"}
          onChange={(e) => onChange({ variant: e.target.value as "DARK" | "LIGHT" })}
          style={editorStyles.select}
        >
          <option value="DARK">Dark (charcoal background)</option>
          <option value="LIGHT">Light (olive tint background)</option>
        </select>
      </Field>
    </>
  );
}
