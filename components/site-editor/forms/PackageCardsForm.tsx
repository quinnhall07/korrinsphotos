"use client";

// components/site-editor/forms/PackageCardsForm.tsx

import type { PackageCardsSection, PackageCard } from "@/lib/site-content/types";
import { editorStyles } from "../styles";
import { Field, TextInput, TextArea } from "./primitives";

export function PackageCardsForm({
  section,
  onChange,
}: {
  section: PackageCardsSection;
  onChange: (patch: Partial<PackageCardsSection>) => void;
}) {
  function updatePkg(i: number, patch: Partial<PackageCard>) {
    const next = section.packages.map((p, j) => (j === i ? { ...p, ...patch } : p));
    onChange({ packages: next });
  }
  function addPkg() {
    onChange({
      packages: [
        ...section.packages,
        {
          id: `pkg-${Math.random().toString(36).slice(2, 6)}`,
          name: "New package",
          startingPriceUsd: 0,
          sessionType: "Portrait",
          includes: [],
          idealFor: "",
        },
      ],
    });
  }
  function removePkg(i: number) {
    if (!confirm("Remove this package?")) return;
    onChange({ packages: section.packages.filter((_, j) => j !== i) });
  }
  return (
    <>
      <Field label="Eyebrow"><TextInput value={section.eyebrow ?? ""} onChange={(v) => onChange({ eyebrow: v })} /></Field>
      <Field label="Heading (Markdown allowed)"><TextInput value={section.heading ?? ""} onChange={(v) => onChange({ heading: v })} /></Field>
      <Field label="Intro paragraph"><TextArea value={section.intro ?? ""} onChange={(v) => onChange({ intro: v })} /></Field>
      <Field label="Packages">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {section.packages.map((p, i) => (
            <div key={p.id} style={{ border: "0.5px solid var(--border)", padding: "0.75rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 110px auto", gap: "0.5rem", alignItems: "start" }}>
                <input
                  value={p.name}
                  onChange={(e) => updatePkg(i, { name: e.target.value })}
                  placeholder="Package name"
                  style={editorStyles.input}
                />
                <input
                  type="number"
                  min={0}
                  step={25}
                  value={p.startingPriceUsd}
                  onChange={(e) => updatePkg(i, { startingPriceUsd: Number(e.target.value) || 0 })}
                  style={editorStyles.input}
                />
                <button type="button" onClick={() => removePkg(i)} style={editorStyles.miniBtn}>×</button>
              </div>
              <input
                value={p.sessionType}
                onChange={(e) => updatePkg(i, { sessionType: e.target.value })}
                placeholder="sessionType (Portrait, Family, …)"
                style={{ ...editorStyles.input, marginTop: "0.4rem" }}
              />
              <textarea
                value={p.includes.join("\n")}
                onChange={(e) => updatePkg(i, { includes: e.target.value.split("\n").filter(Boolean) })}
                placeholder="Inclusions — one per line"
                rows={4}
                style={{ ...editorStyles.textarea, marginTop: "0.4rem" }}
              />
              <input
                value={p.idealFor}
                onChange={(e) => updatePkg(i, { idealFor: e.target.value })}
                placeholder="Ideal for…"
                style={{ ...editorStyles.input, marginTop: "0.4rem" }}
              />
              <input
                value={p.id}
                onChange={(e) => updatePkg(i, { id: e.target.value.trim() })}
                placeholder="slug (controls ?package=)"
                style={{ ...editorStyles.input, marginTop: "0.4rem" }}
              />
            </div>
          ))}
          <button type="button" onClick={addPkg} style={editorStyles.addBtn}>+ Add package</button>
        </div>
      </Field>
    </>
  );
}
