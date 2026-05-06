// app/admin/events/[id]/TitleEditor.tsx
// Click-to-edit component for event titles.
// On click → text input. On blur/Enter → save. On Escape → revert.
"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateEventTitle } from "./actions";

interface TitleEditorProps {
  eventId: string;
  initialTitle: string;
}

export function TitleEditor({ eventId, initialTitle }: TitleEditorProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function handleSave() {
    setEditing(false);
    if (title.trim() && title.trim() !== initialTitle) {
      startTransition(async () => {
        await updateEventTitle(eventId, title.trim());
        router.refresh();
      });
    } else {
      setTitle(initialTitle);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setTitle(initialTitle);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "2rem",
          fontWeight: 300,
          marginBottom: "0.25rem",
          border: "0.5px solid var(--olive)",
          background: "transparent",
          outline: "none",
          padding: "0.1rem 0.4rem",
          width: "100%",
          color: "var(--charcoal)",
        }}
      />
    );
  }

  return (
    <h2
      onClick={() => setEditing(true)}
      title="Click to edit title"
      style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: "2rem",
        fontWeight: 300,
        marginBottom: "0.25rem",
        cursor: "pointer",
        borderBottom: "1px dashed transparent",
        transition: "border-color 0.2s",
      }}
      className="title-editable"
    >
      {title}
      <style>{`
        .title-editable:hover {
          border-bottom-color: var(--olive) !important;
        }
      `}</style>
    </h2>
  );
}
