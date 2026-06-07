"use client";
// components/site-editor/useEditorHistory.ts
// Undo/redo state for the section list. Structural ops (insert/move/delete/
// duplicate/replace) each create one history step. Consecutive field edits to
// the SAME section coalesce into one step (so typing isn't 1 undo per keystroke).
import { useReducer, useCallback } from "react";
import type { Section, SectionType } from "@/lib/site-content/types";

interface HistoryState {
  past: Section[][];
  present: Section[];
  future: Section[][];
  lastTag: string | null;
}

type Action =
  | { type: "RESET"; sections: Section[] }
  | { type: "REPLACE"; sections: Section[]; tag?: string }
  | { type: "UPDATE"; id: string; patch: Partial<Section> }
  | { type: "UNDO" }
  | { type: "REDO" };

function reducer(state: HistoryState, action: Action): HistoryState {
  switch (action.type) {
    case "RESET":
      return { past: [], present: action.sections, future: [], lastTag: null };
    case "REPLACE":
      return { past: [...state.past, state.present], present: action.sections, future: [], lastTag: action.tag ?? null };
    case "UPDATE": {
      const tag = `update:${action.id}`;
      const nextPresent = state.present.map((s) =>
        s.id === action.id ? ({ ...s, ...action.patch } as Section) : s
      );
      if (state.lastTag === tag) {
        return { ...state, present: nextPresent, future: [] };
      }
      return { past: [...state.past, state.present], present: nextPresent, future: [], lastTag: tag };
    }
    case "UNDO": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future], lastTag: null };
    }
    case "REDO": {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return { past: [...state.past, state.present], present: next, future: state.future.slice(1), lastTag: null };
    }
    default:
      return state;
  }
}

export function useEditorHistory(initial: Section[]) {
  const [state, dispatch] = useReducer(reducer, { past: [], present: initial, future: [], lastTag: null });
  const reset = useCallback((sections: Section[]) => dispatch({ type: "RESET", sections }), []);
  const replace = useCallback((sections: Section[], tag?: string) => dispatch({ type: "REPLACE", sections, tag }), []);
  const updateSection = useCallback((id: string, patch: Partial<Section>) => dispatch({ type: "UPDATE", id, patch }), []);
  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const redo = useCallback(() => dispatch({ type: "REDO" }), []);
  return { sections: state.present, canUndo: state.past.length > 0, canRedo: state.future.length > 0, reset, replace, updateSection, undo, redo };
}

export type { SectionType };
