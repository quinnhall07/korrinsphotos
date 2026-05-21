"use client";

// app/admin/site/[pageId]/EditorClient.tsx
// Per-page editor — stateful list of Section[] with per-block forms.

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toaster";
import { PhotoPicker } from "@/components/admin/PhotoPicker";
import { buildCdnUrl } from "@/lib/cloudflare";
import type {
  Section,
  SectionType,
  PhotoRef,
  HeroSection,
  PhotoGridSection,
  RichTextSection,
  CtaBannerSection,
} from "@/lib/site-content/types";
import { saveDraftAction, discardDraftAction, publishDraftAction } from "../actions";

interface PickerData {
  siteAssets: { id: string; cloudflareImageId: string; label: string; altText: string }[];
  projectPhotos: { photoId: string; eventId: string; cloudflareImageId: string; label: string | null; category: string | null }[];
}

interface Props {
  pageId: string;
  allowedSections: SectionType[];
  initialSections: Section[];
  pickerData: PickerData;
}

function makeId(type: SectionType): string {
  return `${type.toLowerCase()}-${Math.random().toString(36).slice(2, 9)}`;
}

function blank(type: SectionType): Section {
  switch (type) {
    case "HERO":
      return { id: makeId("HERO"), type: "HERO", slides: [] };
    case "PHOTO_GRID":
      return { id: makeId("PHOTO_GRID"), type: "PHOTO_GRID", columns: 3, photos: [] };
    case "RICH_TEXT":
      return { id: makeId("RICH_TEXT"), type: "RICH_TEXT", body: "" };
    case "CTA_BANNER":
      return { id: makeId("CTA_BANNER"), type: "CTA_BANNER", headline: "Your headline", variant: "DARK" };
    case "PROCESS_STEPS":
      return {
        id: makeId("PROCESS_STEPS"),
        type: "PROCESS_STEPS",
        steps: [
          { n: "01", title: "Step one", body: "Describe the first step here." },
          { n: "02", title: "Step two", body: "Describe the second step here." },
        ],
      };
    case "PACKAGE_CARDS":
      return {
        id: makeId("PACKAGE_CARDS"),
        type: "PACKAGE_CARDS",
        packages: [],
      };
    case "TESTIMONIAL":
      return {
        id: makeId("TESTIMONIAL"),
        type: "TESTIMONIAL",
        quote: "A real testimonial will live here.",
        variant: "DARK",
      };
    case "SLIDESHOW":
      return {
        id: makeId("SLIDESHOW"),
        type: "SLIDESHOW",
        slides: [],
        intervalMs: 5000,
      };
    case "STATS":
      return {
        id: makeId("STATS"),
        type: "STATS",
        items: [
          { number: "0+", label: "Sessions" },
          { number: "0",  label: "Years" },
          { number: "0%", label: "Satisfaction" },
        ],
      };
  }
}

const SECTION_LABEL: Record<SectionType, string> = {
  HERO: "Hero",
  PHOTO_GRID: "Photo grid",
  RICH_TEXT: "Rich text",
  CTA_BANNER: "CTA banner",
  PROCESS_STEPS: "Process steps",
  PACKAGE_CARDS: "Package cards",
  TESTIMONIAL: "Testimonial",
  SLIDESHOW: "Slideshow",
  STATS: "Stats",
};

export function EditorClient({ pageId, allowedSections, initialSections, pickerData }: Props) {
  const router = useRouter();
  const [sections, setSections] = useState<Section[]>(initialSections);
  const [selectedId, setSelectedId] = useState<string | null>(initialSections[0]?.id ?? null);
  const [dirty, setDirty] = useState(false);
  const [pickerCtx, setPickerCtx] = useState<{ sectionId: string; slot: "HERO_SLIDE" | "GRID_PHOTO" | "SLIDESHOW_SLIDE"; index?: number } | null>(null);
  const [isPending, startTransition] = useTransition();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [frameReady, setFrameReady] = useState(false);

  // Bridge to the iframe preview. The iframe posts SECTION_SELECTED when the
  // admin clicks a section in the preview; we sync that to selectedId here
  // so the right-side form jumps to the same section.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const data = e.data as { type?: string; id?: string } | null;
      if (!data || typeof data !== "object") return;
      if (data.type === "FRAME_READY") {
        setFrameReady(true);
        return;
      }
      if (data.type === "SECTION_SELECTED" && typeof data.id === "string") {
        setSelectedId(data.id);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Tell the iframe which section the editor considers selected. Bounce on
  // every selectedId change so highlights match the right-side form.
  useEffect(() => {
    if (!frameReady) return;
    const w = iframeRef.current?.contentWindow;
    if (!w) return;
    w.postMessage({ type: "SET_SELECTED", id: selectedId }, "*");
  }, [selectedId, frameReady]);

  const selected = sections.find((s) => s.id === selectedId) ?? null;

  function update<T extends Section>(id: string, patch: Partial<T>) {
    setSections((prev) => prev.map((s) => (s.id === id ? ({ ...s, ...patch } as Section) : s)));
    setDirty(true);
  }

  function addSection(type: SectionType) {
    const s = blank(type);
    setSections((prev) => [...prev, s]);
    setSelectedId(s.id);
    setDirty(true);
  }

  function removeSection(id: string) {
    if (!confirm("Delete this section?")) return;
    setSections((prev) => prev.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
    setDirty(true);
  }

  function moveSection(id: string, dir: -1 | 1) {
    setSections((prev) => {
      const i = prev.findIndex((s) => s.id === id);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(i, 1);
      next.splice(j, 0, item);
      return next;
    });
    setDirty(true);
  }

  function handlePhotoSelected(ref: PhotoRef) {
    if (!pickerCtx) return;
    const target = sections.find((s) => s.id === pickerCtx.sectionId);
    if (!target) return;

    if (target.type === "HERO" && pickerCtx.slot === "HERO_SLIDE") {
      const slides = [...(target as HeroSection).slides];
      if (pickerCtx.index != null) {
        slides[pickerCtx.index] = { photoRef: ref };
      } else {
        slides.push({ photoRef: ref });
      }
      update<HeroSection>(target.id, { slides });
    } else if (target.type === "PHOTO_GRID" && pickerCtx.slot === "GRID_PHOTO") {
      const photos = [...(target as PhotoGridSection).photos];
      if (pickerCtx.index != null) {
        photos[pickerCtx.index] = ref;
      } else {
        photos.push(ref);
      }
      update<PhotoGridSection>(target.id, { photos });
    } else if (target.type === "SLIDESHOW" && pickerCtx.slot === "SLIDESHOW_SLIDE") {
      const slides = [...(target as Extract<Section, { type: "SLIDESHOW" }>).slides];
      if (pickerCtx.index != null) {
        slides[pickerCtx.index] = ref;
      } else {
        slides.push(ref);
      }
      update<Extract<Section, { type: "SLIDESHOW" }>>(target.id, { slides });
    }
    setPickerCtx(null);
  }

  function reloadFrame() {
    const w = iframeRef.current?.contentWindow;
    if (!w) return;
    try {
      w.location.reload();
    } catch {
      // Cross-origin should never happen here; ignore.
    }
  }

  function handleSave() {
    const payload = JSON.stringify(sections);
    startTransition(async () => {
      const res = await saveDraftAction(pageId, payload);
      if (!res.success) {
        toast(res.error ?? "Save failed.");
        return;
      }
      setDirty(false);
      toast("Draft saved.");
      router.refresh();
      // Iframe shows persisted draft — reload after the save lands.
      setTimeout(reloadFrame, 50);
    });
  }

  function handleDiscard() {
    if (!confirm("Discard unsaved changes and revert to the published version?")) return;
    startTransition(async () => {
      const res = await discardDraftAction(pageId);
      if (!res.success) {
        toast(res.error ?? "Discard failed.");
        return;
      }
      toast("Draft discarded.");
      router.refresh();
    });
  }

  function handlePublish() {
    if (dirty) {
      toast("Save your draft before publishing.");
      return;
    }
    const note = prompt("Optional changelog note for this publish:") ?? undefined;
    startTransition(async () => {
      const res = await publishDraftAction(pageId, note?.trim() || undefined);
      if (!res.success) {
        toast(res.error ?? "Publish failed.");
        return;
      }
      toast("Published.");
      router.refresh();
    });
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "240px 1fr 340px",
        gap: "1rem",
        alignItems: "stretch",
        minHeight: "calc(100vh - 8rem)",
      }}
    >
      {/* Left rail: section list */}
      <aside style={{ border: "0.5px solid var(--border)", padding: "1rem", background: "var(--white)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.75rem" }}>
          <h2 style={{ fontSize: "0.7rem", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--charcoal-muted)", margin: 0 }}>
            Sections
          </h2>
          <span style={{ fontSize: "0.7rem", color: dirty ? "var(--olive)" : "var(--charcoal-muted)" }}>
            {dirty ? "Unsaved" : "Saved"}
          </span>
        </div>

        {sections.length === 0 ? (
          <p style={{ fontSize: "0.78rem", color: "var(--charcoal-muted)" }}>No sections yet. Add one below.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1rem" }}>
            {sections.map((s, i) => (
              <li key={s.id} style={{ marginBottom: "0.3rem" }}>
                <div style={{ display: "flex", gap: "0.25rem" }}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    style={{
                      flex: 1,
                      textAlign: "left",
                      padding: "0.45rem 0.6rem",
                      fontSize: "0.8rem",
                      background: selectedId === s.id ? "rgba(107,120,69,0.1)" : "transparent",
                      border: "0.5px solid",
                      borderColor: selectedId === s.id ? "var(--olive)" : "var(--border)",
                      cursor: "pointer",
                      color: "var(--charcoal)",
                    }}
                  >
                    {i + 1}. {SECTION_LABEL[s.type]}
                  </button>
                  <button type="button" onClick={() => moveSection(s.id, -1)} disabled={i === 0} title="Move up" style={iconBtn}>
                    ↑
                  </button>
                  <button type="button" onClick={() => moveSection(s.id, 1)} disabled={i === sections.length - 1} title="Move down" style={iconBtn}>
                    ↓
                  </button>
                  <button type="button" onClick={() => removeSection(s.id)} title="Delete" style={iconBtn}>
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div style={{ borderTop: "0.5px solid var(--border)", paddingTop: "0.75rem" }}>
          <p style={{ fontSize: "0.65rem", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--charcoal-muted)", marginBottom: "0.5rem" }}>
            Add section
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            {allowedSections.map((t) => (
              <button key={t} type="button" onClick={() => addSection(t)} style={addBtn}>
                + {SECTION_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        <div style={{ borderTop: "0.5px solid var(--border)", marginTop: "1rem", paddingTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <button type="button" onClick={handleSave} disabled={isPending || !dirty} style={primaryBtn}>
            {isPending ? "Saving…" : "Save draft"}
          </button>
          <button type="button" onClick={handleDiscard} disabled={isPending} style={secondaryBtn}>
            Discard draft
          </button>
          <button type="button" onClick={handlePublish} disabled={isPending || dirty} style={publishBtn}>
            Publish to live
          </button>
        </div>
      </aside>

      {/* Middle: live iframe preview */}
      <div
        style={{
          border: "0.5px solid var(--border)",
          background: "var(--white)",
          position: "relative",
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0.6rem 0.85rem",
            borderBottom: "0.5px solid var(--border)",
            background: "rgba(42,42,40,0.02)",
            fontSize: "0.72rem",
            color: "var(--charcoal-muted)",
            letterSpacing: "0.04em",
          }}
        >
          <span>
            Click a section in the preview to edit it.
            {dirty && (
              <span style={{ marginLeft: "0.6rem", color: "var(--olive)" }}>
                · Unsaved changes — save to refresh preview
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={reloadFrame}
            style={{
              ...iconBtn,
              padding: "0.3rem 0.7rem",
              fontSize: "0.7rem",
            }}
            title="Reload preview"
          >
            ↻
          </button>
        </div>
        <iframe
          ref={iframeRef}
          src={`/admin/site/${pageId}/preview?frame=1`}
          title="Site preview"
          style={{
            flex: 1,
            width: "100%",
            border: "none",
            background: "var(--white)",
            display: "block",
          }}
        />
      </div>

      {/* Right: section property form */}
      <aside style={{ minWidth: 0 }}>
        {!selected ? (
          <div style={{ padding: "3rem 1rem", textAlign: "center", color: "var(--charcoal-muted)", border: "0.5px dashed var(--border-strong)", background: "var(--white)", height: "100%" }}>
            <p style={{ margin: 0, fontSize: "0.85rem", lineHeight: 1.6 }}>
              Click a section in the preview to edit it, or pick one from the left rail.
            </p>
          </div>
        ) : (
          <div style={{ border: "0.5px solid var(--border)", padding: "1.25rem", background: "var(--white)", height: "100%", overflowY: "auto", maxHeight: "calc(100vh - 8rem)" }}>
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.4rem", fontWeight: 300, marginTop: 0 }}>
              {SECTION_LABEL[selected.type]}
            </h3>

            {selected.type === "HERO" && (
              <HeroForm
                section={selected as HeroSection}
                onChange={(patch) => update<HeroSection>(selected.id, patch)}
                onPickSlide={(index) => setPickerCtx({ sectionId: selected.id, slot: "HERO_SLIDE", index })}
                onPickAdd={() => setPickerCtx({ sectionId: selected.id, slot: "HERO_SLIDE" })}
              />
            )}
            {selected.type === "PHOTO_GRID" && (
              <PhotoGridForm
                section={selected as PhotoGridSection}
                onChange={(patch) => update<PhotoGridSection>(selected.id, patch)}
                onPickPhoto={(index) => setPickerCtx({ sectionId: selected.id, slot: "GRID_PHOTO", index })}
                onPickAdd={() => setPickerCtx({ sectionId: selected.id, slot: "GRID_PHOTO" })}
              />
            )}
            {selected.type === "RICH_TEXT" && (
              <RichTextForm section={selected as RichTextSection} onChange={(patch) => update<RichTextSection>(selected.id, patch)} />
            )}
            {selected.type === "CTA_BANNER" && (
              <CtaBannerForm section={selected as CtaBannerSection} onChange={(patch) => update<CtaBannerSection>(selected.id, patch)} />
            )}
            {selected.type === "PROCESS_STEPS" && (
              <ProcessStepsForm
                section={selected as Extract<Section, { type: "PROCESS_STEPS" }>}
                onChange={(patch) => update<Extract<Section, { type: "PROCESS_STEPS" }>>(selected.id, patch)}
              />
            )}
            {selected.type === "PACKAGE_CARDS" && (
              <PackageCardsForm
                section={selected as Extract<Section, { type: "PACKAGE_CARDS" }>}
                onChange={(patch) => update<Extract<Section, { type: "PACKAGE_CARDS" }>>(selected.id, patch)}
              />
            )}
            {selected.type === "TESTIMONIAL" && (
              <TestimonialForm
                section={selected as Extract<Section, { type: "TESTIMONIAL" }>}
                onChange={(patch) => update<Extract<Section, { type: "TESTIMONIAL" }>>(selected.id, patch)}
              />
            )}
            {selected.type === "SLIDESHOW" && (
              <SlideshowForm
                section={selected as Extract<Section, { type: "SLIDESHOW" }>}
                onChange={(patch) => update<Extract<Section, { type: "SLIDESHOW" }>>(selected.id, patch)}
                onPickSlide={(index) => setPickerCtx({ sectionId: selected.id, slot: "SLIDESHOW_SLIDE", index })}
                onPickAdd={() => setPickerCtx({ sectionId: selected.id, slot: "SLIDESHOW_SLIDE" })}
              />
            )}
            {selected.type === "STATS" && (
              <StatsForm
                section={selected as Extract<Section, { type: "STATS" }>}
                onChange={(patch) => update<Extract<Section, { type: "STATS" }>>(selected.id, patch)}
              />
            )}
          </div>
        )}
      </aside>

      <PhotoPicker
        open={pickerCtx !== null}
        onClose={() => setPickerCtx(null)}
        onSelect={handlePhotoSelected}
        initialData={pickerData}
      />
    </div>
  );
}

/* ─── per-block forms ──────────────────────────────────────────────────── */

function HeroForm({
  section,
  onChange,
  onPickSlide,
  onPickAdd,
}: {
  section: HeroSection;
  onChange: (patch: Partial<HeroSection>) => void;
  onPickSlide: (index: number) => void;
  onPickAdd: () => void;
}) {
  return (
    <>
      <Field label="Eyebrow (small uppercase line)">
        <TextInput value={section.eyebrow ?? ""} onChange={(v) => onChange({ eyebrow: v })} />
      </Field>
      <Field label="Headline (Markdown: **bold**, *italic*)">
        <TextInput value={section.headline ?? ""} onChange={(v) => onChange({ headline: v })} />
      </Field>
      <Field label="Sub-headline">
        <TextArea value={section.sub ?? ""} onChange={(v) => onChange({ sub: v })} />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <Field label="Primary CTA label">
          <TextInput value={section.primaryCtaLabel ?? ""} onChange={(v) => onChange({ primaryCtaLabel: v })} />
        </Field>
        <Field label="Primary CTA href">
          <TextInput value={section.primaryCtaHref ?? ""} onChange={(v) => onChange({ primaryCtaHref: v })} placeholder="/booking" />
        </Field>
        <Field label="Secondary CTA label">
          <TextInput value={section.secondaryCtaLabel ?? ""} onChange={(v) => onChange({ secondaryCtaLabel: v })} />
        </Field>
        <Field label="Secondary CTA href">
          <TextInput value={section.secondaryCtaHref ?? ""} onChange={(v) => onChange({ secondaryCtaHref: v })} placeholder="/portfolio" />
        </Field>
      </div>

      <Field label="Slides">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.5rem", marginBottom: "0.5rem" }}>
          {section.slides.map((slide, i) => (
            <div key={i} style={{ border: "0.5px solid var(--border)", padding: "0.4rem" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={buildCdnUrl(slide.photoRef.cloudflareImageId, "thumbnail")} alt="" style={{ width: "100%", height: "90px", objectFit: "cover" }} />
              <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.3rem" }}>
                <button type="button" onClick={() => onPickSlide(i)} style={mini}>Swap</button>
                <button
                  type="button"
                  onClick={() => onChange({ slides: section.slides.filter((_, j) => j !== i) })}
                  style={mini}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={onPickAdd} style={addBtn}>+ Add slide</button>
      </Field>
    </>
  );
}

function PhotoGridForm({
  section,
  onChange,
  onPickPhoto,
  onPickAdd,
}: {
  section: PhotoGridSection;
  onChange: (patch: Partial<PhotoGridSection>) => void;
  onPickPhoto: (index: number) => void;
  onPickAdd: () => void;
}) {
  return (
    <>
      <Field label="Eyebrow">
        <TextInput value={section.eyebrow ?? ""} onChange={(v) => onChange({ eyebrow: v })} />
      </Field>
      <Field label="Heading (Markdown: **bold**, *italic*)">
        <TextInput value={section.heading ?? ""} onChange={(v) => onChange({ heading: v })} />
      </Field>
      <Field label="Body">
        <TextArea value={section.body ?? ""} onChange={(v) => onChange({ body: v })} />
      </Field>
      <Field label="Columns">
        <select
          value={section.columns}
          onChange={(e) => onChange({ columns: Number(e.target.value) as 2 | 3 | 4 })}
          style={selectStyle}
        >
          <option value={2}>2</option>
          <option value={3}>3</option>
          <option value={4}>4</option>
        </select>
      </Field>
      <Field label="Photos">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.5rem", marginBottom: "0.5rem" }}>
          {section.photos.map((p, i) => (
            <div key={`${p.id}-${i}`} style={{ border: "0.5px solid var(--border)", padding: "0.4rem" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={buildCdnUrl(p.cloudflareImageId, "thumbnail")} alt="" style={{ width: "100%", height: "90px", objectFit: "cover" }} />
              <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.3rem" }}>
                <button type="button" onClick={() => onPickPhoto(i)} style={mini}>Swap</button>
                <button
                  type="button"
                  onClick={() => onChange({ photos: section.photos.filter((_, j) => j !== i) })}
                  style={mini}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={onPickAdd} style={addBtn}>+ Add photo</button>
      </Field>
    </>
  );
}

function RichTextForm({ section, onChange }: { section: RichTextSection; onChange: (patch: Partial<RichTextSection>) => void }) {
  return (
    <>
      <Field label="Eyebrow">
        <TextInput value={section.eyebrow ?? ""} onChange={(v) => onChange({ eyebrow: v })} />
      </Field>
      <Field label="Heading">
        <TextInput value={section.heading ?? ""} onChange={(v) => onChange({ heading: v })} />
      </Field>
      <Field label="Body (Markdown: paragraphs, **bold**, *italic*, [links](href), - bullets)">
        <TextArea value={section.body} onChange={(v) => onChange({ body: v })} rows={10} />
      </Field>
    </>
  );
}

function CtaBannerForm({ section, onChange }: { section: CtaBannerSection; onChange: (patch: Partial<CtaBannerSection>) => void }) {
  return (
    <>
      <Field label="Eyebrow">
        <TextInput value={section.eyebrow ?? ""} onChange={(v) => onChange({ eyebrow: v })} />
      </Field>
      <Field label="Headline (Markdown: **bold**, *italic*)">
        <TextInput value={section.headline} onChange={(v) => onChange({ headline: v })} />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <Field label="Primary CTA label">
          <TextInput value={section.primaryCtaLabel ?? ""} onChange={(v) => onChange({ primaryCtaLabel: v })} />
        </Field>
        <Field label="Primary CTA href">
          <TextInput value={section.primaryCtaHref ?? ""} onChange={(v) => onChange({ primaryCtaHref: v })} />
        </Field>
        <Field label="Secondary CTA label">
          <TextInput value={section.secondaryCtaLabel ?? ""} onChange={(v) => onChange({ secondaryCtaLabel: v })} />
        </Field>
        <Field label="Secondary CTA href">
          <TextInput value={section.secondaryCtaHref ?? ""} onChange={(v) => onChange({ secondaryCtaHref: v })} />
        </Field>
      </div>
      <Field label="Variant">
        <select value={section.variant ?? "DARK"} onChange={(e) => onChange({ variant: e.target.value as "DARK" | "LIGHT" })} style={selectStyle}>
          <option value="DARK">Dark (charcoal background)</option>
          <option value="LIGHT">Light (olive tint background)</option>
        </select>
      </Field>
    </>
  );
}

/* ─── Phase-1 structured-block forms ───────────────────────────────────── */

function ProcessStepsForm({
  section,
  onChange,
}: {
  section: Extract<Section, { type: "PROCESS_STEPS" }>;
  onChange: (patch: Partial<Extract<Section, { type: "PROCESS_STEPS" }>>) => void;
}) {
  function setStep(i: number, patch: Partial<{ n: string; title: string; body: string }>) {
    const next = section.steps.map((s, j) => (j === i ? { ...s, ...patch } : s));
    onChange({ steps: next });
  }
  function addStep() {
    const n = String(section.steps.length + 1).padStart(2, "0");
    onChange({ steps: [...section.steps, { n, title: "New step", body: "" }] });
  }
  function removeStep(i: number) {
    if (!confirm("Remove this step?")) return;
    onChange({ steps: section.steps.filter((_, j) => j !== i) });
  }
  return (
    <>
      <Field label="Eyebrow"><TextInput value={section.eyebrow ?? ""} onChange={(v) => onChange({ eyebrow: v })} /></Field>
      <Field label="Heading (Markdown allowed)"><TextInput value={section.heading ?? ""} onChange={(v) => onChange({ heading: v })} /></Field>
      <Field label="Intro paragraph"><TextArea value={section.intro ?? ""} onChange={(v) => onChange({ intro: v })} /></Field>
      <Field label="Steps">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {section.steps.map((s, i) => (
            <div key={i} style={{ border: "0.5px solid var(--border)", padding: "0.75rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "80px 1fr auto", gap: "0.5rem", alignItems: "start" }}>
                <input value={s.n} onChange={(e) => setStep(i, { n: e.target.value })} placeholder="01" style={{ width: "100%", border: "0.5px solid var(--border)", background: "transparent", padding: "0.4rem", fontSize: "0.85rem" }} />
                <input value={s.title} onChange={(e) => setStep(i, { title: e.target.value })} placeholder="Step title" style={{ width: "100%", border: "0.5px solid var(--border)", background: "transparent", padding: "0.4rem", fontSize: "0.85rem" }} />
                <button type="button" onClick={() => removeStep(i)} style={mini}>×</button>
              </div>
              <textarea value={s.body} onChange={(e) => setStep(i, { body: e.target.value })} placeholder="Step body" rows={3} style={{ marginTop: "0.4rem", width: "100%", border: "0.5px solid var(--border)", background: "transparent", padding: "0.4rem", fontSize: "0.85rem", resize: "vertical" }} />
            </div>
          ))}
          <button type="button" onClick={addStep} style={addBtn}>+ Add step</button>
        </div>
      </Field>
    </>
  );
}

function PackageCardsForm({
  section,
  onChange,
}: {
  section: Extract<Section, { type: "PACKAGE_CARDS" }>;
  onChange: (patch: Partial<Extract<Section, { type: "PACKAGE_CARDS" }>>) => void;
}) {
  function updatePkg(i: number, patch: Partial<Extract<Section, { type: "PACKAGE_CARDS" }>["packages"][number]>) {
    const next = section.packages.map((p, j) => (j === i ? { ...p, ...patch } : p));
    onChange({ packages: next });
  }
  function addPkg() {
    onChange({
      packages: [
        ...section.packages,
        {
          id: `pkg-${Math.random().toString(36).slice(2, 6)}`,
          name: "New package",
          startingPriceUsd: 0,
          sessionType: "Portrait",
          includes: [],
          idealFor: "",
        },
      ],
    });
  }
  function removePkg(i: number) {
    if (!confirm("Remove this package?")) return;
    onChange({ packages: section.packages.filter((_, j) => j !== i) });
  }
  return (
    <>
      <Field label="Eyebrow"><TextInput value={section.eyebrow ?? ""} onChange={(v) => onChange({ eyebrow: v })} /></Field>
      <Field label="Heading (Markdown allowed)"><TextInput value={section.heading ?? ""} onChange={(v) => onChange({ heading: v })} /></Field>
      <Field label="Intro paragraph"><TextArea value={section.intro ?? ""} onChange={(v) => onChange({ intro: v })} /></Field>
      <Field label="Packages">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {section.packages.map((p, i) => (
            <div key={p.id} style={{ border: "0.5px solid var(--border)", padding: "0.75rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 110px auto", gap: "0.5rem", alignItems: "start" }}>
                <input value={p.name} onChange={(e) => updatePkg(i, { name: e.target.value })} placeholder="Package name" style={{ border: "0.5px solid var(--border)", background: "transparent", padding: "0.4rem", fontSize: "0.85rem" }} />
                <input type="number" min={0} step={25} value={p.startingPriceUsd} onChange={(e) => updatePkg(i, { startingPriceUsd: Number(e.target.value) || 0 })} style={{ border: "0.5px solid var(--border)", background: "transparent", padding: "0.4rem", fontSize: "0.85rem" }} />
                <button type="button" onClick={() => removePkg(i)} style={mini}>×</button>
              </div>
              <input value={p.sessionType} onChange={(e) => updatePkg(i, { sessionType: e.target.value })} placeholder="sessionType (Portrait, Family, …)" style={{ marginTop: "0.4rem", width: "100%", border: "0.5px solid var(--border)", background: "transparent", padding: "0.4rem", fontSize: "0.85rem" }} />
              <textarea value={p.includes.join("\n")} onChange={(e) => updatePkg(i, { includes: e.target.value.split("\n").filter(Boolean) })} placeholder="Inclusions — one per line" rows={4} style={{ marginTop: "0.4rem", width: "100%", border: "0.5px solid var(--border)", background: "transparent", padding: "0.4rem", fontSize: "0.85rem", resize: "vertical" }} />
              <input value={p.idealFor} onChange={(e) => updatePkg(i, { idealFor: e.target.value })} placeholder="Ideal for…" style={{ marginTop: "0.4rem", width: "100%", border: "0.5px solid var(--border)", background: "transparent", padding: "0.4rem", fontSize: "0.85rem" }} />
              <input value={p.id} onChange={(e) => updatePkg(i, { id: e.target.value.trim() })} placeholder="slug (controls ?package=)" style={{ marginTop: "0.4rem", width: "100%", border: "0.5px solid var(--border)", background: "transparent", padding: "0.4rem", fontSize: "0.85rem" }} />
            </div>
          ))}
          <button type="button" onClick={addPkg} style={addBtn}>+ Add package</button>
        </div>
      </Field>
    </>
  );
}

function TestimonialForm({
  section,
  onChange,
}: {
  section: Extract<Section, { type: "TESTIMONIAL" }>;
  onChange: (patch: Partial<Extract<Section, { type: "TESTIMONIAL" }>>) => void;
}) {
  return (
    <>
      <Field label="Eyebrow"><TextInput value={section.eyebrow ?? ""} onChange={(v) => onChange({ eyebrow: v })} /></Field>
      <Field label="Quote"><TextArea value={section.quote} onChange={(v) => onChange({ quote: v })} rows={6} /></Field>
      <Field label="Author"><TextInput value={section.author ?? ""} onChange={(v) => onChange({ author: v })} /></Field>
      <Field label="Author role / context"><TextInput value={section.authorRole ?? ""} onChange={(v) => onChange({ authorRole: v })} /></Field>
      <Field label="Variant">
        <select value={section.variant ?? "DARK"} onChange={(e) => onChange({ variant: e.target.value as "DARK" | "LIGHT" })} style={selectStyle}>
          <option value="DARK">Dark</option>
          <option value="LIGHT">Light</option>
        </select>
      </Field>
    </>
  );
}

function SlideshowForm({
  section,
  onChange,
  onPickSlide,
  onPickAdd,
}: {
  section: Extract<Section, { type: "SLIDESHOW" }>;
  onChange: (patch: Partial<Extract<Section, { type: "SLIDESHOW" }>>) => void;
  onPickSlide: (index: number) => void;
  onPickAdd: () => void;
}) {
  return (
    <>
      <Field label="Eyebrow"><TextInput value={section.eyebrow ?? ""} onChange={(v) => onChange({ eyebrow: v })} /></Field>
      <Field label="Heading"><TextInput value={section.heading ?? ""} onChange={(v) => onChange({ heading: v })} /></Field>
      <Field label="Cycle interval (ms — 1500-30000)">
        <input
          type="number"
          min={1500}
          max={30000}
          step={500}
          value={section.intervalMs ?? 5000}
          onChange={(e) => onChange({ intervalMs: Number(e.target.value) || 5000 })}
          style={{ width: "100%", border: "0.5px solid var(--border)", background: "transparent", padding: "0.55rem 0.65rem", fontSize: "0.9rem", fontFamily: "inherit" }}
        />
      </Field>
      <Field label="Slides">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.5rem", marginBottom: "0.5rem" }}>
          {section.slides.map((slide, i) => (
            <div key={i} style={{ border: "0.5px solid var(--border)", padding: "0.4rem" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={buildCdnUrl(slide.cloudflareImageId, "thumbnail")} alt="" style={{ width: "100%", height: "90px", objectFit: "cover" }} />
              <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.3rem" }}>
                <button type="button" onClick={() => onPickSlide(i)} style={mini}>Swap</button>
                <button type="button" onClick={() => onChange({ slides: section.slides.filter((_, j) => j !== i) })} style={mini}>Remove</button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={onPickAdd} style={addBtn}>+ Add slide</button>
      </Field>
    </>
  );
}

function StatsForm({
  section,
  onChange,
}: {
  section: Extract<Section, { type: "STATS" }>;
  onChange: (patch: Partial<Extract<Section, { type: "STATS" }>>) => void;
}) {
  function setItem(i: number, patch: Partial<{ number: string; label: string }>) {
    const next = section.items.map((it, j) => (j === i ? { ...it, ...patch } : it));
    onChange({ items: next });
  }
  return (
    <>
      <Field label="Stats">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {section.items.map((it, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "100px 1fr auto", gap: "0.4rem", alignItems: "center" }}>
              <input value={it.number} onChange={(e) => setItem(i, { number: e.target.value })} placeholder="340+" style={{ border: "0.5px solid var(--border)", background: "transparent", padding: "0.4rem", fontSize: "0.85rem" }} />
              <input value={it.label} onChange={(e) => setItem(i, { label: e.target.value })} placeholder="Sessions Completed" style={{ border: "0.5px solid var(--border)", background: "transparent", padding: "0.4rem", fontSize: "0.85rem" }} />
              <button type="button" onClick={() => onChange({ items: section.items.filter((_, j) => j !== i) })} style={mini}>×</button>
            </div>
          ))}
          <button type="button" onClick={() => onChange({ items: [...section.items, { number: "", label: "" }] })} style={addBtn}>+ Add stat</button>
        </div>
      </Field>
    </>
  );
}

/* ─── form primitives ──────────────────────────────────────────────────── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: "1rem" }}>
      <span style={{ display: "block", fontSize: "0.65rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--charcoal-muted)", marginBottom: "0.4rem" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%",
        border: "0.5px solid var(--border)",
        background: "transparent",
        padding: "0.55rem 0.65rem",
        fontSize: "0.9rem",
        color: "var(--charcoal)",
        fontFamily: "inherit",
      }}
    />
  );
}

function TextArea({ value, onChange, rows = 4 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      style={{
        width: "100%",
        border: "0.5px solid var(--border)",
        background: "transparent",
        padding: "0.55rem 0.65rem",
        fontSize: "0.9rem",
        color: "var(--charcoal)",
        fontFamily: "inherit",
        lineHeight: 1.6,
        resize: "vertical",
      }}
    />
  );
}

const iconBtn: React.CSSProperties = {
  width: 28,
  border: "0.5px solid var(--border)",
  background: "transparent",
  cursor: "pointer",
  fontSize: "0.85rem",
  color: "var(--charcoal-light)",
};

const addBtn: React.CSSProperties = {
  width: "100%",
  border: "0.5px dashed var(--border-strong)",
  background: "transparent",
  padding: "0.45rem 0.6rem",
  fontSize: "0.78rem",
  color: "var(--charcoal-light)",
  cursor: "pointer",
  textAlign: "left",
};

const primaryBtn: React.CSSProperties = {
  padding: "0.6rem 1rem",
  fontSize: "0.72rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  background: "var(--charcoal)",
  color: "var(--white)",
  border: "none",
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  padding: "0.6rem 1rem",
  fontSize: "0.72rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  background: "transparent",
  color: "var(--charcoal-light)",
  border: "0.5px solid var(--border)",
  cursor: "pointer",
};

const publishBtn: React.CSSProperties = {
  padding: "0.6rem 1rem",
  fontSize: "0.72rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  background: "var(--olive)",
  color: "var(--white)",
  border: "none",
  cursor: "pointer",
};

const mini: React.CSSProperties = {
  padding: "0.25rem 0.45rem",
  fontSize: "0.7rem",
  background: "transparent",
  border: "0.5px solid var(--border)",
  color: "var(--charcoal-light)",
  cursor: "pointer",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  border: "0.5px solid var(--border)",
  background: "transparent",
  padding: "0.55rem 0.65rem",
  fontSize: "0.9rem",
  color: "var(--charcoal)",
  fontFamily: "inherit",
};
