"use client";

// components/ui/CommandPaletteProvider.tsx
// Owns the global Cmd/Ctrl+K listener and the modal's open/close state.
// The CommandPalette modal is only mounted while open — closed = zero DOM cost.
//
// Wrapped around children in app/admin/layout.tsx so the palette is admin-only;
// public pages never load this code.

import { useCallback, useEffect, useState } from "react";
import { CommandPalette } from "./CommandPalette";

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Cmd+K (macOS) or Ctrl+K (Windows/Linux) toggles.
      const isModK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isModK) {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      // Escape closes when open (handled here so we don't have to attach a
      // listener inside the modal that competes with the modal's own arrow
      // keys; this also keeps the close path consistent).
      if (e.key === "Escape") {
        setOpen((o) => (o ? false : o));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      {children}
      {open && <CommandPalette onClose={close} />}
    </>
  );
}
