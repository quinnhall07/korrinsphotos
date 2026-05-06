// app/admin/events/[id]/ShootDateEditor.tsx
// Inline date editor for shoot date(s) on event detail page.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateShootDates } from "./actions";
import { toast } from "@/components/ui/Toaster";

interface ShootDateEditorProps {
  eventId: string;
  initialShootDate: string;
  initialShootEndDate: string;
}

export function ShootDateEditor({ eventId, initialShootDate, initialShootEndDate }: ShootDateEditorProps) {
  const [shootDate, setShootDate] = useState(initialShootDate);
  const [shootEndDate, setShootEndDate] = useState(initialShootEndDate);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function handleSave() {
    startTransition(async () => {
      await updateShootDates(eventId, shootDate || null, shootEndDate || null);
      toast("Shoot date updated ✓");
      router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.4rem", flexWrap: "wrap" }}>
      <label style={labelStyle}>Shoot date</label>
      <input
        type="date"
        value={shootDate}
        onChange={(e) => setShootDate(e.target.value)}
        style={dateInputStyle}
      />
      <label style={labelStyle}>to</label>
      <input
        type="date"
        value={shootEndDate}
        onChange={(e) => setShootEndDate(e.target.value)}
        style={dateInputStyle}
        placeholder="End date (optional)"
      />
      <button
        onClick={handleSave}
        style={{
          padding: "0.4rem 0.8rem",
          fontSize: "0.62rem",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          background: "var(--charcoal)",
          color: "var(--white)",
          border: "none",
          cursor: "pointer",
          fontFamily: "'Jost', sans-serif",
        }}
      >
        Save
      </button>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: "0.68rem",
  color: "var(--charcoal-muted)",
  fontFamily: "'Jost', sans-serif",
};

const dateInputStyle: React.CSSProperties = {
  border: "0.5px solid var(--border-strong)",
  background: "transparent",
  padding: "0.4rem 0.6rem",
  fontFamily: "'Jost', sans-serif",
  fontSize: "0.78rem",
  color: "var(--charcoal)",
  outline: "none",
};
