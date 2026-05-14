"use client";

// app/admin/settings/gear-templates/GearTemplateEditor.tsx
// Shared editor UI used by both the "new" and "[id]" gear-template routes.
// No server-only imports — type literals re-declared locally to keep the
// client/server boundary clean.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toaster";
import {
  createGearTemplateAction,
  updateGearTemplateAction,
  deleteGearTemplateAction,
  type GearTemplateFormInput,
} from "./actions";

// ─── Local literal types ─────────────────────────────────────────────────────

const CATEGORIES = [
  "CAMERA",
  "LENS",
  "LIGHTING",
  "AUDIO",
  "STORAGE",
  "ACCESSORY",
  "BACKUP",
  "OTHER",
] as const;
type CategoryLiteral = (typeof CATEGORIES)[number];

const SESSION_TYPES = [
  "Wedding",
  "Engagement",
  "Portrait",
  "Family",
  "Editorial",
  "Commercial",
] as const;

export interface SerializedGearTemplateDetail {
  id: string;
  name: string;
  sessionType: string;
  isDefault: boolean;
  items: Array<{
    id: string;
    name: string;
    category: CategoryLiteral;
    required: boolean;
    notes: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  /** Pass `null` for the new route. Pass a serialised doc for the detail route. */
  template: SerializedGearTemplateDetail | null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function GearTemplateEditor({ template }: Props) {
  const router = useRouter();
  const [isSaving, startSave] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  const [name, setName] = useState(template?.name ?? "");
  const [sessionType, setSessionType] = useState(
    template?.sessionType ?? "Portrait"
  );
  const [isDefault, setIsDefault] = useState(template?.isDefault ?? false);
  const [items, setItems] = useState(template?.items ?? [makeEmptyItem()]);

  function makeEmptyItem() {
    return {
      id: `g_${Math.random().toString(36).slice(2, 10)}`,
      name: "",
      category: "ACCESSORY" as CategoryLiteral,
      required: false,
      notes: "",
    };
  }

  function updateItem(idx: number, patch: Partial<(typeof items)[number]>) {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    );
  }

  function addItem() {
    setItems((prev) => [...prev, makeEmptyItem()]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function move(idx: number, dir: -1 | 1) {
    setItems((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  function handleSave() {
    if (!name.trim()) {
      toast("Name is required.");
      return;
    }
    if (items.length === 0) {
      toast("Add at least one gear item.");
      return;
    }

    const input: GearTemplateFormInput = {
      name,
      sessionType,
      isDefault,
      items: items.map((it) => ({
        id: it.id,
        name: it.name,
        category: it.category,
        required: it.required,
        notes: it.notes,
      })),
    };

    startSave(async () => {
      if (template) {
        const res = await updateGearTemplateAction(template.id, input);
        if (res.success) {
          toast("Template saved");
          router.refresh();
        } else {
          toast(res.error);
        }
      } else {
        await createGearTemplateAction(input);
        // createGearTemplateAction redirects on success.
      }
    });
  }

  function handleDelete() {
    if (!template) return;
    if (!confirm(`Delete "${template.name}"? This cannot be undone.`)) return;
    startDelete(async () => {
      const res = await deleteGearTemplateAction(template.id);
      if (res.success) {
        toast("Template deleted");
        router.push("/admin/settings/gear-templates");
      } else {
        toast(res.error);
      }
    });
  }

  const requiredCount = items.filter((it) => it.required).length;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "1.75rem" }}>
        <p style={EYEBROW}>{template ? "Edit Kit" : "New Kit"}</p>
        <h2 style={PAGE_TITLE}>
          {template ? template.name || "Untitled kit" : "New gear kit"}
        </h2>
      </div>

      <div style={CARD}>
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={INPUT}
            placeholder="e.g. Wedding kit"
          />
        </Field>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.75rem",
          }}
        >
          <Field
            label="Session Type"
            helpText="Used to surface this kit on matching projects."
          >
            <select
              value={sessionType}
              onChange={(e) => setSessionType(e.target.value)}
              style={INPUT}
            >
              {SESSION_TYPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Default"
            helpText="Suggested on a project's gear tab. One default per session type."
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.85rem",
                color: "var(--charcoal)",
              }}
            >
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
              />
              Mark as default for {sessionType}
            </label>
          </Field>
        </div>
      </div>

      {/* Items */}
      <div style={{ marginTop: "1.75rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: "1rem",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <h3 style={SECTION_HEAD}>Gear items</h3>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span
              style={{
                fontSize: "0.7rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--charcoal-muted)",
              }}
            >
              {items.length} total · {requiredCount} required
            </span>
            <button type="button" onClick={addItem} style={BTN_GHOST}>
              + Add item
            </button>
          </div>
        </div>

        {items.length === 0 && (
          <p style={{ color: "var(--charcoal-muted)", fontSize: "0.85rem" }}>
            No items yet.
          </p>
        )}

        {items.map((it, idx) => (
          <div key={it.id} style={{ ...CARD, marginBottom: "1rem" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "0.5rem",
                marginBottom: "0.85rem",
              }}
            >
              <span
                style={{
                  ...EYEBROW,
                  fontSize: "0.6rem",
                  letterSpacing: "0.18em",
                }}
              >
                Item {idx + 1}
              </span>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  style={BTN_TINY}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={idx === items.length - 1}
                  style={BTN_TINY}
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  style={BTN_TINY}
                >
                  ×
                </button>
              </div>
            </div>

            <Field label="Name">
              <input
                value={it.name}
                onChange={(e) => updateItem(idx, { name: e.target.value })}
                style={INPUT}
                placeholder="e.g. 24-70mm f/2.8"
              />
            </Field>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.75rem",
              }}
            >
              <Field label="Category">
                <select
                  value={it.category}
                  onChange={(e) =>
                    updateItem(idx, {
                      category: e.target.value as CategoryLiteral,
                    })
                  }
                  style={INPUT}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Required">
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontSize: "0.85rem",
                    color: "var(--charcoal)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={it.required}
                    onChange={(e) =>
                      updateItem(idx, { required: e.target.checked })
                    }
                  />
                  Mark as required
                </label>
              </Field>
            </div>

            <Field label="Notes" helpText="Optional, shown beside the item.">
              <input
                value={it.notes}
                onChange={(e) => updateItem(idx, { notes: e.target.value })}
                style={INPUT}
                placeholder="e.g. Pre-mounted on body 2"
              />
            </Field>
          </div>
        ))}
      </div>

      {/* Save */}
      <div
        style={{
          marginTop: "1.5rem",
          display: "flex",
          gap: "0.75rem",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            style={BTN_PRIMARY}
          >
            {isSaving ? "Saving…" : template ? "Save changes" : "Create kit"}
          </button>
          <span style={{ fontSize: "0.75rem", color: "var(--charcoal-muted)" }}>
            {items.length} item{items.length === 1 ? "" : "s"}
          </span>
        </div>

        {template && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            style={BTN_DANGER}
          >
            {isDeleting ? "Deleting…" : "Delete kit"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Small primitives ────────────────────────────────────────────────────────

function Field({
  label,
  helpText,
  children,
}: {
  label: string;
  helpText?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "0.85rem" }}>
      <label
        style={{
          ...EYEBROW,
          display: "block",
          marginBottom: "0.4rem",
          fontSize: "0.6rem",
        }}
      >
        {label}
      </label>
      {children}
      {helpText && (
        <p
          style={{
            fontSize: "0.75rem",
            color: "var(--charcoal-muted)",
            margin: "0.3rem 0 0",
          }}
        >
          {helpText}
        </p>
      )}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const EYEBROW: React.CSSProperties = {
  fontSize: "0.65rem",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "var(--olive)",
  fontWeight: 400,
};

const PAGE_TITLE: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: "2rem",
  fontWeight: 300,
  marginTop: "0.3rem",
};

const SECTION_HEAD: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 300,
  fontSize: "1.6rem",
  margin: 0,
  letterSpacing: "0.01em",
};

const CARD: React.CSSProperties = {
  background: "var(--white)",
  border: "0.5px solid var(--border)",
  padding: "1.25rem",
};

const INPUT: React.CSSProperties = {
  width: "100%",
  padding: "0.6rem 0.8rem",
  border: "0.5px solid var(--border-strong)",
  background: "var(--white)",
  fontFamily: "'Jost', sans-serif",
  fontSize: "0.88rem",
  color: "var(--charcoal)",
  borderRadius: 0,
  boxSizing: "border-box",
};

const BTN_PRIMARY: React.CSSProperties = {
  padding: "0.85rem 2.2rem",
  fontSize: "0.72rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  background: "var(--olive)",
  color: "var(--white)",
  border: "none",
  cursor: "pointer",
  fontFamily: "'Jost', sans-serif",
};

const BTN_GHOST: React.CSSProperties = {
  padding: "0.55rem 1.1rem",
  border: "0.5px solid var(--border-strong)",
  background: "transparent",
  color: "var(--charcoal)",
  fontFamily: "'Jost', sans-serif",
  fontSize: "0.72rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  cursor: "pointer",
  borderRadius: 0,
};

const BTN_TINY: React.CSSProperties = {
  padding: "0.3rem 0.5rem",
  border: "0.5px solid var(--border-strong)",
  background: "var(--white)",
  color: "var(--charcoal)",
  fontFamily: "'Jost', sans-serif",
  fontSize: "0.7rem",
  cursor: "pointer",
  borderRadius: 0,
  minWidth: "1.8rem",
};

const BTN_DANGER: React.CSSProperties = {
  padding: "0.55rem 1.1rem",
  border: "0.5px solid rgba(176, 50, 50, 0.6)",
  background: "transparent",
  color: "#b03232",
  fontFamily: "'Jost', sans-serif",
  fontSize: "0.72rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  cursor: "pointer",
  borderRadius: 0,
};
