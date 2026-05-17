"use client";

// app/admin/settings/insurer/InsurerForm.tsx
// Phase 3.9 — Single-form editor for the per-admin insurer contact. Values
// hydrate from the user doc; on submit we hand off to `updateInsurerContactAction`.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toaster";
import {
  updateInsurerContactAction,
  type InsurerContactInput,
} from "./actions";

interface Props {
  initial: InsurerContactInput;
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
  minHeight: "120px",
  fontFamily: "'Jost', sans-serif",
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

export function InsurerForm({ initial }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(initial.name ?? "");
  const [email, setEmail] = useState(initial.email ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [defaultText, setDefaultText] = useState(
    initial.defaultAdditionalInsuredText ?? ""
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateInsurerContactAction({
        name,
        email,
        phone,
        defaultAdditionalInsuredText: defaultText,
      });
      if (res.success) {
        toast("Insurer contact saved");
        router.refresh();
      } else {
        toast(res.error);
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: "1.25rem", maxWidth: 640 }}
    >
      <div>
        <label style={LABEL}>Insurer / Agency name</label>
        <input
          style={INPUT}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Hill & Usher (PhotoCare)"
        />
      </div>

      <div>
        <label style={LABEL}>Insurer email</label>
        <input
          style={INPUT}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="certs@insurer.com"
        />
        <p style={{ fontSize: "0.75rem", color: "var(--charcoal-muted)", marginTop: "0.4rem" }}>
          This is the destination for the &ldquo;Request COI&rdquo; email on each project.
        </p>
      </div>

      <div>
        <label style={LABEL}>Insurer phone</label>
        <input
          style={INPUT}
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(555) 555-5555"
        />
      </div>

      <div>
        <label style={LABEL}>Default additional-insured language</label>
        <textarea
          style={TEXTAREA}
          value={defaultText}
          onChange={(e) => setDefaultText(e.target.value)}
          placeholder="e.g. {VENUE_NAME}, its officers, employees, and agents are named as additional insured for the date of the event."
        />
        <p style={{ fontSize: "0.75rem", color: "var(--charcoal-muted)", marginTop: "0.4rem" }}>
          Used as the default for each project&apos;s COI request. You can override per-project.
        </p>
      </div>

      <div>
        <button type="submit" style={BTN_PRIMARY} disabled={isPending}>
          {isPending ? "Saving…" : "Save insurer contact"}
        </button>
      </div>
    </form>
  );
}
