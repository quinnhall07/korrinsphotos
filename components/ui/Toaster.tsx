"use client";

// components/ui/Toaster.tsx
// Global toast notification system using a simple event-driven pattern.
// Usage from any Client Component: import { toast } from "@/components/ui/Toaster";
//                                  toast("Photo deleted successfully");

import { useState, useEffect, useCallback } from "react";

type ToastMessage = { id: number; text: string };

// Simple event bus — avoids the need for a full state management library
const listeners: Set<(msg: ToastMessage) => void> = new Set();

export function toast(text: string) {
  const msg: ToastMessage = { id: Date.now(), text };
  listeners.forEach((l) => l(msg));
}

export function Toaster() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const addMessage = useCallback((msg: ToastMessage) => {
    setMessages((prev) => [...prev, msg]);
    setTimeout(() => {
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    }, 3500);
  }, []);

  useEffect(() => {
    listeners.add(addMessage);
    return () => { listeners.delete(addMessage); };
  }, [addMessage]);

  if (messages.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "2rem",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9000,
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        alignItems: "center",
        pointerEvents: "none",
      }}
    >
      {messages.map((msg) => (
        <div
          key={msg.id}
          style={{
            background: "var(--charcoal)",
            color: "var(--white)",
            padding: "0.85rem 2rem",
            fontSize: "0.8rem",
            letterSpacing: "0.06em",
            animation: "fadeIn 0.35s ease",
            whiteSpace: "nowrap",
          }}
        >
          {msg.text}
        </div>
      ))}
    </div>
  );
}