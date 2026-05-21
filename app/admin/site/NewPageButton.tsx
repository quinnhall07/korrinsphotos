"use client";

// app/admin/site/NewPageButton.tsx
// "+ New page" affordance on the site editor index. Opens a tiny inline
// form (slug + label), calls createCustomPageAction, redirects to the
// editor for the new page on success.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toaster";
import { createCustomPageAction } from "./actions";

export function NewPageButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [label, setLabel] = useState("");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setSlug("");
    setLabel("");
    setOpen(false);
  }

  function submit() {
    const trimmedSlug = slug.trim().toLowerCase();
    if (!trimmedSlug) {
      toast("Slug is required.");
      return;
    }
    startTransition(async () => {
      const res = await createCustomPageAction(trimmedSlug, label.trim() || trimmedSlug);
      if (!res.success) {
        toast(res.error ?? "Couldn't create the page.");
        return;
      }
      toast(`Created /${res.slug}.`);
      reset();
      router.refresh();
      router.push(`/admin/site/${res.slug}`);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: "inline-block",
          padding: "0.6rem 1.2rem",
          fontSize: "0.7rem",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          background: "var(--olive)",
          color: "var(--white)",
          border: "none",
          cursor: "pointer",
          fontFamily: "'Jost', sans-serif",
        }}
      >
        + New page
      </button>
    );
  }

  return (
    <div
      style={{
        border: "0.5px solid var(--border-strong)",
        padding: "1rem",
        background: "var(--white)",
        display: "flex",
        flexDirection: "column",
        gap: "0.6rem",
        minWidth: "320px",
      }}
    >
      <label style={{ display: "block" }}>
        <span style={labelStyle}>Slug (will be /{slug || "your-slug"})</span>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
          placeholder="services"
          style={inputStyle}
          disabled={isPending}
        />
      </label>
      <label style={{ display: "block" }}>
        <span style={labelStyle}>Page title</span>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Services"
          style={inputStyle}
          disabled={isPending}
        />
      </label>
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.3rem" }}>
        <button
          type="button"
          onClick={submit}
          disabled={isPending || !slug.trim()}
          style={{
            padding: "0.5rem 1rem",
            fontSize: "0.72rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            background: "var(--olive)",
            color: "var(--white)",
            border: "none",
            cursor: isPending ? "wait" : "pointer",
            fontFamily: "'Jost', sans-serif",
            flex: 1,
          }}
        >
          {isPending ? "Creating…" : "Create"}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={isPending}
          style={{
            padding: "0.5rem 1rem",
            fontSize: "0.72rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            background: "transparent",
            color: "var(--charcoal-light)",
            border: "0.5px solid var(--border)",
            cursor: "pointer",
            fontFamily: "'Jost', sans-serif",
          }}
        >
          Cancel
        </button>
      </div>
      <p style={{ fontSize: "0.7rem", color: "var(--charcoal-muted)", lineHeight: 1.5, margin: 0 }}>
        Lowercase letters, numbers, and dashes only. Reserved slugs like
        <code style={{ background: "rgba(42,42,40,0.04)", padding: "0 0.3rem" }}>booking</code> or
        <code style={{ background: "rgba(42,42,40,0.04)", padding: "0 0.3rem" }}>admin</code> are blocked.
      </p>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.62rem",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--charcoal-muted)",
  marginBottom: "0.35rem",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "0.5px solid var(--border)",
  background: "transparent",
  padding: "0.5rem 0.65rem",
  fontSize: "0.9rem",
  color: "var(--charcoal)",
  fontFamily: "inherit",
};
