"use client";

// app/admin/projects/[id]/IndoorToggle.tsx
//
// Phase 3.6 — small client child that flips `project.weatherSnapshotIndoor`.
// Owns the transition / toast so the parent WeatherCard can remain a pure
// presentational component.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toaster";
import { setProjectIndoorOverride } from "../actions";

const BTN: React.CSSProperties = {
  padding: "0.5rem 0.9rem",
  fontSize: "0.75rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  fontFamily: "'Jost', sans-serif",
  fontWeight: 400,
  cursor: "pointer",
  background: "transparent",
  color: "var(--charcoal)",
  border: "0.5px solid var(--border-strong)",
};

export function IndoorToggle({
  projectId,
  indoor,
}: {
  projectId: string;
  indoor: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const res = await setProjectIndoorOverride(projectId, !indoor);
      if (res.success) {
        toast(indoor ? "Weather updates re-enabled" : "Marked indoor — weather paused");
        router.refresh();
      } else {
        toast(res.error ?? "Failed to update.");
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      style={{ ...BTN, opacity: isPending ? 0.6 : 1 }}
    >
      {indoor ? "Resume weather updates" : "Mark indoor / skip weather"}
    </button>
  );
}
