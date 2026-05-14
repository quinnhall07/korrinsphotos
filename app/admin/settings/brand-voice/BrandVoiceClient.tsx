"use client";

// app/admin/settings/brand-voice/BrandVoiceClient.tsx
// Phase 13.13 — Editorial editor for the admin's voice anchor samples.
// All persistence runs through server actions in `./actions.ts`.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toaster";
import {
  addBrandVoiceSampleAction,
  removeBrandVoiceSampleAction,
  updateBrandVoiceSampleAction,
} from "./actions";

export interface BrandVoiceSampleView {
  id: string;
  label: string;
  body: string;
  context: string | null;
  createdAtIso: string;
}

interface Limits {
  maxSamples: number;
  minBody: number;
  maxBody: number;
}

interface Props {
  initial: BrandVoiceSampleView[];
  limits: Limits;
}

const LABEL: React.CSSProperties = {
  fontSize: "0.65rem",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "var(--olive)",
  fontWeight: 400,
  marginBottom: "0.4rem",
  display: "block",
};

const INPUT: React.CSSProperties = {
  width: "100%",
  padding: "0.6rem 0.7rem",
  fontSize: "0.9rem",
  border: "0.5px solid var(--border-strong)",
  background: "var(--white)",
  color: "var(--charcoal)",
  fontFamily: "'Jost', sans-serif",
  borderRadius: 0,
};

const TEXTAREA: React.CSSProperties = {
  ...INPUT,
  minHeight: "150px",
  resize: "vertical",
  lineHeight: 1.55,
};

const BTN_PRIMARY: React.CSSProperties = {
  padding: "0.6rem 1.2rem",
  border: "0.5px solid var(--olive)",
  background: "var(--olive)",
  color: "var(--white)",
  fontFamily: "'Jost', sans-serif",
  fontSize: "0.75rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  cursor: "pointer",
  borderRadius: 0,
};

const BTN_GHOST: React.CSSProperties = {
  padding: "0.45rem 0.85rem",
  border: "0.5px solid var(--border-strong)",
  background: "transparent",
  color: "var(--charcoal-light)",
  fontFamily: "'Jost', sans-serif",
  fontSize: "0.7rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  cursor: "pointer",
  borderRadius: 0,
};

export function BrandVoiceClient({ initial, limits }: Props) {
  const router = useRouter();
  const [samples, setSamples] = useState<BrandVoiceSampleView[]>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);

  const atCap = samples.length >= limits.maxSamples;

  const handleDeleted = (id: string) => {
    setSamples((prev) => prev.filter((s) => s.id !== id));
  };

  const handleUpdated = (next: BrandVoiceSampleView) => {
    setSamples((prev) => prev.map((s) => (s.id === next.id ? next : s)));
    setEditingId(null);
  };

  const handleAdded = (next: BrandVoiceSampleView) => {
    setSamples((prev) => [...prev, next]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Existing samples */}
      <section>
        <p
          style={{
            fontSize: "0.6rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--charcoal-muted)",
            marginBottom: "0.75rem",
          }}
        >
          Saved samples ({samples.length} / {limits.maxSamples})
        </p>

        {samples.length === 0 ? (
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--charcoal-muted)",
              padding: "1.5rem",
              border: "0.5px dashed var(--border-strong)",
              background: "rgba(42,42,40,0.02)",
            }}
          >
            No samples yet. Add your first one below.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {samples.map((s) => (
              <SampleRow
                key={s.id}
                sample={s}
                isEditing={editingId === s.id}
                limits={limits}
                onStartEdit={() => setEditingId(s.id)}
                onCancelEdit={() => setEditingId(null)}
                onDeleted={() => handleDeleted(s.id)}
                onUpdated={handleUpdated}
                router={router}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Add form */}
      <section>
        <p
          style={{
            fontSize: "0.6rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--charcoal-muted)",
            marginBottom: "0.75rem",
          }}
        >
          Add a sample
        </p>
        {atCap ? (
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--charcoal-light)",
              padding: "1rem",
              border: "0.5px solid var(--border-strong)",
              background: "var(--olive-dim)",
            }}
          >
            You&apos;ve reached the cap of {limits.maxSamples} samples. Remove
            one to add another.
          </p>
        ) : (
          <AddForm limits={limits} onAdded={handleAdded} router={router} />
        )}
      </section>
    </div>
  );
}

/* ───────────────────── Add form ───────────────────── */

interface RouterShape {
  refresh: () => void;
}

function AddForm({
  limits,
  onAdded,
  router,
}: {
  limits: Limits;
  onAdded: (s: BrandVoiceSampleView) => void;
  router: RouterShape;
}) {
  const [label, setLabel] = useState("");
  const [context, setContext] = useState("");
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  const bodyLen = body.length;
  const bodyTooShort = bodyLen > 0 && bodyLen < limits.minBody;
  const bodyTooLong = bodyLen > limits.maxBody;
  const canSubmit =
    !pending &&
    label.trim().length > 0 &&
    bodyLen >= limits.minBody &&
    bodyLen <= limits.maxBody;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    startTransition(async () => {
      const res = await addBrandVoiceSampleAction({ label, body, context });
      if (res.success) {
        toast("Sample saved");
        onAdded({
          id: res.data.id,
          label: res.data.label,
          body: res.data.body,
          context: res.data.context ?? null,
          createdAtIso: new Date().toISOString(),
        });
        setLabel("");
        setContext("");
        setBody("");
        router.refresh();
      } else {
        toast(res.error);
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        padding: "1.25rem",
        border: "0.5px solid var(--border)",
        background: "rgba(42,42,40,0.02)",
      }}
    >
      <div>
        <label style={LABEL}>Label</label>
        <input
          style={INPUT}
          type="text"
          value={label}
          maxLength={80}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Reply to a venue inquiry"
        />
      </div>

      <div>
        <label style={LABEL}>Context (optional)</label>
        <input
          style={INPUT}
          type="text"
          value={context}
          maxLength={160}
          onChange={(e) => setContext(e.target.value)}
          placeholder="e.g. Used for cold leads from Instagram"
        />
      </div>

      <div>
        <label style={LABEL}>Body</label>
        <textarea
          style={TEXTAREA}
          rows={6}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Paste a passage that sounds like you. The closer to your real reply voice, the better the AI drafts."
        />
        <p
          style={{
            fontSize: "0.7rem",
            color: bodyTooShort || bodyTooLong ? "var(--olive)" : "var(--charcoal-muted)",
            marginTop: "0.4rem",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>
            {bodyTooShort
              ? `Need at least ${limits.minBody} characters.`
              : bodyTooLong
                ? `Trim to ${limits.maxBody} characters or fewer.`
                : `Aim for ${limits.minBody}–${limits.maxBody} characters.`}
          </span>
          <span>
            {bodyLen} / {limits.maxBody}
          </span>
        </p>
      </div>

      <div>
        <button type="submit" style={{ ...BTN_PRIMARY, opacity: canSubmit ? 1 : 0.55 }} disabled={!canSubmit}>
          {pending ? "Saving…" : "Add sample"}
        </button>
      </div>
    </form>
  );
}

/* ───────────────────── Sample row + inline edit ───────────────────── */

function SampleRow({
  sample,
  isEditing,
  limits,
  onStartEdit,
  onCancelEdit,
  onDeleted,
  onUpdated,
  router,
}: {
  sample: BrandVoiceSampleView;
  isEditing: boolean;
  limits: Limits;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onDeleted: () => void;
  onUpdated: (next: BrandVoiceSampleView) => void;
  router: RouterShape;
}) {
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState(sample.label);
  const [context, setContext] = useState(sample.context ?? "");
  const [body, setBody] = useState(sample.body);

  const bodyLen = body.length;
  const bodyValid = bodyLen >= limits.minBody && bodyLen <= limits.maxBody;
  const labelValid = label.trim().length > 0;
  const canSave = !pending && bodyValid && labelValid;

  const handleSave = () => {
    if (!canSave) return;
    startTransition(async () => {
      const res = await updateBrandVoiceSampleAction(sample.id, {
        label,
        body,
        context: context.trim() ? context : null,
      });
      if (res.success) {
        toast("Sample updated");
        onUpdated({
          ...sample,
          label: label.trim(),
          body,
          context: context.trim() ? context.trim() : null,
        });
        router.refresh();
      } else {
        toast(res.error);
      }
    });
  };

  const handleDelete = () => {
    if (!confirm("Delete this voice sample?")) return;
    startTransition(async () => {
      const res = await removeBrandVoiceSampleAction(sample.id);
      if (res.success) {
        toast("Sample deleted");
        onDeleted();
        router.refresh();
      } else {
        toast(res.error);
      }
    });
  };

  if (isEditing) {
    return (
      <li
        style={{
          padding: "1rem",
          border: "0.5px solid var(--olive)",
          background: "var(--olive-dim)",
          listStyle: "none",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <div>
            <label style={LABEL}>Label</label>
            <input
              style={INPUT}
              type="text"
              value={label}
              maxLength={80}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div>
            <label style={LABEL}>Context (optional)</label>
            <input
              style={INPUT}
              type="text"
              value={context}
              maxLength={160}
              onChange={(e) => setContext(e.target.value)}
            />
          </div>
          <div>
            <label style={LABEL}>Body</label>
            <textarea
              style={TEXTAREA}
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <p
              style={{
                fontSize: "0.7rem",
                color: bodyValid ? "var(--charcoal-muted)" : "var(--olive)",
                marginTop: "0.4rem",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>
                {bodyValid
                  ? `Aim for ${limits.minBody}–${limits.maxBody} characters.`
                  : `Need ${limits.minBody}–${limits.maxBody} characters.`}
              </span>
              <span>
                {bodyLen} / {limits.maxBody}
              </span>
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button onClick={handleSave} style={{ ...BTN_PRIMARY, opacity: canSave ? 1 : 0.55 }} disabled={!canSave}>
              {pending ? "Saving…" : "Save changes"}
            </button>
            <button onClick={onCancelEdit} style={BTN_GHOST} disabled={pending}>
              Cancel
            </button>
            <button
              onClick={handleDelete}
              style={{ ...BTN_GHOST, marginLeft: "auto", color: "var(--olive)" }}
              disabled={pending}
            >
              Delete
            </button>
          </div>
        </div>
      </li>
    );
  }

  const preview = sample.body.length > 80 ? `${sample.body.slice(0, 80).trimEnd()}…` : sample.body;

  return (
    <li
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: "0.75rem",
        padding: "0.85rem 1rem",
        border: "0.5px solid var(--border)",
        background: "var(--white)",
        listStyle: "none",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: "'Jost', sans-serif",
            fontWeight: 500,
            fontSize: "0.88rem",
            color: "var(--charcoal)",
            marginBottom: "0.2rem",
          }}
        >
          {sample.label}
        </div>
        <div
          style={{
            fontSize: "0.78rem",
            color: "var(--charcoal-muted)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {preview}
        </div>
        {sample.context && (
          <div
            style={{
              fontSize: "0.7rem",
              color: "var(--charcoal-muted)",
              marginTop: "0.3rem",
              fontStyle: "italic",
            }}
          >
            {sample.context}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: "0.4rem", alignItems: "flex-start" }}>
        <button onClick={onStartEdit} style={BTN_GHOST}>
          Edit
        </button>
        <button onClick={handleDelete} style={{ ...BTN_GHOST, color: "var(--olive)" }} disabled={pending}>
          Delete
        </button>
      </div>
    </li>
  );
}
