# Editor-Native Content Layer — Slice 1A: Foundation & Sitemap Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the four content pages (Landing, Portfolio, Pricing, Booking) render through a single sections-only path seeded from existing data, rename `/investment`→`/pricing`, dissolve the fluff routes, and add the `BOOKING_FORM` section — all on the *existing* editor (the modern editor UX comes in plans 1B/1C).

**Architecture:** Reuse the existing `siteContent` draft/publish model and `SectionsCanvas`. A one-time idempotent seed (`scripts/seed-site-content.ts`) writes the current `*_DEFAULTS` arrays into Firestore as *published* sections. Once seeded, each page drops its hand-coded fallback and renders only `SectionsCanvas`. A new `BOOKING_FORM` section type embeds the existing `BookingFormSteps`, refactored to self-prefill from the URL so it is embeddable.

**Tech Stack:** Next.js 15 App Router, TypeScript (strict), Firestore (Admin SDK), Zod, `npx tsx` for scripts. Verification is `npm run build` (type-check) + `npm run lint` + manual smoke (no unit-test runner exists in this repo — per project `CLAUDE.md`).

---

## Conventions for every task

- **Verify** means: from the repo root run `npm run build` and `npm run lint`; both must finish with zero errors. Where a behavior needs eyes, an explicit **Manual check** is listed.
- **Branch:** work continues on `ux-audit-improvements` (already checked out).
- Commit messages end with the trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Do not start a task until the previous task's Verify passed.

---

## File Map (what 1A touches)

| File | Change | Responsibility |
|---|---|---|
| `lib/site-content/types.ts` | modify | Add `BOOKING_FORM` type + `BookingFormSection`; add `focalX?/focalY?` to `PhotoRef` |
| `app/admin/site/actions.ts` | modify | Add `BookingFormSchema` to the Zod union; add focal fields to `PhotoRefSchema` |
| `lib/site-content/render.tsx` | modify | Render `BOOKING_FORM`; apply focal point to images |
| `components/site-editor/SectionsCanvas.tsx` | modify | `blank()` case for `BOOKING_FORM` |
| `app/booking/BookingFormSteps.tsx` | modify | Self-prefill from `useSearchParams()` so it embeds with no props |
| `lib/site-content/defaults/booking.ts` | create | `BOOKING_DEFAULTS: Section[]` |
| `lib/site-content/defaults/portfolio.ts` | modify | Append the bio (from `ABOUT_DEFAULTS`) as a `RICH_TEXT` section |
| `lib/site-content/page-registry.ts` | modify | Pages → `home, portfolio, pricing, booking`; remove `about`/`investment` |
| `scripts/seed-site-content.ts` | create | Idempotent seed of published sections |
| `app/pricing/page.tsx` + `app/pricing/packages.ts` | create | Renamed from `/investment` |
| `app/investment/page.tsx` | replace | Permanent redirect → `/pricing` |
| `app/booking/page.tsx` | modify | Update `packages` import path; single-path render |
| `app/page.tsx`, `app/portfolio/page.tsx` | modify | Single-path render; delete fallback + `*_DEFAULTS` import |
| `components/Navbar.tsx` | modify | New nav map; drop dissolved links |
| `app/about/`, `app/journal/`, `app/locations/`, `app/shop/` | delete | Dissolved public routes |
| `lib/site-content/defaults/{home,about,investment}.ts` | delete | After seed consumes them |

---

## Task 1: Add the `BOOKING_FORM` section type + focal-point fields (end-to-end type plumbing)

Adds the new section type to every exhaustive site (types, Zod, render, editor factory) in one cohesive change so the build stays green.

**Files:**
- Modify: `lib/site-content/types.ts`
- Modify: `app/admin/site/actions.ts`
- Modify: `lib/site-content/render.tsx`
- Modify: `components/site-editor/SectionsCanvas.tsx`

- [ ] **Step 1: Add the type + focal fields in `types.ts`**

In `lib/site-content/types.ts`, add `"BOOKING_FORM"` to `SectionType`:

```ts
export type SectionType =
  | "HERO"
  | "PHOTO_GRID"
  | "RICH_TEXT"
  | "CTA_BANNER"
  | "PROCESS_STEPS"
  | "PACKAGE_CARDS"
  | "TESTIMONIAL"
  | "SLIDESHOW"
  | "STATS"
  | "BOOKING_FORM";
```

Add `focalX?/focalY?` to `PhotoRef` (normalized 0–1, default centre):

```ts
export interface PhotoRef {
  source: PhotoSource;
  id: string;
  cloudflareImageId: string;
  eventId?: string;
  altText?: string;
  focalX?: number; // 0–1, defaults to 0.5
  focalY?: number; // 0–1, defaults to 0.5
}
```

Add the new section interface (near the other section interfaces):

```ts
export interface BookingFormSection {
  id: string;
  type: "BOOKING_FORM";
  eyebrow?: string;
  heading?: string;
  intro?: string;
}
```

Add it to the `Section` union:

```ts
export type Section =
  | HeroSection
  | PhotoGridSection
  | RichTextSection
  | CtaBannerSection
  | ProcessStepsSection
  | PackageCardsSection
  | TestimonialSection
  | SlideshowSection
  | StatsSection
  | BookingFormSection;
```

- [ ] **Step 2: Add Zod schema in `actions.ts`**

In `app/admin/site/actions.ts`, add focal fields to `PhotoRefSchema`:

```ts
const PhotoRefSchema = z.object({
  source: z.enum(["PROJECT", "SITE"]),
  id: z.string().min(1),
  cloudflareImageId: z.string().min(1),
  eventId: z.string().optional(),
  altText: z.string().optional(),
  focalX: z.number().min(0).max(1).optional(),
  focalY: z.number().min(0).max(1).optional(),
});
```

Add a `BookingFormSchema` next to the other schemas:

```ts
const BookingFormSchema = z.object({
  id: z.string().min(1),
  type: z.literal("BOOKING_FORM"),
  eyebrow: z.string().optional(),
  heading: z.string().optional(),
  intro: z.string().max(2000).optional(),
});
```

Add it to the discriminated union:

```ts
const SectionSchema = z.discriminatedUnion("type", [
  HeroSchema,
  PhotoGridSchema,
  RichTextSchema,
  CtaBannerSchema,
  ProcessStepsSchema,
  PackageCardsSchema,
  TestimonialSchema,
  SlideshowSchema,
  StatsSchema,
  BookingFormSchema,
]);
```

- [ ] **Step 3: Render `BOOKING_FORM` + apply focal point in `render.tsx`**

First read `lib/site-content/render.tsx` to find the section `switch`/dispatch and the image-rendering helper. Add a case for `BOOKING_FORM` that renders the optional copy then embeds the booking form:

```tsx
import { BookingFormSteps } from "@/app/booking/BookingFormSteps";
// ...
case "BOOKING_FORM":
  return (
    <section key={section.id} style={{ padding: "5rem 4rem", maxWidth: "52rem", margin: "0 auto" }}>
      {section.eyebrow && (
        <span style={{ fontSize: "0.65rem", letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--olive)" }}>
          {section.eyebrow}
        </span>
      )}
      {section.heading && (
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: "clamp(2rem,4vw,3rem)", margin: "0.75rem 0" }}>
          {section.heading}
        </h2>
      )}
      {section.intro && (
        <p style={{ fontWeight: 300, lineHeight: 1.85, color: "var(--charcoal-light)", marginBottom: "2.5rem" }}>
          {section.intro}
        </p>
      )}
      <BookingFormSteps />
    </section>
  );
```

For the focal point, locate where `PhotoRef` images set their CSS and add `objectPosition` derived from focal coordinates (default centre). Wherever an image with a `PhotoRef` is rendered with `objectFit: "cover"`, add:

```tsx
objectPosition: `${(ref.focalX ?? 0.5) * 100}% ${(ref.focalY ?? 0.5) * 100}%`,
```

- [ ] **Step 4: Add the `blank()` factory case in `SectionsCanvas.tsx`**

In `components/site-editor/SectionsCanvas.tsx`, add a case to the `blank()` switch:

```ts
case "BOOKING_FORM":
  return { id: makeId("BOOKING_FORM"), type: "BOOKING_FORM", heading: "Book your session", intro: "Tell me about your session and I'll be in touch." };
```

- [ ] **Step 5: Verify**

Run: `npm run build` then `npm run lint`
Expected: both pass, zero errors. (If `render.tsx` had an exhaustive `switch` with `never` check, the new case satisfies it.)

- [ ] **Step 6: Commit**

```bash
git add lib/site-content/types.ts app/admin/site/actions.ts lib/site-content/render.tsx components/site-editor/SectionsCanvas.tsx
git commit -m "feat(site-editor): add BOOKING_FORM section type + photo focal point"
```

---

## Task 2: Make `BookingFormSteps` self-prefill from the URL

So the form embeds as a section with no props while keeping `?package=` / `?sessionType=` prefill from the Pricing CTA.

**Files:**
- Modify: `app/booking/BookingFormSteps.tsx`
- Modify: `app/booking/page.tsx` (stop threading prefill props if it does)

- [ ] **Step 1: Read both files**

Read `app/booking/BookingFormSteps.tsx` and `app/booking/page.tsx` to see how prefill props (`sessionType`, `package`/`packageId`, `campaign`) currently flow in.

- [ ] **Step 2: Read prefill from `useSearchParams` inside the component**

At the top of the `"use client"` `BookingFormSteps` component, derive the same prefill it used to receive as props:

```tsx
import { useSearchParams } from "next/navigation";
// ...inside the component:
const searchParams = useSearchParams();
const packageId = searchParams.get("package") ?? undefined;
const sessionTypeParam = searchParams.get("sessionType") ?? undefined;
const campaign = searchParams.get("campaign") ?? undefined;
```

Replace the previous prop-derived values with these locals (keep the existing normalisation logic, e.g. `findPackageById`, `normaliseSessionType`). Make any remaining props optional so existing callers still compile.

- [ ] **Step 3: Stop passing those props from `page.tsx`**

In `app/booking/page.tsx`, render `<BookingFormSteps />` without the prefill props (the component now reads them itself). Leave the page's `searchParams` handling for metadata only if still needed.

- [ ] **Step 4: Verify**

Run: `npm run build` then `npm run lint` → both pass.
Manual check (after `npm run dev`): visit `/booking?package=story` — the form still prefills the matching package/session type.

- [ ] **Step 5: Commit**

```bash
git add app/booking/BookingFormSteps.tsx app/booking/page.tsx
git commit -m "refactor(booking): self-prefill BookingFormSteps from URL so it embeds as a section"
```

---

## Task 3: Author `BOOKING_DEFAULTS` and fold the bio into Portfolio defaults

**Files:**
- Create: `lib/site-content/defaults/booking.ts`
- Modify: `lib/site-content/defaults/portfolio.ts`

- [ ] **Step 1: Create `booking.ts`**

```ts
// lib/site-content/defaults/booking.ts
// Seed sections for the Booking page: editable intro copy + the embedded form.
import type { Section } from "@/lib/site-content/types";

export const BOOKING_DEFAULTS: Section[] = [
  {
    id: "booking-hero",
    type: "HERO",
    slides: [],
    eyebrow: "Booking",
    headline: "Let's make something timeless",
    sub: "Share a few details about your session and I'll reply within two business days.",
  },
  {
    id: "booking-form",
    type: "BOOKING_FORM",
    heading: "Tell me about your session",
    intro: "Every field helps me prepare. There are no wrong answers.",
  },
];
```

- [ ] **Step 2: Append the bio to `portfolio.ts`**

Read `lib/site-content/defaults/about.ts` and copy the bio's `RICH_TEXT` content. In `lib/site-content/defaults/portfolio.ts`, append a `RICH_TEXT` section carrying that bio (give it a stable id like `portfolio-about`). Use the real bio text from `ABOUT_DEFAULTS`, not a placeholder.

- [ ] **Step 3: Verify**

Run: `npm run build` then `npm run lint` → both pass.

- [ ] **Step 4: Commit**

```bash
git add lib/site-content/defaults/booking.ts lib/site-content/defaults/portfolio.ts
git commit -m "feat(site-editor): booking defaults + fold About bio into Portfolio defaults"
```

---

## Task 4: Update the page registry (home, portfolio, pricing, booking)

**Files:**
- Modify: `lib/site-content/page-registry.ts`

- [ ] **Step 1: Rewrite `SITE_PAGES`**

```ts
export const SITE_PAGES: readonly PageDefinition[] = [
  {
    id: "home",
    label: "Home",
    publicHref: "/",
    description: "Landing page — hero, selected work, stats, closing CTA.",
    allowedSections: ["HERO", "PHOTO_GRID", "SLIDESHOW", "STATS", "RICH_TEXT", "CTA_BANNER"] as const,
  },
  {
    id: "portfolio",
    label: "Portfolio",
    publicHref: "/portfolio",
    description: "Editorial showcase + the about/story section. Category filter is photo-driven.",
    allowedSections: ["HERO", "PHOTO_GRID", "RICH_TEXT", "CTA_BANNER"] as const,
  },
  {
    id: "pricing",
    label: "Pricing",
    publicHref: "/pricing",
    description: "Process steps, package cards, testimonial, closing CTA.",
    allowedSections: ["HERO", "PROCESS_STEPS", "PACKAGE_CARDS", "TESTIMONIAL", "CTA_BANNER", "RICH_TEXT"] as const,
  },
  {
    id: "booking",
    label: "Booking",
    publicHref: "/booking",
    description: "Inquiry page — editable copy around the booking form.",
    allowedSections: ["HERO", "RICH_TEXT", "BOOKING_FORM", "CTA_BANNER"] as const,
  },
] as const;
```

(`about`, `investment`, and `footer` are removed from the editable registry for 1A. Footer returns in Slice 2.)

- [ ] **Step 2: Verify**

Run: `npm run build` then `npm run lint` → both pass.
Note: `app/admin/site/page.tsx` lists pages from this registry — confirm it still compiles and renders the four pages.

- [ ] **Step 3: Commit**

```bash
git add lib/site-content/page-registry.ts
git commit -m "feat(site-editor): reduce editable page registry to home/portfolio/pricing/booking"
```

---

## Task 5: Create the seed script and run it

**Files:**
- Create: `scripts/seed-site-content.ts`

- [ ] **Step 1: Write the script**

```ts
// scripts/seed-site-content.ts
// One-time seed: write the current hand-crafted page designs into Firestore as
// PUBLISHED site-editor sections, so the public pages can render through the
// single SectionsCanvas path (no hand-coded fallback).
//
//   npx tsx scripts/seed-site-content.ts            (dry-run, default)
//   npx tsx scripts/seed-site-content.ts --apply    (writes)
//
// Idempotent: a page that already has publishedSections is skipped. A legacy
// `investment` doc is migrated to `pricing` then deleted.
import { adminDb } from "../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { Section } from "../lib/site-content/types";
import { HOME_DEFAULTS } from "../lib/site-content/defaults/home";
import { PORTFOLIO_DEFAULTS } from "../lib/site-content/defaults/portfolio";
import { INVESTMENT_DEFAULTS } from "../lib/site-content/defaults/investment";
import { BOOKING_DEFAULTS } from "../lib/site-content/defaults/booking";

const SEED: Record<string, Section[]> = {
  home: HOME_DEFAULTS,
  portfolio: PORTFOLIO_DEFAULTS,
  pricing: INVESTMENT_DEFAULTS, // investment design becomes the pricing page
  booking: BOOKING_DEFAULTS,
};

async function run() {
  const apply = process.argv.includes("--apply");
  const mode = apply ? "APPLY" : "DRY-RUN";
  const col = adminDb.collection("siteContent");

  // Migrate a legacy `investment` doc → `pricing` (one-time).
  const legacy = await col.doc("investment").get();
  if (legacy.exists) {
    console.log(`[${mode}] legacy 'investment' doc found → would migrate to 'pricing' and delete.`);
    if (apply) {
      const pricingRef = col.doc("pricing");
      if (!(await pricingRef.get()).exists) {
        await pricingRef.set({ ...legacy.data(), pageId: "pricing", updatedAt: FieldValue.serverTimestamp() });
      }
      await col.doc("investment").delete();
    }
  }

  for (const [pageId, sections] of Object.entries(SEED)) {
    const ref = col.doc(pageId);
    const snap = await ref.get();
    const existing = snap.exists ? (snap.data()?.publishedSections as Section[] | undefined) : undefined;
    if (existing && existing.length > 0) {
      console.log(`[${mode}] ${pageId}: already has ${existing.length} published sections — SKIP`);
      continue;
    }
    console.log(`[${mode}] ${pageId}: would seed ${sections.length} sections`);
    if (apply) {
      await ref.set(
        {
          pageId,
          draftSections: sections,
          publishedSections: sections,
          draftDirty: false,
          publishedAt: FieldValue.serverTimestamp(),
          publishedByUid: "seed-script",
          draftUpdatedAt: FieldValue.serverTimestamp(),
          draftUpdatedByUid: "seed-script",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
  }
  console.log(`[${mode}] done.`);
}

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Dry-run**

Run: `npx tsx scripts/seed-site-content.ts`
Expected: prints "would seed N sections" for home/portfolio/pricing/booking (and any legacy-investment note). No writes.

- [ ] **Step 3: Apply**

Run: `npx tsx scripts/seed-site-content.ts --apply`
Expected: writes the four published pages.

- [ ] **Step 4: Verify idempotency**

Run: `npx tsx scripts/seed-site-content.ts --apply` again
Expected: all four print "already has … — SKIP".

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-site-content.ts
git commit -m "feat(scripts): idempotent seed of published site-editor pages"
```

---

## Task 6: Rename `/investment` → `/pricing` (route + packages module + redirect)

**Files:**
- Create: `app/pricing/page.tsx`, `app/pricing/packages.ts`
- Replace: `app/investment/page.tsx` (redirect)
- Modify: `app/booking/page.tsx` (and any other importer of `@/app/investment/packages`)

- [ ] **Step 1: Find all importers of the packages module**

Run: `npx grep -rn "app/investment/packages" app components lib` (or use the editor search). Note every importer — at minimum `app/booking/page.tsx`.

- [ ] **Step 2: Move the packages module**

Copy `app/investment/packages.ts` → `app/pricing/packages.ts` verbatim. Update every importer found in Step 1 to `@/app/pricing/packages`.

- [ ] **Step 3: Create the pricing page as a single-path render**

Model it on the home/portfolio pattern (see Task 7), `pageId="pricing"`, label `"Pricing"`. It loads published/draft sections and renders `<SectionsCanvas pageId="pricing" .../>`. No hand-coded fallback.

- [ ] **Step 4: Replace `/investment` with a redirect**

```tsx
// app/investment/page.tsx
import { permanentRedirect } from "next/navigation";
export default function InvestmentRedirect() {
  permanentRedirect("/pricing");
}
```

- [ ] **Step 5: Verify**

Run: `npm run build` then `npm run lint` → both pass.
Manual check: `/investment` 308-redirects to `/pricing`; `/pricing` renders the seeded sections; `/booking?package=...` still resolves a package.

- [ ] **Step 6: Commit**

```bash
git add app/pricing app/investment/page.tsx app/booking/page.tsx
git commit -m "feat(pricing): rename /investment to /pricing with permanent redirect"
```

---

## Task 7: Convert Home, Portfolio, Booking to single-path render

**Files:**
- Modify: `app/page.tsx`, `app/portfolio/page.tsx`, `app/booking/page.tsx`

- [ ] **Step 1: Home — delete the fallback**

Read `app/page.tsx`. The page already returns `<SectionsCanvas>` when `sections || (isAdmin && editParam)`. Because the seed guarantees published sections exist, **remove the trailing hand-coded fallback `return (...)`** (the `HeroSlideshow` + stats block) and the `HOME_DEFAULTS` import/usage. Replace the `sections ?? HOME_DEFAULTS` fallback with `sections` and render `SectionsCanvas` unconditionally (sections is now always present). Keep `getSessionOrNull`, `pickerData`, and `dynamic = "force-dynamic"`. Remove now-dead helpers (`getCuratedPhotos`, `DEV_PHOTOS`) if unused after deletion.

Resulting shape:

```tsx
const sections = (isAdmin && editParam ? draft : null) ?? published ?? [];
// pickerData as today
return (
  <div style={{ paddingTop: "72px" }} className="page-fade-in">
    <SectionsCanvas pageId="home" pageLabel="Home" initialSections={sections} isAdmin={isAdmin} editParam={editParam} pickerData={pickerData} />
    <Footer />
  </div>
);
```

- [ ] **Step 2: Portfolio — delete the fallback**

Same treatment in `app/portfolio/page.tsx`: remove the static header/`DEV_PHOTOS` fallback and any `*_DEFAULTS` import; render `SectionsCanvas pageId="portfolio"` unconditionally. The photo grid now comes from the seeded `PHOTO_GRID`/`RICH_TEXT` sections (incl. the folded bio).

- [ ] **Step 3: Booking — single path**

In `app/booking/page.tsx`, render `SectionsCanvas pageId="booking"` (loading published/draft like the others). The embedded `BOOKING_FORM` section renders the self-prefilling form. Keep `export const metadata`.

- [ ] **Step 4: Verify**

Run: `npm run build` then `npm run lint` → both pass.
Manual check: `/`, `/portfolio`, `/booking` render seeded content; admin `?edit=1` still opens the editor on each; booking form submits.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx app/portfolio/page.tsx app/booking/page.tsx
git commit -m "refactor(pages): single sections-only render path for home/portfolio/booking"
```

---

## Task 8: Dissolve fluff routes + update the public nav

**Files:**
- Delete: `app/about/`, `app/journal/`, `app/locations/`, `app/shop/`
- Modify: `components/Navbar.tsx`
- Delete: `lib/site-content/defaults/{home,about,investment}.ts` (now unused)

- [ ] **Step 1: Confirm no public imports of the doomed routes**

Run: `npx grep -rn "/about\|/journal\|/locations\|/shop" app components` and review. Public-facing links must move/remove; admin routes (`app/admin/journal`, `app/admin/locations`, `app/admin/shop`) are **left intact** (backend teardown is deferred — see spec §8). Only delete the *public* route folders listed above.

- [ ] **Step 2: Delete the public route folders**

```bash
git rm -r app/about app/journal app/locations app/shop
```

(If any of these don't exist as standalone public folders, skip that path — verify with `ls app`.)

- [ ] **Step 3: Update the navbar**

Read `components/Navbar.tsx`. Set the public links to: Home (`/`), Portfolio (`/portfolio`), Pricing (`/pricing`), Booking (`/booking`), plus the existing auth-aware My Galleries/Login entries. Remove About/Journal/Locations/Shop links and any `/investment` link (point to `/pricing`).

- [ ] **Step 4: Delete consumed defaults**

After confirming the seed has been applied (Task 5) and no page imports them anymore:

```bash
git rm lib/site-content/defaults/home.ts lib/site-content/defaults/about.ts lib/site-content/defaults/investment.ts
```

(Keep `portfolio.ts` and `booking.ts` — they are still imported by the seed script; `footer.ts` stays for Slice 2.)

- [ ] **Step 5: Verify**

Run: `npm run build` then `npm run lint` → both pass (no dangling imports).
Manual check: nav shows the four pages; dissolved routes 404; no console import errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(sitemap): dissolve about/journal/locations/shop public routes; new nav"
```

---

## Self-Review (completed)

- **Spec coverage:** rendering model single-path (Tasks 7), seed (Task 5), pricing rename+redirect+packages relocation (Task 6), route dissolution + nav (Task 8), BOOKING_FORM (Tasks 1–2), bio→Portfolio (Task 3), registry (Task 4), focal-point field plumbing (Task 1; the *UI* to set it ships in 1C). Footer correctly deferred to Slice 2.
- **Deferred to 1B/1C (not 1A):** autosave, undo/redo, no-flash publish, in-app dialogs, device preview (1B); inline editing, drag-and-drop, add-section modal, image-replace picker + focal-point UI, HTML sanitization (1C). The existing editor remains fully usable after 1A.
- **Type consistency:** `BOOKING_FORM` / `BookingFormSection` / `focalX`/`focalY` names match across `types.ts`, `actions.ts`, `render.tsx`, defaults, and the seed.
- **Placeholders:** none — every code step shows real code; the only "read the file first" steps are deliberate (deleting bespoke fallback JSX whose exact lines must be read in place).

---

## Follow-on plans (to be written when 1A lands)

- **1B — Editor engine:** `useEditorHistory` (undo/redo), `useAutosave`, `EditorShell`, `EditorTopBar`, publish/discard return published sections (no `router.refresh()` flash), `ConfirmDialog`/`PublishDialog` (kill native pop-ups), device preview.
- **1C — Direct manipulation:** editable render layer (`Editable` primitive + edit context in `render.tsx`), `TextFormatToolbar` + server-side HTML sanitization, `SectionToolbar` (floating + `@dnd-kit` drag), `AddSectionModal` (guided gallery), image-replace via upgraded `PhotoPicker` + focal-point control.
