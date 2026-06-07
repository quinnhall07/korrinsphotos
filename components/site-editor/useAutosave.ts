"use client";
// components/site-editor/useAutosave.ts
// Debounced autosave for the section list. Calls `save(sections)` ~900ms after
// the last change. Exposes status + flush() (so Publish persists latest first).
import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
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
  // Generation counter: prevents a slow in-flight save from overwriting a
  // newer save's status (last write wins, stale resolves are discarded).
  const saveGen = useRef(0);

  // useLayoutEffect so the ref is updated synchronously after commit — before
  // any subsequent click handler runs. This ensures flush() (called from the
  // Publish button) always reads the current sections, never a stale snapshot.
  useLayoutEffect(() => { latest.current = sections; });

  const doSave = useCallback(async () => {
    const gen = ++saveGen.current;
    setStatus("saving");
    const res = await save(latest.current);
    if (gen !== saveGen.current) return; // superseded by a newer save
    setStatus(res.success ? "saved" : "error");
  }, [save]);

  // Note: an `error` status auto-recovers because the next change sets `unsaved`
  // and re-arms the debounce timer, which will attempt another save.
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    setStatus("unsaved");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void doSave(); }, DEBOUNCE_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [sections, doSave]);

  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    const gen = ++saveGen.current;
    setStatus("saving");
    const res = await save(latest.current);
    if (gen !== saveGen.current) return res.success; // superseded — skip status update
    setStatus(res.success ? "saved" : "error");
    return res.success;
  }, [save]);

  return { status, flush };
}
