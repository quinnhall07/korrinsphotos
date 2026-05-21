"use client";

// components/site-editor/forms/primitives.tsx
// Shared form primitives for the on-page editor drawer. Same shape and styles
// as the previous EditorClient.tsx form fields; extracted so every per-type
// form can import without duplicating CSS.

import { editorStyles } from "../styles";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={editorStyles.field}>
      <span style={editorStyles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={editorStyles.input}
    />
  );
}

export function TextArea({
  value,
  onChange,
  rows = 4,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      style={editorStyles.textarea}
    />
  );
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  placeholder,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      style={editorStyles.input}
    />
  );
}
