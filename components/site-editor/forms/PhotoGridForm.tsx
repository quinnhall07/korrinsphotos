"use client";

// components/site-editor/forms/PhotoGridForm.tsx

import { buildCdnUrl } from "@/lib/cloudflare";
import type { PhotoGridSection } from "@/lib/site-content/types";
import { editorStyles } from "../styles";
import { Field, TextInput, TextArea } from "./primitives";

export function PhotoGridForm({
  section,
  onChange,
  onPickPhoto,
  onPickAdd,
}: {
  section: PhotoGridSection;
  onChange: (patch: Partial<PhotoGridSection>) => void;
  onPickPhoto: (index: number) => void;
  onPickAdd: () => void;
}) {
  return (
    <>
      <Field label="Eyebrow">
        <TextInput value={section.eyebrow ?? ""} onChange={(v) => onChange({ eyebrow: v })} />
      </Field>
      <Field label="Heading (Markdown: **bold**, *italic*)">
        <TextInput value={section.heading ?? ""} onChange={(v) => onChange({ heading: v })} />
      </Field>
      <Field label="Body">
        <TextArea value={section.body ?? ""} onChange={(v) => onChange({ body: v })} />
      </Field>
      <Field label="Columns">
        <select
          value={section.columns}
          onChange={(e) => onChange({ columns: Number(e.target.value) as 2 | 3 | 4 })}
          style={editorStyles.select}
        >
          <option value={2}>2</option>
          <option value={3}>3</option>
          <option value={4}>4</option>
        </select>
      </Field>
      <Field label="Photos">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.5rem", marginBottom: "0.5rem" }}>
          {section.photos.map((p, i) => (
            <div key={`${p.id}-${i}`} style={{ border: "0.5px solid var(--border)", padding: "0.4rem" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={buildCdnUrl(p.cloudflareImageId, "thumbnail")} alt="" style={{ width: "100%", height: "90px", objectFit: "cover" }} />
              <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.3rem" }}>
                <button type="button" onClick={() => onPickPhoto(i)} style={editorStyles.miniBtn}>Swap</button>
                <button
                  type="button"
                  onClick={() => onChange({ photos: section.photos.filter((_, j) => j !== i) })}
                  style={editorStyles.miniBtn}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={onPickAdd} style={editorStyles.addBtn}>+ Add photo</button>
      </Field>
    </>
  );
}
