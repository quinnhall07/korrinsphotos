"use client";

// app/admin/settings/studio-hours/StudioHoursForm.tsx
// Client component for the Studio Hours editor. Pure controlled form
// driven by FormData — server action consumes the FormData snapshot.

import { useState, useTransition } from "react";
import { toast } from "@/components/ui/Toaster";
import { updateStudioHoursAction } from "./actions";
import type { StudioHours, DaySchedule } from "@/lib/db/admin-settings";

const TIMEZONES: { value: string; label: string }[] = [
  { value: "America/New_York",    label: "Eastern (New York)" },
  { value: "America/Chicago",     label: "Central (Chicago)" },
  { value: "America/Denver",      label: "Mountain (Denver)" },
  { value: "America/Phoenix",     label: "Arizona (no DST)" },
  { value: "America/Los_Angeles", label: "Pacific (Los Angeles)" },
  { value: "America/Anchorage",   label: "Alaska (Anchorage)" },
  { value: "Pacific/Honolulu",    label: "Hawaii (Honolulu)" },
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

interface Props {
  hours: StudioHours;
  previewLabel: string;
}

export function StudioHoursForm({ hours, previewLabel }: Props) {
  const [isPending, startTransition] = useTransition();
  const [schedule, setSchedule] = useState<DaySchedule[]>(hours.weeklySchedule);

  function setDay(dayOfWeek: number, patch: Partial<DaySchedule>) {
    setSchedule((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d))
    );
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateStudioHoursAction(formData);
      if (result.success) {
        toast("Studio hours saved");
      } else {
        toast(result.error || "Failed to save studio hours");
      }
    });
  }

  const holidayInitial = (hours.holidayDates ?? []).join("\n");

  return (
    <form action={handleSubmit}>
      {/* Preview */}
      <div
        style={{
          marginBottom: "1.5rem",
          padding: "0.75rem 1rem",
          border: "0.5px solid var(--border-strong)",
          background: "var(--olive-dim)",
          fontSize: "0.82rem",
          color: "var(--charcoal)",
          lineHeight: 1.5,
        }}
      >
        <span
          style={{
            fontSize: "0.6rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--olive)",
            marginRight: "0.5rem",
          }}
        >
          Preview
        </span>
        {previewLabel}
      </div>

      {/* Timezone */}
      <Section title="Timezone">
        <select
          name="timezone"
          defaultValue={hours.timezone}
          style={selectStyle}
        >
          {TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
      </Section>

      {/* Weekly schedule */}
      <Section title="Weekly schedule">
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {schedule.map((day) => {
            const closed = day.open === null || day.close === null;
            return (
              <li
                key={day.dayOfWeek}
                style={{
                  display: "grid",
                  gridTemplateColumns: "60px 1fr 1fr 100px",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.55rem 0",
                  borderBottom: "0.5px solid var(--border)",
                }}
              >
                <span
                  style={{
                    fontSize: "0.74rem",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--charcoal-muted)",
                  }}
                >
                  {DAY_LABELS[day.dayOfWeek]}
                </span>
                <input
                  type="time"
                  name={`open_${day.dayOfWeek}`}
                  defaultValue={day.open ?? "09:00"}
                  disabled={closed}
                  style={{
                    ...inputStyle,
                    opacity: closed ? 0.4 : 1,
                  }}
                />
                <input
                  type="time"
                  name={`close_${day.dayOfWeek}`}
                  defaultValue={day.close ?? "17:00"}
                  disabled={closed}
                  style={{
                    ...inputStyle,
                    opacity: closed ? 0.4 : 1,
                  }}
                />
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    fontSize: "0.72rem",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "var(--charcoal-muted)",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <input
                    type="checkbox"
                    name={`closed_${day.dayOfWeek}`}
                    checked={closed}
                    onChange={(e) =>
                      setDay(day.dayOfWeek, {
                        open: e.target.checked ? null : "09:00",
                        close: e.target.checked ? null : "17:00",
                      })
                    }
                    style={{
                      width: 14,
                      height: 14,
                      accentColor: "var(--olive)",
                      cursor: "pointer",
                    }}
                  />
                  Closed
                </label>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* Holidays */}
      <Section title="Holidays" hint="One date per line, format YYYY-MM-DD.">
        <textarea
          name="holidayDates"
          defaultValue={holidayInitial}
          rows={4}
          placeholder="2025-12-25&#10;2025-12-31"
          style={{
            ...inputStyle,
            fontFamily: "'Jost', monospace",
            resize: "vertical",
            minHeight: "5rem",
          }}
        />
      </Section>

      {/* Vacation */}
      <Section
        title="Vacation"
        hint="Both dates required to activate. Leave blank for none."
      >
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            <span style={fieldLabel}>Start</span>
            <input
              type="date"
              name="vacationStart"
              defaultValue={hours.vacationStart ?? ""}
              style={inputStyle}
            />
          </label>
          <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            <span style={fieldLabel}>End</span>
            <input
              type="date"
              name="vacationEnd"
              defaultValue={hours.vacationEnd ?? ""}
              style={inputStyle}
            />
          </label>
        </div>
      </Section>

      {/* Off-hours message */}
      <Section
        title="Off-hours email message"
        hint="Use {nextOpenLabel} as a placeholder for the next open time. Leave blank for default copy."
      >
        <textarea
          name="offHoursMessage"
          defaultValue={hours.offHoursMessage ?? ""}
          rows={3}
          placeholder="Thanks for reaching out — Korrin is outside studio hours right now. You'll hear back by {nextOpenLabel}."
          style={{
            ...inputStyle,
            resize: "vertical",
            minHeight: "4.5rem",
          }}
        />
      </Section>

      <div
        style={{
          marginTop: "2rem",
          display: "flex",
          justifyContent: "flex-end",
          gap: "0.75rem",
          alignItems: "center",
        }}
      >
        {isPending ? (
          <span
            style={{
              fontSize: "0.72rem",
              letterSpacing: "0.1em",
              color: "var(--charcoal-muted)",
            }}
          >
            Saving…
          </span>
        ) : null}
        <button
          type="submit"
          disabled={isPending}
          style={{
            background: "var(--olive)",
            color: "var(--white)",
            border: "0.5px solid var(--olive)",
            padding: "0.7rem 1.6rem",
            fontSize: "0.72rem",
            fontFamily: "'Jost', sans-serif",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            cursor: isPending ? "wait" : "pointer",
            transition: "var(--transition)",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          Save settings
        </button>
      </div>
    </form>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        marginBottom: "1.75rem",
        paddingBottom: "1.25rem",
        borderBottom: "0.5px solid var(--border)",
      }}
    >
      <h2
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontWeight: 400,
          fontSize: "1.25rem",
          color: "var(--charcoal)",
          marginBottom: hint ? "0.25rem" : "0.75rem",
        }}
      >
        {title}
      </h2>
      {hint ? (
        <p
          style={{
            fontSize: "0.72rem",
            color: "var(--charcoal-muted)",
            marginBottom: "0.75rem",
            lineHeight: 1.5,
          }}
        >
          {hint}
        </p>
      ) : null}
      {children}
    </div>
  );
}

const fieldLabel: React.CSSProperties = {
  fontSize: "0.62rem",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--charcoal-muted)",
};

const inputStyle: React.CSSProperties = {
  border: "0.5px solid var(--border-strong)",
  background: "var(--white)",
  padding: "0.55rem 0.6rem",
  fontFamily: "'Jost', sans-serif",
  fontSize: "0.85rem",
  color: "var(--charcoal)",
  outline: "none",
  width: "100%",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
  maxWidth: 320,
};
