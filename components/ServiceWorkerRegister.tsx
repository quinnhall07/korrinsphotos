"use client";

// components/ServiceWorkerRegister.tsx
// Registers /sw.js on mount (production only). Renders nothing.
// All errors are swallowed silently — service worker support varies across
// browsers and we never want to crash the app over a PWA enhancement.

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    // Defer until after first paint so registration never blocks hydration.
    const id = window.setTimeout(() => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Silent — PWA is progressive enhancement.
      });
    }, 0);

    return () => window.clearTimeout(id);
  }, []);

  return null;
}
