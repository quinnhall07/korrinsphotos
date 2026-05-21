"use client";

// components/site-editor/forms/HeroForm.tsx
// Per-section property form for HERO blocks.

import { buildCdnUrl } from "@/lib/cloudflare";
import type { HeroSection } from "@/lib/site-content/types";
import { editorStyles } from "../styles";
import { Field, TextInput, TextArea } from "./primitives";

export function HeroForm({
  section,
  onChange,
  onPickSlide,
  onPickAdd,
}: {
  section: HeroSection;
  onChange: (patch: Partial<HeroSection>) => void;
  onPickSlide: (index: number) => void;
  onPickAdd: () => void;
}) {
  return (
    <>
      <Field label="Eyebrow (small uppercase line)">
        <TextInput value={section.eyebrow ?? ""} onChange={(v) => onChange({ eyebrow: v })} />
      </Field>
      <Field label="Headline (Markdown: **bold**, *italic*)">
        <TextInput value={section.headline ?? ""} onChange={(v) => onChange({ headline: v })} />
      </Field>
      <Field label="Sub-headline">
        <TextArea value={section.sub ?? ""} onChange={(v) => onChange({ sub: v })} />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <Field label="Primary CTA label">
          <TextInput value={section.primaryCtaLabel ?? ""} onChange={(v) => onChange({ primaryCtaLabel: v })} />
        </Field>
        <Field label="Primary CTA href">
          <TextInput value={section.primaryCtaHref ?? ""} onChange={(v) => onChange({ primaryCtaHref: v })} placeholder="/booking" />
        </Field>
        <Field label="Secondary CTA label">
          <TextInput value={section.secondaryCtaLabel ?? ""} onChange={(v) => onChange({ secondaryCtaLabel: v })} />
        </Field>
        <Field label="Secondary CTA href">
          <TextInput value={section.secondaryCtaHref ?? ""} onChange={(v) => onChange({ secondaryCtaHref: v })} placeholder="/portfolio" />
        </Field>
      </div>

      <Field label="Slides">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.5rem", marginBottom: "0.5rem" }}>
          {section.slides.map((slide, i) => (
            <div key={i} style={{ border: "0.5px solid var(--border)", padding: "0.4rem" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={buildCdnUrl(slide.photoRef.cloudflareImageId, "thumbnail")}
                alt=""
                style={{ width: "100%", height: "90px", objectFit: "cover" }}
              />
              <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.3rem" }}>
                <button type="button" onClick={() => onPickSlide(i)} style={editorStyles.miniBtn}>Swap</button>
                <button
                  type="button"
                  onClick={() => onChange({ slides: section.slides.filter((_, j) => j !== i) })}
                  style={editorStyles.miniBtn}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={onPickAdd} style={editorStyles.addBtn}>+ Add slide</button>
      </Field>
    </>
  );
}
