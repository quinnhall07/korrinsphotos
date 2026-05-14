"use client";

// components/admin/InstallPrompt.tsx
// Mobile-only "Install to home screen" prompt for the admin app.
// Listens for the browser's `beforeinstallprompt` event, stashes it, and
// renders a small dismissible banner. Dismissal is sticky for 7 days via a
// localStorage timestamp. Hidden when the app is already installed
// (display-mode: standalone) or when the event never fires (desktop / iOS).

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "korrin.installPrompt.dismissedAt";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already installed? Skip entirely.
    if (window.matchMedia?.("(display-mode: standalone)").matches) return;

    // Within 7-day dismiss window? Skip.
    try {
      const ts = window.localStorage.getItem(DISMISS_KEY);
      if (ts && Date.now() - Number(ts) < DISMISS_MS) return;
    } catch {
      // localStorage may be blocked — fall through and just show the prompt.
    }

    // Mobile-only: skip wider viewports.
    if (window.matchMedia?.("(min-width: 768px)").matches) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Ignore — best-effort only.
    }
    setVisible(false);
    setDeferred(null);
  };

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      // Some browsers reject if already used — silent.
    }
    setVisible(false);
    setDeferred(null);
  };

  if (!visible || !deferred) return null;

  return (
    <div
      role="dialog"
      aria-label="Install Korrin admin"
      style={{
        position: "fixed",
        left: "1rem",
        right: "1rem",
        bottom: "1rem",
        background: "var(--charcoal)",
        color: "var(--white)",
        padding: "0.9rem 1rem",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        zIndex: 8500,
        fontSize: "0.8rem",
        letterSpacing: "0.03em",
        boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
      }}
    >
      <span style={{ flex: 1 }}>
        Install Korrin admin to your home screen
      </span>
      <button
        type="button"
        onClick={install}
        style={{
          background: "var(--olive)",
          color: "var(--white)",
          border: "0",
          padding: "0.55rem 0.95rem",
          fontSize: "0.7rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          cursor: "pointer",
        }}
      >
        Install
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          background: "transparent",
          color: "var(--white)",
          border: "0",
          padding: "0.55rem 0.4rem",
          fontSize: "1rem",
          cursor: "pointer",
          opacity: 0.7,
        }}
      >
        ×
      </button>
    </div>
  );
}
