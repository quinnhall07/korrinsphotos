"use client";

import { useTransition } from "react";
import { removeUser } from "./actions";
import { toast } from "@/components/ui/Toaster";

export function RemoveUserButton({ uid, email }: { uid: string; email: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() => {
        if (!confirm(`Remove ${email}? This revokes all gallery access.`)) return;
        startTransition(async () => {
          await removeUser(uid);
          toast(`${email} removed`);
        });
      }}
      style={{
        padding: "0.45rem 0.9rem",
        fontSize: "0.65rem",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--charcoal-muted)",
        border: "0.5px solid var(--border-strong)",
        background: "transparent",
        cursor: isPending ? "not-allowed" : "pointer",
        fontFamily: "'Jost', sans-serif",
        transition: "all 0.2s",
      }}
    >
      {isPending ? "…" : "Remove"}
    </button>
  );
}