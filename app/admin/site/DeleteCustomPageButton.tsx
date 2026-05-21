"use client";

// app/admin/site/DeleteCustomPageButton.tsx
// Confirm-and-delete affordance for admin-created custom pages. Built-in
// pages don't get this button — they have hand-coded fallback layouts and
// can't be removed via the editor.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toaster";
import { deleteCustomPageAction } from "./actions";

export function DeleteCustomPageButton({ slug, label }: { slug: string; label: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (
      !confirm(
        `Delete "${label}" (/${slug}) permanently? Any revisions for this page will also be lost. This cannot be undone.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await deleteCustomPageAction(slug);
      if (!res.success) {
        toast(res.error ?? "Delete failed.");
        return;
      }
      toast(`Deleted /${slug}.`);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      style={{
        padding: "0.5rem 0.85rem",
        fontSize: "0.68rem",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        background: "transparent",
        border: "0.5px solid var(--border-strong)",
        color: "#a83232",
        cursor: isPending ? "wait" : "pointer",
      }}
    >
      {isPending ? "Deleting…" : "Delete"}
    </button>
  );
}
