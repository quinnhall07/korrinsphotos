"use client";

// app/admin/sequences/SequenceBuilder.tsx
// Shared builder UI used by /admin/sequences/new and /admin/sequences/[id].
// Server-only modules are NEVER imported here — types are re-declared
// locally per the client/server boundary rules.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toaster";
import {
  createSequenceAction,
  updateSequenceAction,
  type SequenceFormInput,
} from "./actions";

// ─── Local re-declared types ─────────────────────────────────────────────────

const PROJECT_STATUSES = [
  "SITE_VISIT",
  "INQUIRY",
  "QUALIFYING",
  "PROPOSAL_SENT",
  "NEGOTIATING",
  "CONTRACT_SENT",
  "DEPOSIT_PENDING",
  "BOOKED",
  "SHOOT_READY",
  "IN_EDITING",
  "GALLERY_DELIVERED",
  "REFERRAL_SENT",
  "COMPLETED",
  "LOST",
  "ARCHIVED",
] as const;
type ProjectStatusLiteral = (typeof PROJECT_STATUSES)[number];

const TRIGGERS = [
  "MANUAL",
  "STATUS_CHANGE",
  "DATE_RELATIVE_TO_SHOOT",
  "BOOKING_CREATED",
  "GALLERY_DELIVERED",
] as const;
type TriggerLiteral = (typeof TRIGGERS)[number];

const CHANNELS = ["EMAIL", "SMS"] as const;
type ChannelLiteral = (typeof CHANNELS)[number];

const DATE_ANCHORS = ["shootDate", "deliveredAt"] as const;
type DateAnchorLiteral = (typeof DATE_ANCHORS)[number];

export interface SerializedSequenceDetail {
  id: string;
  name: string;
  description: string | null;
  trigger: TriggerLiteral;
  triggerStatus: ProjectStatusLiteral | null;
  dateAnchor: DateAnchorLiteral | null;
  active: boolean;
  steps: Array<{
    delayHours: number;
    channel: ChannelLiteral;
    templateId: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  /** Pass `null` for the "new" route. Pass a serialised doc for the detail route. */
  sequence: SerializedSequenceDetail | null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SequenceBuilder({ sequence }: Props) {
  const router = useRouter();
  const [isSaving, startSave] = useTransition();

  const [name, setName] = useState(sequence?.name ?? "");
  const [description, setDescription] = useState(sequence?.description ?? "");
  const [trigger, setTrigger] = useState<TriggerLiteral>(
    sequence?.trigger ?? "MANUAL"
  );
  const [triggerStatus, setTriggerStatus] = useState<ProjectStatusLiteral>(
    sequence?.triggerStatus ?? "INQUIRY"
  );
  const [dateAnchor, setDateAnchor] = useState<DateAnchorLiteral>(
    sequence?.dateAnchor ?? "shootDate"
  );
  const [active, setActive] = useState<boolean>(sequence?.active ?? true);
  const [steps, setSteps] = useState<
    Array<{ delayHours: number; channel: ChannelLiteral; templateId: string }>
  >(
    sequence?.steps?.length
      ? sequence.steps.map((s) => ({
          delayHours: s.delayHours,
          channel: s.channel,
          templateId: s.templateId,
        }))
      : [{ delayHours: 0, channel: "EMAIL", templateId: "" }]
  );

  function compile(): SequenceFormInput {
    return {
      name,
      description: description.trim() || undefined,
      trigger,
      triggerStatus: trigger === "STATUS_CHANGE" ? triggerStatus : null,
      dateAnchor: trigger === "DATE_RELATIVE_TO_SHOOT" ? dateAnchor : null,
      active,
      steps: steps.map((s) => ({
        delayHours: Number.isFinite(s.delayHours) ? s.delayHours : 0,
        channel: s.channel,
        templateId: s.templateId.trim(),
      })),
    };
  }

  function handleSave() {
    if (!name.trim()) {
      toast("Name is required");
      return;
    }
    if (steps.length === 0) {
      toast("At least one step is required");
      return;
    }
    for (const [i, s] of steps.entries()) {
      if (!s.templateId.trim()) {
        toast(`Step ${i + 1} needs a template ID`);
        return;
      }
    }

    const input = compile();

    startSave(async () => {
      if (sequence) {
        const result = await updateSequenceAction(sequence.id, input);
        if (result.success) {
          toast("Sequence saved");
          router.refresh();
        } else {
          toast(result.error);
        }
      } else {
        // createSequenceAction redirects on success — catch the NEXT_REDIRECT
        // signal so we don't surface it as a real error.
        try {
          await createSequenceAction(input);
        } catch (err) {
          if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) {
            return;
          }
          console.error(err);
          toast("Failed to create sequence");
        }
      }
    });
  }

  // ─── Step helpers ──────────────────────────────────────────────────────────

  function addStep() {
    setSteps((prev) => [
      ...prev,
      { delayHours: 24, channel: "EMAIL", templateId: "" },
    ]);
  }
  function removeStep(i: number) {
    setSteps((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateStep(
    i: number,
    patch: Partial<{
      delayHours: number;
      channel: ChannelLiteral;
      templateId: string;
    }>
  ) {
    setSteps((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s))
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "1.5rem",
          marginBottom: "2rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: "16rem" }}>
          <p style={eyebrow}>Sequence Engine</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={titleInput}
            placeholder="Sequence name"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{
              ...inputStyle,
              fontSize: "0.85rem",
              border: "none",
              borderBottom: "0.5px solid var(--border)",
              padding: "0.4rem 0",
              marginTop: "0.4rem",
              color: "var(--charcoal-muted)",
            }}
            placeholder="Short description (optional)"
          />
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            border: "0.5px solid var(--border-strong)",
            padding: "0.9rem 1.2rem",
            background: "var(--white)",
            fontSize: "0.78rem",
            color: "var(--charcoal)",
            cursor: "pointer",
            letterSpacing: "0.04em",
          }}
        >
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            style={{ accentColor: "var(--olive)", cursor: "pointer" }}
          />
          {active ? "Active" : "Inactive"}
        </label>
      </div>

      {/* Trigger config */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(20rem, 1fr))",
          gap: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        <Section title="Trigger">
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
            {TRIGGERS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTrigger(t)}
                style={trigger === t ? chipActive : chipBase}
              >
                {t}
              </button>
            ))}
          </div>
          <p style={hintText}>
            {trigger === "MANUAL" &&
              "Enroll clients individually from a project view."}
            {trigger === "STATUS_CHANGE" &&
              "Auto-enroll when a project's status advances into the chosen state."}
            {trigger === "DATE_RELATIVE_TO_SHOOT" &&
              "Schedules steps relative to a date field (e.g. shootDate)."}
            {trigger === "BOOKING_CREATED" &&
              "Fires on new booking inquiry. Reserved for future wiring."}
            {trigger === "GALLERY_DELIVERED" &&
              "Fires when a gallery is delivered. Reserved for future wiring."}
          </p>
        </Section>

        {trigger === "STATUS_CHANGE" && (
          <Section title="Trigger status">
            <select
              value={triggerStatus}
              onChange={(e) =>
                setTriggerStatus(e.target.value as ProjectStatusLiteral)
              }
              style={inputStyle}
            >
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <p style={hintText}>
              Enrolls when a project transitions into this status.
            </p>
          </Section>
        )}

        {trigger === "DATE_RELATIVE_TO_SHOOT" && (
          <Section title="Date anchor">
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              {DATE_ANCHORS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setDateAnchor(a)}
                  style={dateAnchor === a ? chipActive : chipBase}
                >
                  {a}
                </button>
              ))}
            </div>
            <p style={hintText}>
              Step `delayHours` is interpreted as an offset from this field
              (negative = before, positive = after).
            </p>
          </Section>
        )}
      </div>

      {/* Steps */}
      <div
        style={{
          border: "0.5px solid var(--border)",
          background: "var(--white)",
          padding: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.25rem",
          }}
        >
          <p style={eyebrow}>Steps</p>
          <button type="button" onClick={addStep} style={btnOutlineSm}>
            + Add step
          </button>
        </div>

        {steps.length === 0 ? (
          <p style={{ ...hintText, marginTop: 0 }}>
            No steps yet. Add one to start defining the cadence.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
            {steps.map((s, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "3rem 7rem 6rem 1fr 2rem",
                  gap: "0.6rem",
                  alignItems: "center",
                  border: "0.5px solid var(--border)",
                  padding: "0.7rem 0.9rem",
                }}
              >
                <span
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: "1.4rem",
                    color: "var(--olive)",
                    textAlign: "center",
                  }}
                >
                  {i + 1}
                </span>

                <div>
                  <p style={miniLabel}>Delay (hrs)</p>
                  <input
                    type="number"
                    value={s.delayHours}
                    onChange={(e) =>
                      updateStep(i, { delayHours: Number(e.target.value) })
                    }
                    style={inputStyle}
                  />
                </div>

                <div>
                  <p style={miniLabel}>Channel</p>
                  <select
                    value={s.channel}
                    onChange={(e) =>
                      updateStep(i, {
                        channel: e.target.value as ChannelLiteral,
                      })
                    }
                    style={inputStyle}
                  >
                    {CHANNELS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <p style={miniLabel}>Template ID</p>
                  <input
                    value={s.templateId}
                    onChange={(e) =>
                      updateStep(i, { templateId: e.target.value })
                    }
                    placeholder="e.g. cold-lead-1"
                    style={inputStyle}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => removeStep(i)}
                  style={{
                    ...btnGhostSm,
                    color: "#991B1B",
                  }}
                  title="Remove step"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "0.75rem",
          marginTop: "2rem",
          paddingTop: "1.25rem",
          borderTop: "0.5px solid var(--border)",
        }}
      >
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          style={btnOlive}
        >
          {isSaving
            ? sequence
              ? "Saving…"
              : "Creating…"
            : sequence
              ? "Save sequence"
              : "Create sequence"}
        </button>
      </div>
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: "0.5px solid var(--border)",
        background: "var(--white)",
        padding: "1.2rem",
      }}
    >
      <p style={{ ...eyebrow, marginBottom: "0.8rem" }}>{title}</p>
      {children}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const eyebrow: React.CSSProperties = {
  fontSize: "0.65rem",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "var(--olive)",
  marginBottom: "0.3rem",
};

const titleInput: React.CSSProperties = {
  display: "block",
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: "2rem",
  fontWeight: 300,
  border: "none",
  background: "transparent",
  outline: "none",
  width: "100%",
  padding: "0.1rem 0",
  color: "var(--charcoal)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.6rem 0.8rem",
  fontSize: "0.82rem",
  border: "0.5px solid var(--border)",
  background: "var(--white)",
  color: "var(--charcoal)",
  fontFamily: "'Jost', sans-serif",
  outline: "none",
};

const hintText: React.CSSProperties = {
  fontSize: "0.7rem",
  color: "var(--charcoal-muted)",
  marginTop: "0.6rem",
  letterSpacing: "0.04em",
  lineHeight: 1.5,
};

const miniLabel: React.CSSProperties = {
  fontSize: "0.58rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--charcoal-muted)",
  marginBottom: "0.25rem",
};

const chipBase: React.CSSProperties = {
  padding: "0.45rem 0.75rem",
  fontSize: "0.7rem",
  letterSpacing: "0.06em",
  background: "var(--white)",
  color: "var(--charcoal)",
  border: "0.5px solid var(--border-strong)",
  cursor: "pointer",
  fontFamily: "'Jost', sans-serif",
};

const chipActive: React.CSSProperties = {
  ...chipBase,
  background: "var(--olive)",
  color: "var(--white)",
  borderColor: "var(--olive)",
};

const btnOlive: React.CSSProperties = {
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

const btnOutlineSm: React.CSSProperties = {
  padding: "0.5rem 1rem",
  fontSize: "0.66rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  background: "none",
  color: "var(--charcoal)",
  border: "0.5px solid var(--border-strong)",
  cursor: "pointer",
  fontFamily: "'Jost', sans-serif",
};

const btnGhostSm: React.CSSProperties = {
  padding: "0.4rem 0.7rem",
  fontSize: "1rem",
  background: "none",
  border: "0.5px solid var(--border)",
  cursor: "pointer",
  fontFamily: "'Jost', sans-serif",
  lineHeight: 1,
};
