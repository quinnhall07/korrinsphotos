"use client";
// components/site-editor/useAutosave.ts
// Debounced autosave for the section list. Calls `save(sections)` ~900ms after
// the last change. Exposes status + flush() (so Publish persists latest first).
import { useEffect, useRef, useState, useCallback } from "react";
import type { Section } from "@/lib/site-content/types";

export type SaveStatus = "saved" | "unsaved" | "saving" | "error";

const DEBOUNCE_MS = 900;

export function useAutosave(
  sections: Section[],
  save: (sections: Section[]) => Promise<{ success: boolean; error?: string }>
) {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(sections);
  const firstRun = useRef(true);

  useEffect(() => { latest.current = sections; });

  const doSave = useCallback(async () => {
    setStatus("saving");
    const res = await save(latest.current);
    setStatus(res.success ? "saved" : "error");
  }, [save]);

  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    setStatus("unsaved");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void doSave(); }, DEBOUNCE_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [sections, doSave]);

  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    setStatus("saving");
    const res = await save(latest.current);
    setStatus(res.success ? "saved" : "error");
    return res.success;
  }, [save]);

  return { status, flush };
}
