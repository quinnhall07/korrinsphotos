"use client";

// app/admin/clients/[id]/EditClientForm.tsx — Wave 11
// Edit affordance for the client detail page. Allow-list:
//   firstName, lastName, phone, recurringCadence, notes (internal).
// Persists via the `updateClientDetailsAction` server action.

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "@/components/ui/Toaster";
import { updateClientDetailsAction } from "../actions";

type Cadence = "ANNUAL" | "SEMI_ANNUAL" | "NONE";

export function EditClientForm({
  clientId,
  initial,
}: {
  clientId: string;
  initial: {
    firstName: string;
    lastName: string;
    phone: string;
    recurringCadence: Cadence;
    notes: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [phone, setPhone] = useState(initial.phone);
  const [recurringCadence, setRecurringCadence] = useState<Cadence>(initial.recurringCadence);
  const [notes, setNotes] = useState(initial.notes);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateClientDetailsAction(clientId, {
        firstName,
        lastName,
        phone: phone.trim() ? phone : null,
        recurringCadence,
        notes,
      });
      if (res.success) {
        toast("Client updated");
        setOpen(false);
        router.refresh();
      } else {
        toast(res.error ?? "Failed to update client");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          padding: "0.5rem 1rem",
          fontSize: "0.65rem",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--charcoal)",
          border: "0.5px solid var(--border-strong)",
          background: "transparent",
          cursor: "pointer",
          fontFamily: "'Jost', sans-serif",
        }}
      >
        Edit
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{
        marginTop: "1rem",
        padding: "1.25rem",
        border: "0.5px solid var(--border-strong)",
        background: "var(--white)",
        display: "grid",
        gap: "0.85rem",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <Field label="First name">
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label="Last name">
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            style={inputStyle}
          />
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <Field label="Phone">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 555-5555"
            style={inputStyle}
          />
        </Field>
        <Field label="Recurring cadence">
          <select
            value={recurringCadence}
            onChange={(e) => setRecurringCadence(e.target.value as Cadence)}
            style={inputStyle}
          >
            <option value="NONE">None</option>
            <option value="ANNUAL">Annual</option>
            <option value="SEMI_ANNUAL">Semi-annual</option>
          </select>
        </Field>
      </div>
      <Field label="Internal notes (admin-only)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
        />
      </Field>
      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          style={{
            padding: "0.55rem 1rem",
            fontSize: "0.65rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--charcoal-muted)",
            background: "transparent",
            border: "0.5px solid var(--border-strong)",
            cursor: pending ? "wait" : "pointer",
            fontFamily: "'Jost', sans-serif",
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          style={{
            padding: "0.55rem 1.25rem",
            fontSize: "0.65rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--white)",
            background: "var(--olive)",
            border: "0.5px solid var(--olive)",
            cursor: pending ? "wait" : "pointer",
            fontFamily: "'Jost', sans-serif",
          }}
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span
        style={{
          display: "block",
          fontSize: "0.6rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--charcoal-muted)",
          marginBottom: "0.3rem",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.55rem 0.75rem",
  fontSize: "0.85rem",
  fontFamily: "'Jost', sans-serif",
  border: "0.5px solid var(--border-strong)",
  background: "var(--white)",
  color: "var(--charcoal)",
  outline: "none",
  boxSizing: "border-box",
};
