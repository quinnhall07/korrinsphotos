// lib/site-content/edit-context.ts
// Optional editing hooks threaded through the render layer. When present,
// renderSection() renders editable text/image affordances; when absent it
// renders read-only. Pure types — safe to import from server OR client.
export interface ImageSlot {
  /** field on the section, e.g. "slides" | "photos" */
  field: string;
  /** index into an array field, if applicable */
  index?: number;
}

export interface EditContext {
  onText: (sectionId: string, field: string, value: string) => void;
  onImage: (sectionId: string, slot: ImageSlot) => void;
}
