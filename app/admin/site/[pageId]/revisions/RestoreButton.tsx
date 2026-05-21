"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toaster";
import { restoreRevisionAction } from "../../actions";

export function RestoreButton({ pageId, revisionId }: { pageId: string; revisionId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onClick() {
    if (!confirm("Restore this revision into your current draft? Your current draft will be overwritten.")) return;
    startTransition(async () => {
      const res = await restoreRevisionAction(pageId, revisionId);
      if (!res.success) {
        toast(res.error ?? "Restore failed.");
        return;
      }
      toast("Restored to draft. Review and publish from the editor.");
      router.push(`/admin/site/${pageId}`);
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      style={{
        padding: "0.5rem 1rem",
        fontSize: "0.7rem",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        background: "var(--charcoal)",
        color: "var(--white)",
        border: "none",
        cursor: "pointer",
      }}
    >
      {isPending ? "Restoring…" : "Restore"}
    </button>
  );
}
