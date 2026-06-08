"use client";

// components/site-editor/forms/SlideshowForm.tsx

import { buildCdnUrl } from "@/lib/cloudflare";
import type { SlideshowSection } from "@/lib/site-content/types";
import { editorStyles } from "../styles";
import { Field, TextInput } from "./primitives";
import { FocalPointPicker } from "../FocalPointPicker";

export function SlideshowForm({
  section,
  onChange,
  onPickSlide,
  onPickAdd,
}: {
  section: SlideshowSection;
  onChange: (patch: Partial<SlideshowSection>) => void;
  onPickSlide: (index: number) => void;
  onPickAdd: () => void;
}) {
  return (
    <>
      <Field label="Eyebrow"><TextInput value={section.eyebrow ?? ""} onChange={(v) => onChange({ eyebrow: v })} /></Field>
      <Field label="Heading"><TextInput value={section.heading ?? ""} onChange={(v) => onChange({ heading: v })} /></Field>
      <Field label="Cycle interval (ms — 1500-30000)">
        <input
          type="number"
          min={1500}
          max={30000}
          step={500}
          value={section.intervalMs ?? 5000}
          onChange={(e) => onChange({ intervalMs: Number(e.target.value) || 5000 })}
          style={editorStyles.input}
        />
      </Field>
      <Field label="Slides">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.5rem", marginBottom: "0.5rem" }}>
          {section.slides.map((slide, i) => (
            <div key={i} style={{ border: "0.5px solid var(--border)", padding: "0.4rem" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={buildCdnUrl(slide.cloudflareImageId, "thumbnail")} alt="" style={{ width: "100%", height: "90px", objectFit: "cover" }} />
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
              <div style={{ marginTop: "0.4rem" }}>
                <FocalPointPicker
                  cloudflareImageId={slide.cloudflareImageId}
                  focalX={slide.focalX}
                  focalY={slide.focalY}
                  onChange={(focalX, focalY) => {
                    const slides = section.slides.map((s, j) =>
                      j === i ? { ...s, focalX, focalY } : s
                    );
                    onChange({ slides });
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={onPickAdd} style={editorStyles.addBtn}>+ Add slide</button>
      </Field>
    </>
  );
}
