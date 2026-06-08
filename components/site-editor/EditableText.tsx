"use client";

import React, { useRef, useLayoutEffect } from "react";
import {
  renderInlineMarkdown,
  renderConstrainedMarkdown,
} from "@/lib/site-content/markdown";

type TagName = "h1" | "h2" | "h3" | "p" | "span" | "div" | "blockquote";
type MarkdownMode = "inline" | "block" | "none";

export interface EditableTextProps {
  as?: TagName;
  value: string;
  editing: boolean;
  onCommit: (next: string) => void;
  markdown?: MarkdownMode;
  placeholder?: string;
  style?: React.CSSProperties;
}

export function EditableText({
  as = "span",
  value,
  editing,
  onCommit,
  markdown = "inline",
  placeholder,
  style,
}: EditableTextProps) {
  const ref = useRef<HTMLElement>(null);

  // Seed / sync DOM text content via ref rather than React children.
  // useLayoutEffect fires before paint so the text is visible immediately on
  // entering edit mode (no empty-flash). On SSR this component never renders
  // the edit branch, so the warning is not a practical concern; guard anyway.
  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    const el = ref.current;
    if (!editing || !el) return;
    // Don't fight the caret while the user is actively typing.
    if (document.activeElement === el) return;
    if (el.textContent !== value) {
      el.textContent = value;
    }
  }, [value, editing]);

  if (!editing) {
    // ── READ mode ─────────────────────────────────────────────────────────
    if (markdown === "none") {
      return React.createElement(as, { style }, value);
    }

    const html =
      markdown === "block"
        ? renderConstrainedMarkdown(value)
        : renderInlineMarkdown(value);

    return React.createElement(as, {
      style,
      dangerouslySetInnerHTML: { __html: html },
    });
  }

  // ── EDIT mode ─────────────────────────────────────────────────────────
  const editStyle: React.CSSProperties = {
    outline: "none",
    cursor: "text",
    minWidth: "1ch",
    whiteSpace: markdown === "block" ? "pre-wrap" : undefined,
    ...style,
  };

  function handleBlur(e: React.FocusEvent<HTMLElement>) {
    const next = e.currentTarget.textContent ?? "";
    if (next !== value) {
      onCommit(next);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLElement>) {
    if (e.key === "Enter" && markdown !== "block") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  }

  // Render with NO children — React must not manage the DOM text node of a
  // contentEditable element (causes caret resets / overwrite glitches).
  // Initial text seeding and external-update sync are both handled by the
  // useLayoutEffect above, which writes directly to el.textContent.
  return React.createElement(as, {
    ref,
    role: "textbox",
    "aria-label": placeholder ?? "Editable text",
    contentEditable: true,
    suppressContentEditableWarning: true,
    suppressHydrationWarning: true,
    "data-placeholder": placeholder,
    style: editStyle,
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
  });
}
