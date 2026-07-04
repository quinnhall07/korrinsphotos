# Content Engine + Editor v2 Implementation Plan (SP2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build goldenrod's sections content engine and in-place WYSIWYG editor — v1's architecture, hardened, with 17 section types, global settings, per-page SEO, and full keyboard accessibility.

**Architecture:** Zod-v4-first schemas (`z.infer` types, zero duplicate interfaces); Firestore draft/publish/revisions with optimistic concurrency (`draftRev`); a single shared `renderSection(section, edit?)` path where the live page is the editor canvas (no iframe); editor chrome composed from the foundation's Radix primitives.

**Tech Stack:** Next.js 16 App Router, Zod 4 (installed), dnd-kit (new, exact-pinned), Radix Accordion (new), foundation primitives/tokens/session/storage.

## Global Constraints

- Repo: `C:\Users\danie\Documents\GitHub\goldenrod`. Reference repo (read-only): `C:\Users\danie\Documents\GitHub\korrinsphotos` (**REF**). Port convention: "Port REF `<path>`" = copy that file, fix imports to goldenrod paths, then apply ONLY the deltas listed.
- **PR flow (mandatory this sub-project):** each task = branch `sp2/task-<n>-<slug>` off fresh `main` → push → `gh pr create --fill` → `gh pr merge --squash --auto --delete-branch` → `gh pr checks --watch` until green → confirm merged → `git checkout main && git pull`. Never push to main directly.
- Brand tokens/utilities (already in repo): `bg-surface`, `text-surface-fg`, `text-surface-muted`, `text-accent`, `bg-accent`, `text-nightfall`, `bg-(--surface-raised)`, `rounded-brand`, `font-display`, `font-ui`, `ease-cinematic`, `duration-(--duration-cine-fast)` (NEVER bare `duration-cine-*`), `z-(--z-overlay)`, `z-(--z-toast)`. No inline styles, no raw hexes (Wordmark exemption stands). Marketing sections render on the dark surface.
- Foundation interfaces available: `requireAdmin()/getSessionOrNull()` (`@/lib/session`), `adminDb` (`@/lib/firebase-admin`), `buildCdnUrl(imageId, variant?)` + R2 presign helpers (`@/lib/storage/*`), primitives (`@/components/ui/*`), `Surface`, `Wordmark`, `toast`/`Toaster`.
- Exact-pin policy: new deps installed with the pinned npm flow — `npx -y npm@11.16.0 install <pkg>@<ver> --save-exact` then `npx -y npm@11.16.0 ci` sanity. New deps this plan: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `@radix-ui/react-accordion` (current stable at install time).
- Zero-warning baseline: `npm run lint`, `npm run typecheck`, `npm test` must be clean at every task's end.
- Markdown safety: only `**bold**`, `*italic*`, `[label](href)` (http(s)/root-relative), `- ` bullets; everything else escaped. No HTML stored or rendered raw, ever.
- Commit messages: conventional, ending with
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- SEO/env: canonical URL base is `NEXT_PUBLIC_APP_URL`.

## File structure (locked)

```
lib/site-content/schema.ts          # Zod source of truth: PhotoRef, all 17 sections, factories
lib/site-content/registry.ts        # SITE_PAGES, allowedSections, reserved slugs
lib/site-content/markdown.ts        # allow-list renderer (port + toolbar helpers)
lib/site-content/render.tsx         # renderSection/renderSections + blocks/ imports
lib/site-content/blocks/*.tsx       # one file per section block (17)
lib/site-content/edit-context.ts    # EditContext seam (pure types)
lib/db/site-content.ts              # pages: draft/publish/revisions + draftRev concurrency
lib/db/site-settings.ts             # siteSettings/global: same workflow
app/actions/site-content.ts         # "use server" actions (pages)
app/actions/site-settings.ts        # "use server" actions (settings)
app/preview/[pageId]/page.tsx       # SectionsPage host route (SP3 mounts real routes on same host)
components/site-editor/*            # canvas, chrome, hooks, forms/, pickers (ported+hardened)
components/ui/Accordion.tsx         # Radix accordion primitive (FAQ + drawer groups)
e2e/editor.spec.ts                  # acceptance flows
```

---

### Task 1: Schema core + registry (Zod source of truth)

**Files:**
- Create: `lib/site-content/schema.ts`, `lib/site-content/registry.ts`
- Test: `lib/site-content/schema.test.ts`

**Interfaces:**
- Produces: `PhotoRefSchema`/`PhotoRef`; `SectionSchema` (discriminated union on `type`) / `Section`; per-type schemas `HeroSectionSchema` … ; `SECTION_TYPES: readonly string[]`; `blankSection(type: SectionType): Section` (valid factory per type, `id` = `crypto.randomUUID()`); `SectionsArraySchema` (max 40); registry: `SITE_PAGES: Record<string, {title: string; publicPath: string; allowedSections: SectionType[]}>` seeded with `home`, `portfolio`, `pricing`, `booking` (+ `footerAllowed` list), `CUSTOM_PAGE_ALLOWED_SECTIONS`, `isReservedSlug(slug)`, `isSectionTypeAllowedForPage(pageId, type)`.

- [ ] **Step 1: Failing test** — `lib/site-content/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  SECTION_TYPES,
  SectionSchema,
  SectionsArraySchema,
  blankSection,
} from "./schema";
import { isSectionTypeAllowedForPage, isReservedSlug } from "./registry";

describe("section schemas", () => {
  it("every factory output round-trips its schema", () => {
    for (const type of SECTION_TYPES) {
      const s = blankSection(type);
      const parsed = SectionSchema.safeParse(s);
      expect(parsed.success, `${type}: ${JSON.stringify(parsed.error?.issues)}`).toBe(true);
      expect(parsed.success && parsed.data.type).toBe(type);
    }
  });
  it("has all 17 types", () => {
    expect(SECTION_TYPES).toHaveLength(17);
    expect(SECTION_TYPES).toContain("BEFORE_AFTER");
    expect(SECTION_TYPES).toContain("FIND_YOUR_GALLERY");
  });
  it("rejects unknown type and oversized arrays", () => {
    expect(SectionSchema.safeParse({ id: "x", type: "NOPE" }).success).toBe(false);
    expect(
      SectionsArraySchema.safeParse(Array.from({ length: 41 }, () => blankSection("RICH_TEXT"))).success,
    ).toBe(false);
  });
  it("HERO carries exactly one slide", () => {
    const hero = blankSection("HERO");
    expect(hero.type === "HERO" && "slide" in hero).toBe(true);
    // @ts-expect-error slides array must not exist on HERO
    void (hero as { slides?: unknown }).slides;
  });
  it("VIDEO accepts either upload or embed source", () => {
    const v = blankSection("VIDEO");
    expect(SectionSchema.safeParse({ ...v, source: { kind: "embed", url: "https://youtu.be/x" } }).success).toBe(true);
    expect(SectionSchema.safeParse({ ...v, source: { kind: "embed", url: "javascript:alert(1)" } }).success).toBe(false);
  });
  it("registry allow-lists work", () => {
    expect(isSectionTypeAllowedForPage("booking", "BOOKING_FORM")).toBe(true);
    expect(isSectionTypeAllowedForPage("home", "BOOKING_FORM")).toBe(false);
    expect(isReservedSlug("admin")).toBe(true);
  });
});
```

Run: `npm test lib/site-content` → FAIL (module not found).

- [ ] **Step 2: Implement `schema.ts`.** Shape (write ALL 17 — the fields for the 10 carried types come verbatim from REF `lib/site-content/types.ts`, converted to Zod; the pattern below shows the full mechanics — repeat it per type):

```ts
import { z } from "zod";

const SafeHref = z
  .string()
  .max(2000)
  .refine((h) => /^(https?:\/\/|\/(?!\/))/.test(h), "http(s) or root-relative only");

export const PhotoRefSchema = z.object({
  source: z.enum(["PROJECT", "SITE"]),
  id: z.string().min(1),
  cloudflareImageId: z.string().min(1),
  eventId: z.string().optional(),
  altText: z.string().max(300).default(""),
  focalX: z.number().min(0).max(1).default(0.5),
  focalY: z.number().min(0).max(1).default(0.5),
});
export type PhotoRef = z.infer<typeof PhotoRefSchema>;

const base = { id: z.string().min(1), hideOnMobile: z.boolean().default(false) };

export const HeroSectionSchema = z.object({
  ...base,
  type: z.literal("HERO"),
  slide: PhotoRefSchema.nullable().default(null), // exactly one (spec §5.6)
  eyebrow: z.string().max(120).default(""),
  headline: z.string().max(300).default(""),
  sub: z.string().max(500).default(""),
  primaryCtaLabel: z.string().max(60).default(""),
  primaryCtaHref: SafeHref.or(z.literal("")).default(""),
  secondaryCtaLabel: z.string().max(60).default(""),
  secondaryCtaHref: SafeHref.or(z.literal("")).default(""),
});

// … RICH_TEXT{eyebrow,heading,body≤20000}; CTA_BANNER{eyebrow,headline(min 1),primary/secondaryCta,variant DARK|LIGHT};
// PROCESS_STEPS{eyebrow,heading,intro,steps[{n,title,body}]≤12}; PACKAGE_CARDS{…packages[{id,name,startingPriceUsd 0..1_000_000,sessionType,includes≤20,idealFor,ctaLabel?}]≤6};
// TESTIMONIAL{quote(min 1),author,authorRole,variant}; SLIDESHOW{eyebrow,heading,slides PhotoRef[]≤20,intervalMs 1500..30000 default 5000};
// STATS{items[{number,label}]≤6}; BOOKING_FORM{eyebrow,heading,intro}; PHOTO_GRID (legacy: columns 2|3|4, photos≤24 — kept, hidden from add menu);
// FAQ{eyebrow,heading,items[{q≤300,a≤2000}]≤20}; CONTACT{eyebrow,heading,showEmail,showPhone,showHours,ctaLabel,ctaHref};
// GALLERY{eyebrow,heading,layout z.enum(["masonry","carousel","stack"]).default("masonry"),photos PhotoRef[]≤40};
// INSTAGRAM_STRIP{handle≤60,photos PhotoRef[]≤12}; BEFORE_AFTER{before PhotoRef.nullable,after PhotoRef.nullable,caption≤200};
// FIND_YOUR_GALLERY{heading,body,ctaLabel default "Find your gallery"}.

export const VideoSectionSchema = z.object({
  ...base,
  type: z.literal("VIDEO"),
  eyebrow: z.string().max(120).default(""),
  heading: z.string().max(200).default(""),
  source: z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("upload"), storageKey: z.string().min(1), posterRef: PhotoRefSchema.nullable() }),
      z.object({
        kind: z.literal("embed"),
        url: z
          .string()
          .url()
          .refine((u) => /^https:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com)\//.test(u), "YouTube/Vimeo only"),
      }),
    ])
    .nullable()
    .default(null),
});

export const SectionSchema = z.discriminatedUnion("type", [
  HeroSectionSchema, /* …all 17 */
]);
export type Section = z.infer<typeof SectionSchema>;
export type SectionType = Section["type"];
export const SECTION_TYPES = [/* all 17 literals, order = add-menu order */] as const;
export const SectionsArraySchema = z.array(SectionSchema).max(40);

export function blankSection(type: SectionType): Section {
  // switch over type returning schema.parse({ id: crypto.randomUUID(), type, …minimal valid seed })
}
```

`registry.ts`: port REF `lib/site-content/page-registry.ts` + `lib/site-content/slugs.ts` (merged into one module), updating `allowedSections` to include the new types (GALLERY/FAQ/VIDEO/CONTACT/INSTAGRAM_STRIP/BEFORE_AFTER/FIND_YOUR_GALLERY allowed on all four built-ins; BOOKING_FORM only on `booking`; PHOTO_GRID excluded from `CUSTOM_PAGE_ALLOWED_SECTIONS` and from every add-menu list but still parseable).

- [ ] **Step 3:** `npm test lib/site-content` → PASS. `npm run typecheck` → clean.
- [ ] **Step 4: Branch/PR per Global Constraints** — commit `feat(sp2): zod section schemas + page registry (17 types)`.

---

### Task 2: Markdown renderer + toolbar helpers

**Files:**
- Create: `lib/site-content/markdown.ts`
- Test: `lib/site-content/markdown.test.ts`

**Interfaces:**
- Produces: `renderInlineMarkdown(src): string` (bold/italic/links), `renderConstrainedMarkdown(src): string` (adds `- ` bullets/paragraphs), both returning sanitized HTML strings; `wrapSelection(src, start, end, marker: "**" | "*"): {next: string; selStart: number; selEnd: number}` and `insertLink(src, start, end, href): {next; selStart; selEnd}` — pure helpers the toolbar (Task 8) calls on the markdown source string.

- [ ] **Step 1: Failing tests** — `lib/site-content/markdown.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { renderInlineMarkdown, renderConstrainedMarkdown, wrapSelection, insertLink } from "./markdown";

describe("renderer", () => {
  it("renders the allow-list", () => {
    expect(renderInlineMarkdown("a **b** *c* [d](/e)")).toBe(
      'a <strong>b</strong> <em>c</em> <a href="/e">d</a>',
    );
  });
  it("escapes HTML and blocks unsafe hrefs", () => {
    expect(renderInlineMarkdown('<img src=x onerror=alert(1)>')).not.toContain("<img");
    expect(renderInlineMarkdown("[x](javascript:alert(1))")).not.toContain("javascript:");
    expect(renderConstrainedMarkdown("<script>1</script>")).not.toContain("<script>");
  });
  it("bullets only in constrained mode", () => {
    expect(renderConstrainedMarkdown("- a\n- b")).toContain("<ul>");
    expect(renderInlineMarkdown("- a")).not.toContain("<ul>");
  });
});

describe("toolbar helpers", () => {
  it("wraps a selection in bold markers", () => {
    expect(wrapSelection("hello world", 6, 11, "**")).toEqual({
      next: "hello **world**",
      selStart: 8,
      selEnd: 13,
    });
  });
  it("unwraps when already wrapped (toggle)", () => {
    expect(wrapSelection("hello **world**", 8, 13, "**")).toEqual({
      next: "hello world",
      selStart: 6,
      selEnd: 11,
    });
  });
  it("inserts a link around the selection", () => {
    expect(insertLink("see docs", 4, 8, "/docs")).toEqual({
      next: "see [docs](/docs)",
      selStart: 5,
      selEnd: 9,
    });
  });
});
```

Run → FAIL.

- [ ] **Step 2:** Port REF `lib/site-content/markdown.ts` verbatim for the two render functions (it is the audited XSS-safe implementation). Append the two pure toolbar helpers:

```ts
export function wrapSelection(
  src: string,
  start: number,
  end: number,
  marker: "**" | "*",
): { next: string; selStart: number; selEnd: number } {
  const m = marker.length;
  const before = src.slice(start - m, start);
  const after = src.slice(end, end + m);
  if (before === marker && after === marker) {
    // toggle off
    return {
      next: src.slice(0, start - m) + src.slice(start, end) + src.slice(end + m),
      selStart: start - m,
      selEnd: end - m,
    };
  }
  return {
    next: src.slice(0, start) + marker + src.slice(start, end) + marker + src.slice(end),
    selStart: start + m,
    selEnd: end + m,
  };
}

export function insertLink(
  src: string,
  start: number,
  end: number,
  href: string,
): { next: string; selStart: number; selEnd: number } {
  const label = src.slice(start, end) || "link";
  const insert = `[${label}](${href})`;
  return {
    next: src.slice(0, start) + insert + src.slice(end),
    selStart: start + 1,
    selEnd: start + 1 + label.length,
  };
}
```

(Adjust the wrap test's expected offsets only if the REF escaping changes lengths — the helpers operate on raw source, so they should match as written.)

- [ ] **Step 3:** `npm test markdown` → PASS.
- [ ] **Step 4: Branch/PR** — `feat(sp2): allow-list markdown renderer + toolbar source helpers`.

---

### Task 3: Persistence — pages + settings with optimistic concurrency

**Files:**
- Create: `lib/db/site-content.ts`, `lib/db/site-settings.ts`
- Test: `lib/db/site-content.test.ts`

**Interfaces:**
- Produces (`site-content.ts`): `SiteContentDoc {draftSections: Section[]; publishedSections: Section[]; draftRev: number; draftDirty: boolean; draftUpdatedAt/By; publishedAt/By; seo?: PageSeo}`; `PageSeo {seoTitle?; seoDescription?; ogImage?: PhotoRef | null; noindex?: boolean}`; `loadPublishedSections(pageId): Promise<Section[] | null>`; `loadDraft(pageId): Promise<{sections: Section[]; draftRev: number} | null>`; `saveDraft(pageId, sections, baseRev, uid): Promise<{ok: true; draftRev: number} | {ok: false; conflict: true; draftRev: number}>` (Firestore transaction: read doc, if `doc.draftRev !== baseRev` return conflict, else write sections + `draftRev+1`); `publishDraft(pageId, uid, note?)`, `discardDraft(pageId, uid)`, `restoreRevision(pageId, revisionId, uid)`, `listRevisions(pageId, limit = 50)`, `REVISIONS_CAP = 50`; `getPageSeo/savePageSeo(pageId, seo, uid)`; custom pages: `createCustomPage(slug, uid)`, `deleteCustomPage(slug, uid)`, `listCustomPages()`.
- Produces (`site-settings.ts`): `SiteSettingsSchema` (Zod, in this file, exported): `{nav: {label≤40, href SafeHref-or-pageId, visible}[] ≤12; logo: {mode: "wordmark"} | {mode: "image"; ref: PhotoRef}; footerBody: string≤5000; socials: {platform: enum[instagram,tiktok,facebook,pinterest,youtube,x], url}[] ≤8; announcement: {enabled, text≤200, href?: SafeHref}; business: {email?, phone?, city?, hours?}}` + `SiteSettings` type; `loadPublishedSettings()`, `loadDraftSettings()`, `saveSettingsDraft(settings, baseRev, uid)` (same conflict contract), `publishSettings(uid)`.

- [ ] **Step 1: Failing tests** (mock `@/lib/firebase-admin` with `vi.hoisted`; model `adminDb.runTransaction` invoking its callback with `{get, set, update}` spies — same pattern as `lib/db/users.test.ts`):

```ts
// lib/db/site-content.test.ts — core cases:
it("saveDraft succeeds when baseRev matches and bumps draftRev", async () => { /* tx.get -> {exists:true, data:()=>({draftRev:3})}; expect update with draftRev:4, ok:true */ });
it("saveDraft returns conflict without writing when baseRev is stale", async () => { /* draftRev:5 vs baseRev:3 -> {ok:false,conflict:true,draftRev:5}; tx.update NOT called */ });
it("saveDraft treats a missing doc as draftRev 0 and creates it", async () => {});
it("publishDraft snapshots a revision then copies draft->published", async () => {});
it("restoreRevision writes into DRAFT (never straight to published)", async () => {});
```

Run → FAIL.

- [ ] **Step 2: Implement.** Reference REF `lib/db/site-content.ts` for the publish/discard/restore/revisions/prune mechanics (port them), then apply deltas: (a) add `draftRev` + the transactional `saveDraft` above (REF's unconditional overwrite is the audited last-write-wins bug — do not port it); (b) add the `seo` field + helpers; (c) sections validated at the action layer, so db helpers accept `Section[]` (typed) and store plain JSON. `site-settings.ts` is new code following the exact same module shape against `siteSettings/global` (+ `siteSettings/global/revisions` capped 20).

- [ ] **Step 3:** `npm test lib/db` → PASS. Typecheck clean.
- [ ] **Step 4: Branch/PR** — `feat(sp2): site-content + site-settings persistence with draftRev concurrency`.

---

### Task 4: Server actions

**Files:**
- Create: `app/actions/site-content.ts`, `app/actions/site-settings.ts`
- Test: `app/actions/site-content.test.ts`

**Interfaces:**
- Produces (all `"use server"`, all `await requireAdmin()` first line, all return serializable results):
  `saveDraftAction(pageId: string, sectionsJson: string, baseRev: number): Promise<{ok: true; draftRev: number} | {ok: false; error: string} | {ok: false; conflict: true; draftRev: number}>` — parses JSON → `SectionsArraySchema` → per-page allow-list check (`isSectionTypeAllowedForPage`) → `saveDraft`;
  `publishDraftAction(pageId, note?)`, `discardDraftAction(pageId)`, `restoreRevisionAction(pageId, revisionId)`, `listRevisionsAction(pageId)` (Timestamps → ISO strings);
  `savePageSeoAction(pageId, seoJson)` (Zod `PageSeoSchema` added to schema.ts);
  `createCustomPageAction(slug)`, `deleteCustomPageAction(slug)`;
  `saveSettingsDraftAction(settingsJson, baseRev)`, `publishSettingsAction()`.
  Every publish revalidates the page's `publicPath` + `/preview/[pageId]`; settings publish revalidates all registered public paths.
- Consumes: Task 1 schemas/registry, Task 3 db helpers, `requireAdmin`.

- [ ] **Step 1: Failing tests** (mock `@/lib/session` requireAdmin → resolves `{uid:"admin1"}`; mock the db module):

```ts
it("rejects a section type not allowed on the page", async () => { /* BOOKING_FORM into home -> {ok:false, error contains "not allowed"} */ });
it("rejects invalid section payloads via Zod", async () => { /* HERO with focalX: 9 -> ok:false */ });
it("propagates conflict results untouched", async () => {});
it("requireAdmin gates every export", async () => { /* requireAdmin mock throws sentinel; each action rejects */ });
```

- [ ] **Step 2: Implement** following REF `app/admin/site/actions.ts`'s structure (guard → validate → allow-list → write → best-effort log → revalidate) but validating with Task 1's schemas (no duplicated Zod) and threading `baseRev`. Activity logging: `console.info("[site-content]", …)` for now (activity feed arrives in SP5) — one line, greppable.
- [ ] **Step 3:** Tests PASS; typecheck/lint clean.
- [ ] **Step 4: Branch/PR** — `feat(sp2): validated server actions for pages, seo, settings`.

---

### Task 5: Render layer — the 10 carried blocks + host route + catalog

**Files:**
- Create: `lib/site-content/render.tsx`, `lib/site-content/edit-context.ts`, `lib/site-content/blocks/{Hero,PhotoGrid,RichText,CtaBanner,ProcessSteps,PackageCards,Testimonial,Slideshow,Stats,BookingFormPlaceholder}.tsx`, `components/SectionsPage.tsx`, `app/preview/[pageId]/page.tsx`, `app/styleguide/sections/page.tsx`
- Test: `lib/site-content/blocks/blocks.test.tsx`

**Interfaces:**
- Produces: `EditContext {onText(sectionId, field, value): void; onImage(sectionId, slot: {field: string; index?: number}): void}` (pure types file); `renderSection(section: Section, edit?: EditContext): ReactNode`, `renderSections(sections, edit?)`; every block emits `data-section-id` + `data-section-type`, respects `hideOnMobile` (`max-md:hidden`); `SectionsPage({pageId, sections}: …)` server component host; `/preview/[pageId]` route (dynamic, loads published sections — `notFound()` for unregistered non-custom ids; `robots: {index: false}`); `/styleguide/sections` renders `SECTION_TYPES.map(blankSection)` seeded with placeholder content for visual QA (acceptance criterion 1).
- Consumes: Task 1 schema, Task 2 markdown, `buildCdnUrl`, tokens.

- [ ] **Step 1: Failing smoke tests** — render each carried block via RTL and assert key content + `data-section-type`; assert read-mode purity (no `contentEditable` attributes when `edit` is undefined):

```tsx
it("renders every carried type in read mode with no editable affordances", () => {
  for (const type of CARRIED_TYPES) {
    const { container } = render(<>{renderSection(seeded(type))}</>);
    expect(container.querySelector(`[data-section-type="${type}"]`)).toBeTruthy();
    expect(container.querySelector("[contenteditable]")).toBeNull();
  }
});
```

- [ ] **Step 2: Implement.** ORDERING NOTE: `EditableText`/`EditableImage` do not exist yet (Task 8 creates them and retrofits them into these blocks). In THIS task, blocks render read-mode content only; the `edit?` param is accepted and used solely for `data-*` attributes and the STATS empty-state placeholder — no editable affordances yet. Port each REF block's JSX structure from REF `lib/site-content/render.tsx` (it's one 777-line file — split into `blocks/` files here), restyled onto goldenrod tokens: ivory display headlines (`font-display`), gold eyebrows (`text-accent`, tracked uppercase), Nightfall ground, `Button`/`TextLink` primitives for CTAs. Deltas from REF: HERO renders its single `slide` (focal-point `object-position`); SLIDESHOW's inline `<script>` hack is replaced by a small `"use client"` crossfade component honoring `intervalMs` + reduced-motion; STATS renders an EmptyState placeholder in edit mode when `items` is empty; BOOKING_FORM renders a styled placeholder card ("Booking form — arrives with the booking flow") until SP3.
- [ ] **Step 3:** Tests PASS; visit `/styleguide/sections` in dev and visually confirm all 10 on the dark surface.
- [ ] **Step 4: Branch/PR** — `feat(sp2): shared render path + 10 carried section blocks + preview host`.

---

### Task 6: The 7 new blocks

**Files:**
- Create: `components/ui/Accordion.tsx`, `lib/site-content/blocks/{Faq,Video,Contact,Gallery,InstagramStrip,BeforeAfter,FindYourGallery}.tsx`
- Modify: `lib/site-content/render.tsx` (register blocks), `app/styleguide/sections/page.tsx` (seeded examples)
- Test: `lib/site-content/blocks/new-blocks.test.tsx`

**Interfaces:**
- Consumes: Task 5's block conventions; `@radix-ui/react-accordion` (install exact-pinned).
- Produces: all 17 types renderable. `BeforeAfter` is the flagship: a `"use client"` slider — pointer drag AND keyboard (`role="slider"`, arrow keys move 2% steps, Home/End) moving a clip-path divider between the two images.

- [ ] **Step 1: Failing tests** — FAQ toggles an item open (Radix roles); BEFORE_AFTER responds to ArrowRight by increasing `aria-valuenow`; VIDEO embed renders an iframe ONLY for the allow-listed hosts and never for others (defense-in-depth beyond schema); INSTAGRAM_STRIP renders handle link + images; GALLERY switches layout classes by variant.

```tsx
it("before/after keyboard moves the divider", async () => {
  render(<>{renderSection(seededBeforeAfter())}</>);
  const slider = screen.getByRole("slider");
  slider.focus();
  await userEvent.keyboard("{ArrowRight}");
  expect(Number(slider.getAttribute("aria-valuenow"))).toBeGreaterThan(50);
});
```

- [ ] **Step 2: Implement.** BeforeAfter core (complete):

```tsx
"use client";
import { useId, useRef, useState } from "react";
import { buildCdnUrl } from "@/lib/storage/images";
import type { PhotoRef } from "@/lib/site-content/schema";

export function BeforeAfterSlider({ before, after, caption }: { before: PhotoRef; after: PhotoRef; caption?: string }) {
  const [pct, setPct] = useState(50);
  const wrap = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const fromPointer = (clientX: number) => {
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return;
    setPct(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  };
  return (
    <figure>
      <div
        ref={wrap}
        className="relative select-none overflow-hidden rounded-brand"
        onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); fromPointer(e.clientX); }}
        onPointerMove={(e) => e.buttons === 1 && fromPointer(e.clientX)}
      >
        <img src={buildCdnUrl(after.cloudflareImageId, "gallery")} alt={after.altText} draggable={false} className="block w-full" />
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}>
          <img src={buildCdnUrl(before.cloudflareImageId, "gallery")} alt={before.altText} draggable={false} className="block w-full" />
        </div>
        <div
          role="slider"
          tabIndex={0}
          aria-labelledby={labelId}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          className="absolute inset-y-0 w-1 -translate-x-1/2 cursor-ew-resize bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          style={{ left: `${pct}%` }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") setPct((p) => Math.min(100, p + 2));
            if (e.key === "ArrowLeft") setPct((p) => Math.max(0, p - 2));
            if (e.key === "Home") setPct(0);
            if (e.key === "End") setPct(100);
          }}
        />
      </div>
      <figcaption id={labelId} className="mt-2 font-ui text-xs uppercase tracking-[0.2em] text-surface-muted">
        {caption || "Before / after"}
      </figcaption>
    </figure>
  );
}
```

Note: `clipPath`/`left` inline positional styles are DYNAMIC values (like Wordmark's variation settings) — document the exemption inline with a comment referencing CONVENTIONS §2. `Accordion.tsx` wraps Radix Accordion with token styling (trigger: `font-ui` uppercase + gold chevron rotation; content fade). VIDEO embed: privacy-enhanced hosts (`youtube-nocookie.com` rewrite), `loading="lazy"`, poster for uploads via `<video controls poster>` + presigned/CDN source resolution left as `storageKey` → R2 GET presign server-side in the block's server wrapper. CONTACT reads business info via props threaded from settings (render receives `settings?: SiteSettings` — add optional param to `renderSections`). FIND_YOUR_GALLERY: heading/body + `Button variant="primary"` linking `/login?next=/gallery`.

- [ ] **Step 3:** Tests PASS; `/styleguide/sections` shows all 17.
- [ ] **Step 4: Branch/PR** — `feat(sp2): seven new section blocks incl. accessible before/after`.

---

### Task 7: Editor state hooks — history, autosave, conflicts

**Files:**
- Create: `components/site-editor/useEditorHistory.ts`, `components/site-editor/useAutosave.ts`
- Test: `components/site-editor/hooks.test.ts`

**Interfaces:**
- Produces: `useEditorHistory(initial: Section[])` → `{sections, set(next, tag?), undo, redo, canUndo, canRedo, reset(next)}` (50-deep, consecutive same-tag coalescing);
  `useAutosave({pageId, sections, draftRev, onRevChange, onConflict})` → `{status: "saved" | "unsaved" | "saving" | "error", flush(): Promise<boolean>, suppressNext()}` — 900ms debounce, generation-counter race guard, calls `saveDraftAction(pageId, JSON.stringify(sections), draftRev)`; on `{conflict}` → `onConflict(serverRev)` and stops autosaving until reset; on error → `toast("Autosave failed — retrying")` + retry on next change AND a 10s timer.
- Consumes: Task 4 `saveDraftAction`, foundation `toast`.

- [ ] **Step 1: Failing tests** — port the behavioral cases from REF's hooks but as real tests (REF had none): coalescing (two same-tag sets → one undo step), history cap, autosave debounce fires action once for rapid edits (fake timers, mocked action), conflict path invokes `onConflict` and halts further saves, error path toasts and retries.
- [ ] **Step 2: Implement** — port REF `components/site-editor/useEditorHistory.ts` and `useAutosave.ts` logic, applying the deltas: `draftRev` threading, conflict halt, failure toast + 10s retry timer (`setTimeout` cleared on success/unmount).
- [ ] **Step 3:** Tests PASS.
- [ ] **Step 4: Branch/PR** — `feat(sp2): editor history + autosave hooks with conflict + failure handling`.

---

### Task 8: EditableText + markdown toolbar + EditableImage

**Files:**
- Create: `components/site-editor/EditableText.tsx`, `components/site-editor/TextToolbar.tsx`, `components/site-editor/EditableImage.tsx`
- Modify: `lib/site-content/blocks/*.tsx` — retrofit `EditableText`/`EditableImage` into every block's edit path (when `edit` is present), exactly as REF's blocks integrate them; read-mode output must remain byte-identical (extend Task 5's purity test to cover each block in edit mode too)
- Test: `components/site-editor/editable.test.tsx`

**Interfaces:**
- Produces: `EditableText({sectionId, field, value, markdown: "none" | "inline" | "block", edit?, className, as?})` — read mode renders via markdown functions; edit mode is a `contentEditable` (plaintext markdown source, ref-seeded via `useLayoutEffect` writing `textContent` — never React children), commit on blur through `edit.onText`, `role="textbox"` + `aria-multiline` per mode; while focused and a selection is non-collapsed, `TextToolbar` floats above the selection with Bold/Italic/Link buttons calling `wrapSelection`/`insertLink` (Task 2) on the source + restoring the selection; toolbar is keyboard-reachable (buttons in tab order while visible) and closes on Escape.
  `EditableImage({photoRef, onReplace, aspect?})` — hover/focus overlay with "Replace" button; `AddImageTile({onAdd})` dashed placeholder.
- Consumes: Task 2 helpers, Task 5 EditContext.

- [ ] **Step 1: Failing tests** — read mode renders `<strong>` for `**b**` and NO contenteditable; edit mode shows raw source; selecting text and clicking Bold produces `**`-wrapped source committed via `onText`; Escape closes toolbar; link button prompts via an inline mini-input (not `window.prompt`) and inserts `[label](href)`.
- [ ] **Step 2: Implement** — port REF `EditableText.tsx` (ref-seeding pattern is audited-correct), add the toolbar: track `selectionchange` while focused, compute source offsets from the DOM selection (plaintext node → direct `anchorOffset/focusOffset`), position `TextToolbar` via `getBoundingClientRect` of the range inside a relative wrapper. Toolbar buttons `onMouseDown={e => e.preventDefault()}` (keep focus), apply helper, set `el.textContent = next`, restore selection with `document.createRange`, fire input state. Complete the toolbar component (~80 lines) — buttons use `Button variant="ghost"` at `size="md"` with `VisuallyHidden` labels + visible B/I/link glyphs (`font-display` italic "I" is acceptable text, no icon lib).
- [ ] **Step 3:** Tests PASS; manual dev check on `/preview/home?edit=1` deferred until Task 9 wires the canvas (note it).
- [ ] **Step 4: Branch/PR** — `feat(sp2): editable text with selection markdown toolbar + editable image`.

---

### Task 9: Canvas + chrome (top bar, wrapper/toolbar, dnd with keyboard, add-section modal)

**Files:**
- Create: `components/site-editor/SectionsCanvas.tsx`, `EditorTopBar.tsx`, `SectionWrapper.tsx`, `SectionToolbar.tsx`, `AddSectionModal.tsx`, `FloatingEditPill.tsx`, `ConflictDialog.tsx`
- Modify: `app/preview/[pageId]/page.tsx` (mount canvas: admin + `?edit=1` loads draft + draftRev + pickerData), `app/layout.tsx` (mount `<Toaster />` once — first real consumer)
- Test: `components/site-editor/canvas.test.tsx`, plus dnd deps install

**Interfaces:**
- Consumes: everything above; `@dnd-kit/*` (install exact-pinned).
- Produces: `SectionsCanvas({pageId, initialSections, initialDraftRev, isAdmin, editParam, pickerData, settings})` — read path = `renderSections` + `FloatingEditPill`; edit path = full editor: EditorTopBar (status with `aria-live="polite"`, undo/redo buttons + Ctrl/Cmd+Z/Y, device preview widths [`100%`, `768px`, `390px`] via a centered max-width wrapper, Revisions/Discard/Publish/Exit), DndContext with `PointerSensor {activationConstraint: {distance: 6}}` AND `KeyboardSensor` with `sortableKeyboardCoordinates` (drag handle: `aria-roledescription="sortable"`, focusable), SectionWrapper hover/selected outline + SectionToolbar (drag handle ONLY dnd activator, duplicate, edit→drawer, delete→ConfirmDialog via foundation `Dialog`), AddSectionGap lines + AddSectionModal (tile gallery from `SECTION_TYPES` filtered by page allow-list, minus PHOTO_GRID), `ConflictDialog` (shown on autosave conflict: "Reload their draft" → refetch + `reset`; "Overwrite" → `saveDraftAction` with server rev).
- Publish/discard/restore flows: foundation `Dialog` with note field (publish), returning sections → `suppressNext()` + `reset` (no-flash, v1 pattern).

- [ ] **Step 1:** Install dnd deps (pinned flow). Failing tests: canvas read mode has no toolbar; edit mode renders top bar; keyboard reorder — focus drag handle, `{Space}{ArrowDown}{Space}` reorders two sections (assert order of `data-section-id`s); delete asks for confirmation; AddSectionModal excludes PHOTO_GRID and respects the page allow-list.
- [ ] **Step 2: Implement** — port REF `SectionsCanvas.tsx` structure with the deltas: foundation primitives for all dialogs, KeyboardSensor, ConflictDialog, `aria-live` status, `hideOnMobile` toggle in SectionToolbar (eye icon → updates section), Toaster mounted in root layout (remove any per-page Toasters in the styleguide while at it — resolves the known double-Toaster minor).
- [ ] **Step 3:** Tests PASS; dev-run `/preview/home?edit=1` (seed a draft via a temporary call or the styleguide seeds) and verify: inline edit, toolbar, drag (pointer + keyboard), add section, publish round-trip.
- [ ] **Step 4: Branch/PR** — `feat(sp2): editor canvas + chrome with keyboard dnd and conflict dialog`.

---

### Task 10: Drawer + per-type forms + photo picker + focal point

**Files:**
- Create: `components/site-editor/SectionDrawer.tsx`, `components/site-editor/forms/` (one form per editable type — 16; PHOTO_GRID legacy gets a read-only notice + "convert to GALLERY" button), `components/site-editor/PhotoPicker.tsx`, `components/site-editor/FocalPointPicker.tsx`, `app/api/site-assets/upload/route.ts`, `app/api/site-assets/confirm/route.ts`, `lib/db/site-assets.ts`
- Test: `components/site-editor/forms/forms.test.tsx`

**Interfaces:**
- Produces: `SectionDrawer({section, onChange, onClose, pickerData})` right-side panel (foundation styling, focus contained, Escape closes) delegating to `forms/<Type>Form`; forms are controlled editors over their section's fields using `Field/Input/Textarea/Select` + `PhotoPicker` + `FocalPointPicker`; every image slot shows alt-text input + focal control inline (spec §5.5). `PhotoPicker` = foundation `Dialog` with two tabs (Site library / Upload) — "From projects" tab arrives in SP4 when project galleries exist (leave a disabled tab with that note). Upload path: port REF `app/api/site-assets/{upload,confirm}/route.ts` + `lib/db/site-assets.ts` (admin-gated presign → PUT → Cloudflare ingest → `siteAssets` doc). `FocalPointPicker`: pointer drag + `role="slider"` per-axis arrow-key nudges (2% steps) + visible focus ring.
- Consumes: everything; storage layer.

- [ ] **Step 1: Failing tests** — HeroForm edits headline via drawer and fires `onChange` with valid section; FAQ form adds/removes items; every form renders without crashing for its `blankSection` (loop all 16); FocalPointPicker ArrowRight increases `focalX` by 0.02; alt-text input present wherever a PhotoRef is set.
- [ ] **Step 2: Implement** — port REF `SectionDrawer.tsx` + `forms/*` for the 10 carried types (restyle onto primitives); write the 6 new forms following the identical pattern (FAQ: item list with add/remove/reorder buttons; VIDEO: kind toggle + URL input with schema validation feedback / upload dropzone via presign; GALLERY: layout Select + photo list; CONTACT: toggles; INSTAGRAM_STRIP: handle + photos; BEFORE_AFTER: two picker slots + caption; FIND_YOUR_GALLERY: text fields). Convert-to-GALLERY: maps `photos`+`columns`→`layout:"masonry"`.
- [ ] **Step 3:** Tests PASS; manual drawer pass over all types in dev.
- [ ] **Step 4: Branch/PR** — `feat(sp2): section drawer + 16 forms + photo picker/focal with a11y`.

---

### Task 11: Global settings editor + SEO panel + settings rendering

**Files:**
- Create: `components/site-editor/SettingsPanel.tsx`, `components/site-editor/PageSeoPanel.tsx`, `components/SiteNav.tsx`, `components/SiteFooter.tsx`, `components/AnnouncementBar.tsx`
- Modify: `app/preview/[pageId]/page.tsx` (render nav/footer/announcement from published settings; emit SEO metadata via `generateMetadata`), `components/site-editor/EditorTopBar.tsx` (gear + page-settings buttons opening the panels)
- Test: `components/settings.test.tsx`, `app/preview/seo.test.ts`

**Interfaces:**
- Produces: `SiteNav({settings, currentPath})` (wordmark-or-image logo, ordered visible links, mobile disclosure menu — foundation Popover, keyboard operable); `SiteFooter({settings})` (footerBody constrained-markdown + social icon row — inline SVGs per platform); `AnnouncementBar({settings})` (dismissible, sessionStorage-remembered); `SettingsPanel` (drawer editing the full `SiteSettings` draft with its own draftRev + publish button); `PageSeoPanel` (drawer over `PageSeo`); `generateMetadata` on the host route: `seoTitle ?? "<PageTitle> — Goldenrod Photography"`, description, OG image (`buildCdnUrl(ogImage, "public")` else `/brand/og.png`), `robots: noindex` when set.
- Consumes: Task 3 settings module, Task 4 actions.

- [ ] **Step 1: Failing tests** — nav renders only `visible` links in order; announcement hidden when disabled; dismiss persists within session; `generateMetadata` output for a doc with/without overrides (unit-test the exported pure builder `buildPageMetadata(pageId, seo, settings)`); social URLs must pass SafeHref (schema already enforces — assert form surfaces the error).
- [ ] **Step 2: Implement.** Nav/footer/announcement are server components reading published settings (with in-memory `cache()` dedupe); editor edits the DRAFT copy via SettingsPanel with the same autosave/conflict machinery (reuse `useAutosave` with `saveSettingsDraftAction` via a thin adapter param `{action}` added to the hook — keep the hook generic). SettingsPanel also gains a **Pages tab**: lists built-in + custom pages (each linking to its `/preview/[pageId]?edit=1`), "New page" (slug input, kebab-validated, reserved-slug rejection surfaced from `createCustomPageAction`), and delete-with-confirm for custom pages only — this is the admin's entry point for custom pages (spec §2).
- [ ] **Step 3:** Tests PASS; dev check: change nav + announcement in editor, publish, confirm on `/preview/home` signed-out (second browser profile or incognito).
- [ ] **Step 4: Branch/PR** — `feat(sp2): global settings editing + nav/footer/announcement + per-page SEO`.

---

### Task 12: Acceptance e2e suite + hardening pass + docs

**Files:**
- Create: `e2e/editor.spec.ts`, `scripts/seed-preview-draft.ts` (dev seeding: writes a home draft via the db module for e2e; env-gated)
- Modify: `docs/CONVENTIONS.md` (editor conventions section), `CLAUDE.md` (editor pointers), `README.md` (routes note)
- Test: the e2e suite itself

**Interfaces:**
- Consumes: everything. Env-gated on `TEST_ADMIN_EMAIL/PASSWORD` + Firebase creds (skip cleanly without, same pattern as `e2e/auth.spec.ts`).

- [ ] **Step 1: Write the flows** (each an independent `test()`; sign-in helper shared from auth spec, extracted to `e2e/helpers.ts`):

```ts
test("edit → autosave → publish → public render", async ({ page, context }) => {
  await signInAdmin(page);
  await page.goto("/preview/home?edit=1");
  const headline = page.locator('[data-section-type="HERO"] [role="textbox"]').first();
  await headline.click();
  await headline.fill("The nights worth keeping — e2e");
  await page.locator("body").click(); // blur commits
  await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 });
  await page.reload();
  await expect(page.locator('[data-section-type="HERO"]')).toContainText("e2e");
  await page.getByRole("button", { name: /publish/i }).click();
  await page.getByRole("dialog").getByRole("button", { name: /publish/i }).click();
  const anon = await context.browser()!.newContext();
  const pub = await anon.newPage();
  await pub.goto("/preview/home");
  await expect(pub.locator('[data-section-type="HERO"]')).toContainText("e2e");
});
test("keyboard-only: reorder + focal point", async ({ page }) => { /* focus drag handle, Space/Arrow/Space; open drawer, arrow the focal slider, assert aria-valuenow changed */ });
test("add FAQ section via modal and publish", async ({ page }) => {});
test("nav + announcement publish appears publicly", async ({ page, context }) => {});
test("seo fields emit head metadata", async ({ page }) => { /* set seoTitle in panel, publish, assert <title> on public view */ });
test("markdown toolbar bolds selection", async ({ page }) => { /* select word, click B, blur, published source renders <strong> */ });
test("stale draft triggers conflict dialog", async ({ page, context }) => { /* two pages same admin, edit in A, then edit in B -> B sees conflict dialog */ });
```

- [ ] **Step 2:** Run env-gated locally (creds are in `.env.local` once the user provides them — if still absent, the suite must show SKIPPED and the task ships with unit/RTL coverage only; state which happened honestly in the PR body).
- [ ] **Step 3:** Docs: CONVENTIONS gains "Site editor" section (schema-first rule: new section types = schema → factory → block → form → allow-lists, one PR; the EditContext purity rule; markdown-source-only editing rule). Update the "Known limitations" entry list (double-Toaster resolved in Task 9).
- [ ] **Step 4: Branch/PR** — `test(sp2): editor acceptance e2e + conventions docs`.

---

## Verification checklist (spec acceptance criteria → tasks)

1. 17 types render + working drawer forms → Tasks 5, 6, 10 (`/styleguide/sections` + forms loop test).
2. Edit→autosave→publish→public loop → Task 12 e2e.
3. Keyboard-only reorder + focal → Tasks 9, 10; proven in Task 12.
4. Nav + announcement publish → Tasks 11, 12.
5. Per-page SEO metadata → Tasks 11, 12.
6. Markdown toolbar + XSS-escape → Tasks 2, 8, 12.
7. Concurrency conflict dialog → Tasks 3, 7, 9; proven in Task 12.
8. Zero-warning baseline + PR flow → every task's Step 4 + Global Constraints.
