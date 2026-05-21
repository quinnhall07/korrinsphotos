"use client";

// components/site-editor/forms/StatsForm.tsx

import type { StatsSection } from "@/lib/site-content/types";
import { editorStyles } from "../styles";
import { Field } from "./primitives";

export function StatsForm({
  section,
  onChange,
}: {
  section: StatsSection;
  onChange: (patch: Partial<StatsSection>) => void;
}) {
  function setItem(i: number, patch: Partial<{ number: string; label: string }>) {
    const next = section.items.map((it, j) => (j === i ? { ...it, ...patch } : it));
    onChange({ items: next });
  }
  return (
    <Field label="Stats">
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {section.items.map((it, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "100px 1fr auto", gap: "0.4rem", alignItems: "center" }}>
            <input
              value={it.number}
              onChange={(e) => setItem(i, { number: e.target.value })}
              placeholder="340+"
              style={editorStyles.input}
            />
            <input
              value={it.label}
              onChange={(e) => setItem(i, { label: e.target.value })}
              placeholder="Sessions Completed"
              style={editorStyles.input}
            />
            <button
              type="button"
              onClick={() => onChange({ items: section.items.filter((_, j) => j !== i) })}
              style={editorStyles.miniBtn}
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange({ items: [...section.items, { number: "", label: "" }] })}
          style={editorStyles.addBtn}
        >
          + Add stat
        </button>
      </div>
    </Field>
  );
}
