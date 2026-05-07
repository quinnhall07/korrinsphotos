"use client";

// app/admin/bookings/TagManager.tsx
// Inline tag editor. Shows preset tags as toggles + allows custom tag input.

import { useState, useTransition } from "react";
import { addTag, removeTag } from "./tag-actions";
import { PRESET_TAGS } from "@/lib/booking-kanban";
import { toast } from "@/components/ui/Toaster";

interface TagManagerProps {
  inquiryId: string;
  currentTags: string[];
}

export function TagManager({ inquiryId, currentTags }: TagManagerProps) {
  const [tags, setTags]                   = useState<string[]>(currentTags);
  const [customInput, setCustomInput]     = useState("");
  const [isPending, startTransition]      = useTransition();

  function handleToggle(tag: string) {
    const has = tags.includes(tag);
    startTransition(async () => {
      const result = has
        ? await removeTag(inquiryId, tag)
        : await addTag(inquiryId, tag);

      if (result.success) {
        setTags((prev) => has ? prev.filter((t) => t !== tag) : [...prev, tag]);
      } else {
        toast(result.error ?? "Failed to update tag.");
      }
    });
  }

  function handleAddCustom() {
    const trimmed = customInput.trim();
    if (!trimmed || tags.includes(trimmed)) { setCustomInput(""); return; }
    startTransition(async () => {
      const result = await addTag(inquiryId, trimmed);
      if (result.success) {
        setTags((prev) => [...prev, trimmed]);
        setCustomInput("");
      } else {
        toast(result.error ?? "Failed to add tag.");
      }
    });
  }

  return (
    <div>
      {/* Preset tags */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.75rem" }}>
        {PRESET_TAGS.map((tag) => {
          const active = tags.includes(tag);
          return (
            <button
              key={tag}
              onClick={() => handleToggle(tag)}
              disabled={isPending}
              style={{
                padding: "0.28rem 0.7rem",
                fontSize: "0.65rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: isPending ? "not-allowed" : "pointer",
                border: `0.5px solid ${active ? "var(--olive)" : "var(--border-strong)"}`,
                background: active ? "var(--olive)" : "transparent",
                color: active ? "var(--white)" : "var(--charcoal-muted)",
                fontFamily: "'Jost', sans-serif",
                transition: "all 0.15s",
              }}
            >
              {active ? "✓ " : ""}{tag}
            </button>
          );
        })}
      </div>

      {/* Custom tag input */}
      <div style={{ display: "flex", gap: 0 }}>
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCustom(); }}}
          placeholder="Custom tag…"
          style={{
            flex: 1,
            border: "0.5px solid var(--border-strong)",
            borderRight: "none",
            background: "transparent",
            padding: "0.55rem 0.75rem",
            fontFamily: "'Jost', sans-serif",
            fontSize: "0.82rem",
            color: "var(--charcoal)",
            outline: "none",
          }}
        />
        <button
          onClick={handleAddCustom}
          disabled={isPending || !customInput.trim()}
          style={{
            padding: "0.55rem 0.9rem",
            fontSize: "0.65rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            background: "var(--charcoal)",
            color: "var(--white)",
            border: "none",
            cursor: isPending || !customInput.trim() ? "not-allowed" : "pointer",
            fontFamily: "'Jost', sans-serif",
            opacity: !customInput.trim() ? 0.4 : 1,
            transition: "opacity 0.15s",
          }}
        >
          Add
        </button>
      </div>

      {/* Active custom tags not in presets */}
      {tags.filter((t) => !(PRESET_TAGS as readonly string[]).includes(t)).length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.5rem" }}>
          {tags
            .filter((t) => !(PRESET_TAGS as readonly string[]).includes(t))
            .map((tag) => (
              <span
                key={tag}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  padding: "0.25rem 0.6rem",
                  background: "var(--charcoal)",
                  color: "var(--white)",
                  fontSize: "0.62rem",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  fontFamily: "'Jost', sans-serif",
                }}
              >
                {tag}
                <button
                  onClick={() => handleToggle(tag)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "rgba(250,249,246,0.6)",
                    cursor: "pointer",
                    padding: 0,
                    fontSize: "0.75rem",
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </span>
            ))}
        </div>
      )}
    </div>
  );
}
