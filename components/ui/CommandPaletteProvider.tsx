"use client";

// components/ui/CommandPaletteProvider.tsx
// Owns the global Cmd/Ctrl+K listener and the modal's open/close state.
// The CommandPalette modal is only mounted while open — closed = zero DOM cost.
//
// Wrapped around children in app/admin/layout.tsx so the palette is admin-only;
// public pages never load this code.
//
// Exposes an imperative `open()` / `close()` / `toggle()` API via context so
// non-keyboard surfaces (e.g. the mobile header search icon) can trigger the
// palette. The existing Cmd/Ctrl+K + Escape keybindings are preserved.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { CommandPalette } from "./CommandPalette";

type CommandPaletteContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((o) => !o), []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Cmd+K (macOS) or Ctrl+K (Windows/Linux) toggles.
      const isModK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isModK) {
        e.preventDefault();
        setIsOpen((o) => !o);
        return;
      }
      // Escape closes when open (handled here so we don't have to attach a
      // listener inside the modal that competes with the modal's own arrow
      // keys; this also keeps the close path consistent).
      if (e.key === "Escape") {
        setIsOpen((o) => (o ? false : o));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const value = useMemo<CommandPaletteContextValue>(
    () => ({ isOpen, open, close, toggle }),
    [isOpen, open, close, toggle]
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      {isOpen && <CommandPalette onClose={close} />}
    </CommandPaletteContext.Provider>
  );
}

/**
 * Imperative handle for the global command palette.
 * Must be used inside <CommandPaletteProvider>.
 */
export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error("useCommandPalette must be used inside <CommandPaletteProvider>");
  }
  return ctx;
}
