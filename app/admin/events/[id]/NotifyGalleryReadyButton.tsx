"use client";

// app/admin/events/[id]/NotifyGalleryReadyButton.tsx
// UX P0 (c) — One-click CTA that emails the linked client an invitation to
// view their delivered gallery. Renders only when the parent (server) page
// has determined the event is in a "gallery ready" state AND has a clientId.
//
// Server boundary: this client component invokes the server action
// `notifyGalleryReady` directly via the `"use server"` import; it does NOT
// import any server-only module.

import { useTransition } from "react";
import { notifyGalleryReady } from "./actions";
import { toast } from "@/components/ui/Toaster";

interface Props {
  eventId: string;
  clientFirstName: string;
}

export function NotifyGalleryReadyButton({ eventId, clientFirstName }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await notifyGalleryReady(eventId);
      if (result.success) {
        toast(`Notification sent to ${clientFirstName}.`);
      } else {
        toast(result.error ?? "Failed to send notification.");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      style={{
        display: "inline-block",
        padding: "0.6rem 1.4rem",
        fontSize: "0.68rem",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        background: "var(--olive)",
        color: "var(--white)",
        border: "none",
        cursor: isPending ? "wait" : "pointer",
        opacity: isPending ? 0.6 : 1,
      }}
    >
      {isPending ? "Sending…" : `Notify ${clientFirstName} →`}
    </button>
  );
}
