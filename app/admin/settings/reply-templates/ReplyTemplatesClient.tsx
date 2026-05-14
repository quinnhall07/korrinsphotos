"use client";

// app/admin/settings/reply-templates/ReplyTemplatesClient.tsx
// Wave 12 — Editorial CRUD for the admin's saved reply templates. All
// persistence runs through the server actions in `./actions.ts`.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toaster";
import {
  addReplyTemplateAction,
  removeReplyTemplateAction,
  updateReplyTemplateAction,
} from "./actions";

export interface ReplyTemplateView {
  id: string;
  label: string;
  body: string;
  createdAtIso: string;
}

interface Limits {
  maxLabel: number;
  maxBody: number;
  softCap: number;
}

interface Props {
  initial: ReplyTemplateView[];
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

interface RouterShape {
  refresh: () => void;
}

export function ReplyTemplatesClient({ initial, limits }: Props) {
  const router = useRouter();
  const [templates, setTemplates] = useState<ReplyTemplateView[]>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);

  const overSoftCap = templates.length >= limits.softCap;

  const handleDeleted = (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const handleUpdated = (next: ReplyTemplateView) => {
    setTemplates((prev) => prev.map((t) => (t.id === next.id ? next : t)));
    setEditingId(null);
  };

  const handleAdded = (next: ReplyTemplateView) => {
    setTemplates((prev) => [...prev, next]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Existing templates */}
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
          Saved templates ({templates.length})
        </p>

        {templates.length === 0 ? (
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--charcoal-muted)",
              padding: "1.5rem",
              border: "0.5px dashed var(--border-strong)",
              background: "rgba(42,42,40,0.02)",
            }}
          >
            No templates yet. Add your first one below.
          </p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            {templates.map((t) => (
              <TemplateRow
                key={t.id}
                template={t}
                isEditing={editingId === t.id}
                limits={limits}
                onStartEdit={() => setEditingId(t.id)}
                onCancelEdit={() => setEditingId(null)}
                onDeleted={() => handleDeleted(t.id)}
                onUpdated={handleUpdated}
                router={router}
              />
            ))}
          </ul>
        )}

        {overSoftCap && (
          <p
            style={{
              marginTop: "0.75rem",
              fontSize: "0.78rem",
              color: "var(--charcoal-muted)",
              padding: "0.65rem 0.85rem",
              border: "0.5px solid var(--border)",
              background: "var(--olive-dim)",
            }}
          >
            You&apos;re past the recommended {limits.softCap}-template cap.
            Pruning unused entries keeps the quick-insert dropdown easy to
            scan.
          </p>
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
          Add a template
        </p>
        <AddForm limits={limits} onAdded={handleAdded} router={router} />
      </section>
    </div>
  );
}

/* ───────────────────── Add form ───────────────────── */

function AddForm({
  limits,
  onAdded,
  router,
}: {
  limits: Limits;
  onAdded: (t: ReplyTemplateView) => void;
  router: RouterShape;
}) {
  const [label, setLabel] = useState("");
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  const bodyLen = body.length;
  const bodyTooLong = bodyLen > limits.maxBody;
  const canSubmit =
    !pending &&
    label.trim().length > 0 &&
    bodyLen > 0 &&
    bodyLen <= limits.maxBody;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    startTransition(async () => {
      const res = await addReplyTemplateAction({ label, body });
      if (res.success) {
        toast("Template saved");
        onAdded({
          id: res.data.id,
          label: res.data.label,
          body: res.data.body,
          createdAtIso: new Date().toISOString(),
        });
        setLabel("");
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
          maxLength={limits.maxLabel}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Wedding inquiry — quick reply"
        />
      </div>

      <div>
        <label style={LABEL}>Body</label>
        <textarea
          style={TEXTAREA}
          rows={8}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Paste the reply text. Inserts straight into the message composer when picked."
        />
        <p
          style={{
            fontSize: "0.7rem",
            color: bodyTooLong ? "var(--olive)" : "var(--charcoal-muted)",
            marginTop: "0.4rem",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>
            {bodyTooLong
              ? `Trim to ${limits.maxBody} characters or fewer.`
              : "Up to " + limits.maxBody + " characters."}
          </span>
          <span>
            {bodyLen} / {limits.maxBody}
          </span>
        </p>
      </div>

      <div>
        <button
          type="submit"
          style={{ ...BTN_PRIMARY, opacity: canSubmit ? 1 : 0.55 }}
          disabled={!canSubmit}
        >
          {pending ? "Saving…" : "Add template"}
        </button>
      </div>
    </form>
  );
}

/* ───────────────────── Row + inline edit ───────────────────── */

function TemplateRow({
  template,
  isEditing,
  limits,
  onStartEdit,
  onCancelEdit,
  onDeleted,
  onUpdated,
  router,
}: {
  template: ReplyTemplateView;
  isEditing: boolean;
  limits: Limits;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onDeleted: () => void;
  onUpdated: (next: ReplyTemplateView) => void;
  router: RouterShape;
}) {
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState(template.label);
  const [body, setBody] = useState(template.body);

  const bodyLen = body.length;
  const bodyValid = bodyLen > 0 && bodyLen <= limits.maxBody;
  const labelValid = label.trim().length > 0;
  const canSave = !pending && bodyValid && labelValid;

  const handleSave = () => {
    if (!canSave) return;
    startTransition(async () => {
      const res = await updateReplyTemplateAction(template.id, {
        label,
        body,
      });
      if (res.success) {
        toast("Template updated");
        onUpdated({
          ...template,
          label: label.trim(),
          body,
        });
        router.refresh();
      } else {
        toast(res.error);
      }
    });
  };

  const handleDelete = () => {
    if (!confirm("Delete this reply template?")) return;
    startTransition(async () => {
      const res = await removeReplyTemplateAction(template.id);
      if (res.success) {
        toast("Template deleted");
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
              maxLength={limits.maxLabel}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div>
            <label style={LABEL}>Body</label>
            <textarea
              style={TEXTAREA}
              rows={8}
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
                  ? `Up to ${limits.maxBody} characters.`
                  : `Body must be 1–${limits.maxBody} characters.`}
              </span>
              <span>
                {bodyLen} / {limits.maxBody}
              </span>
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              onClick={handleSave}
              style={{ ...BTN_PRIMARY, opacity: canSave ? 1 : 0.55 }}
              disabled={!canSave}
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
            <button onClick={onCancelEdit} style={BTN_GHOST} disabled={pending}>
              Cancel
            </button>
            <button
              onClick={handleDelete}
              style={{
                ...BTN_GHOST,
                marginLeft: "auto",
                color: "var(--olive)",
              }}
              disabled={pending}
            >
              Delete
            </button>
          </div>
        </div>
      </li>
    );
  }

  const preview =
    template.body.length > 80
      ? `${template.body.slice(0, 80).trimEnd()}…`
      : template.body;

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
          {template.label}
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
      </div>
      <div style={{ display: "flex", gap: "0.4rem", alignItems: "flex-start" }}>
        <button onClick={onStartEdit} style={BTN_GHOST}>
          Edit
        </button>
        <button
          onClick={handleDelete}
          style={{ ...BTN_GHOST, color: "var(--olive)" }}
          disabled={pending}
        >
          Delete
        </button>
      </div>
    </li>
  );
}
