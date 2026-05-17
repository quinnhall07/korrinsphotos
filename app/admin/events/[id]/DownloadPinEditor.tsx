"use client";

// app/admin/events/[id]/DownloadPinEditor.tsx
// Phase 2.6 — Admin control for the per-event download PIN.
//
// When a PIN is set on an event, both `/api/download/[eventId]/zip` and
// `/api/download/[eventId]/favorites` require the client to pass `?pin=...`.
// Korrin uses this to gate the full-resolution zip behind a number she shares
// out-of-band (text/iMessage), preventing forwarded magic links from leaking
// the whole gallery as a download.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toaster";
import { setEventDownloadPin } from "./actions";

interface DownloadPinEditorProps {
  eventId: string;
  initialPin: string | null;
}

export function DownloadPinEditor({ eventId, initialPin }: DownloadPinEditorProps) {
  const router = useRouter();
  const [pin, setPin] = useState(initialPin ?? "");
  const [pending, startTransition] = useTransition();
  const hasPin = Boolean(initialPin);

  function handleSave() {
    const trimmed = pin.trim();
    if (!/^\d{4,6}$/.test(trimmed)) {
      toast("PIN must be 4–6 digits.");
      return;
    }
    startTransition(async () => {
      const res = await setEventDownloadPin(eventId, trimmed);
      if (!res.success) {
        toast(res.error ?? "Failed to save PIN.");
        return;
      }
      toast("Download PIN saved.");
      router.refresh();
    });
  }

  function handleClear() {
    startTransition(async () => {
      const res = await setEventDownloadPin(eventId, null);
      if (!res.success) {
        toast(res.error ?? "Failed to clear PIN.");
        return;
      }
      setPin("");
      toast("Download PIN cleared.");
      router.refresh();
    });
  }

  return (
    <div
      style={{
        border: "0.5px solid var(--border)",
        background: "var(--white)",
        marginBottom: "2rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1.2rem 1.5rem",
          borderBottom: "0.5px solid var(--border)",
        }}
      >
        <span
          style={{
            fontSize: "0.72rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--charcoal)",
            fontWeight: 500,
          }}
        >
          Download PIN
        </span>
        <span style={{ fontSize: "0.72rem", color: "var(--charcoal-muted)" }}>
          {hasPin ? "Active" : "No PIN required"}
        </span>
      </div>
      <div
        style={{
          padding: "1.5rem",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <input
          type="text"
          inputMode="numeric"
          pattern="\d{4,6}"
          maxLength={6}
          placeholder="4–6 digits"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          disabled={pending}
          style={{
            fontFamily: "'Jost', sans-serif",
            fontSize: "0.95rem",
            letterSpacing: "0.3em",
            padding: "0.55rem 0.75rem",
            border: "0.5px solid var(--border-strong)",
            background: "var(--white)",
            outline: "none",
            width: "10rem",
            textAlign: "center",
          }}
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={pending || pin.length < 4}
          style={{
            padding: "0.55rem 1.2rem",
            fontSize: "0.68rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            background:
              pending || pin.length < 4 ? "var(--charcoal-muted)" : "var(--olive)",
            color: "var(--white)",
            border: "none",
            cursor: pending || pin.length < 4 ? "not-allowed" : "pointer",
            fontFamily: "'Jost', sans-serif",
          }}
        >
          {hasPin ? "Update PIN" : "Set PIN"}
        </button>
        {hasPin && (
          <button
            type="button"
            onClick={handleClear}
            disabled={pending}
            style={{
              padding: "0.55rem 1.2rem",
              fontSize: "0.68rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              background: "transparent",
              color: "var(--charcoal)",
              border: "0.5px solid var(--border-strong)",
              cursor: pending ? "wait" : "pointer",
              fontFamily: "'Jost', sans-serif",
            }}
          >
            Clear PIN
          </button>
        )}
        <p
          style={{
            fontSize: "0.78rem",
            color: "var(--charcoal-muted)",
            margin: 0,
            flexBasis: "100%",
            marginTop: "0.5rem",
            lineHeight: 1.5,
          }}
        >
          When a PIN is active, clients must enter it before downloading the gallery zip.
          Share the PIN out-of-band (text/iMessage) so a forwarded magic link can&apos;t be used to mass-export images.
        </p>
      </div>
    </div>
  );
}
