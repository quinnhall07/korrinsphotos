"use client";

import React, { useRef, useEffect } from "react";
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

  // Keep the DOM text in sync with `value` when editing externally (e.g. undo)
  // but never overwrite while the user is actively typing in this element.
  useEffect(() => {
    const el = ref.current;
    if (!editing || !el) return;
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

  // Pass value as the third argument (children) to satisfy react/no-children-prop.
  // The useEffect above keeps textContent in sync for external updates (e.g. undo)
  // without fighting the caret while the user is actively typing.
  return React.createElement(
    as,
    {
      ref,
      contentEditable: true,
      suppressContentEditableWarning: true,
      suppressHydrationWarning: true,
      "data-placeholder": placeholder,
      style: editStyle,
      onBlur: handleBlur,
      onKeyDown: handleKeyDown,
    },
    value,
  );
}
