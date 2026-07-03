# Goldenrod Photography — Brand Definition & Overhaul Decomposition (Sub-project 0)

**Date:** 2026-07-02
**Status:** Approved by Quinn (pending final written review)
**Supersedes:** the "Korrin's Photos" brand; the May 2026 naming criteria (the "must contain Photography/Photo *for SEO*" rationale is retired — the word appears in the name by choice, not SEO necessity)

---

## 1. Context

The business is rebranding and rebuilding. Decisions locked in the 2026-07-02 brainstorm:

- **Vision:** a team-scalable college-town creative studio (photography now; video/content later). Greek-life chapter events are a key segment, not the identity. Louisville, KY summer 2026 → Tuscaloosa, AL (University of Alabama) Fall 2026.
- **Rebuild depth:** true greenfield — a new application, porting only what earns its place. Same external services (Firebase Auth/Firestore project, Stripe account, Cloudflare R2 + Images), so existing data carries over.
- **Timeline:** quality first; everything finished well before Fall 2026. No interim launches required.

### Overhaul decomposition (Approach A — approved)

Six sub-projects, strictly serial, with parallel subagent work *inside* each phase. Each gets its own spec → plan → implementation cycle.

| # | Sub-project | Deliverable |
|---|---|---|
| 0 | **Brand definition** | This document |
| 1 | Greenfield foundation | New app scaffold: pinned stack, token system, primitives, testing infra, auth/session + image-pipeline ports |
| 2 | Content engine + site editor v2 | Sections engine + expanded editor (global settings, guard-railed theme, per-page SEO, new sections, markdown toolbar, full a11y) |
| 3 | Public site | Pages assembled in the editor with the new brand |
| 4 | Client experience | Galleries + portal redesigned (logic ported, skin new); print sales later |
| 5 | Admin core | Lean CRM per per-feature triage (decided with Quinn against the 2026-07-02 competitor research) |

Admin **triage decisions** happen early (during 0–1) so backend deletions are planned even though the admin build lands last.

---

## 2. The name: Goldenrod Photography

**The story.** Goldenrod is Kentucky's state flower (since 1926), blooming in the color of golden hour. It grows wild along I-65 the whole way south — the Kentucky the founders brought with them, in the light they shoot by. One gold light in the dark.

**Form.** "Goldenrod" is the mark; "Photography" is the descriptor line. If the studio expands into video/content, the descriptor evolves (e.g., "Goldenrod Studio") without a rebrand.

**Vetting (2026-07-02, deep pass):** verdict **GO**.
- Zero active Goldenrod-named photography businesses in AL/KY/TN/GA/MS; all national users defunct, rebranded, or negligible.
- No USPTO mark on "Goldenrod" in photography/creative/media classes (formal knockout search still recommended before LLC/trademark filing).
- Connotations acceptable: the allergy association is a documented botanical myth; minor innuendo not disqualifying.
- Biggest risk is SEO discoverability (Goldenrod, FL dominates generic SERPs) — mitigated by always branding "Goldenrod Photography — Tuscaloosa" and an early Google Business Profile.

**Urgent actions (owner, this week):**
1. Register `goldenrodphoto.com` and `goldenrodstudios.com` (both unregistered as of 2026-07-02).
2. Backorder `goldenrodphotography.com` — registered but dark, **expires 2026-07-23**.
3. Claim geo-modified social handles (e.g., `@goldenrodphoto.al` or `@goldenrod.tuscaloosa`); verify TikTok in-app.
4. UA/Churchill Downs trademark no-fly zone stands: no Crimson/Tide/Roll/Bama/Big Al/houndstooth/Derby anywhere in brand assets.

---

## 3. Design direction: "Cinematic Swiss"

Chosen from five researched directions (references verified live 2026-07-02). Blend recipe B-led-C-disciplined:

- **Cinematic leads (excitement).** Dark-first brand: near-black warm ground, full-bleed edge-to-edge imagery, scroll-driven reveals, ambient slow motion. The site feels like the best night of the semester. References: jlaplante.com, alexoley.com, davidbastianoni.com.
- **Swiss disciplines (clarity).** Strict grids for work/portfolio, one neutral sans for UI, restrained spacing system. Excitement is the atmosphere; clarity is the structure. References: silaschau.com, leonardwalpot.nl.
- **Editorial serif is the voice (elegance).** High-contrast serif display used sparingly for big statements. References: ktmerry.com.

**The structural dark/light split** (resolves the documented light-and-airy vs. event-work tension):
- Public brand/marketing surfaces = dark theater.
- Client galleries, portrait-heavy contexts, and the client portal = gallery light. Deliverables are always shown untouched on near-white.

## 4. Identity system (tokens to be encoded in Sub-project 1)

### 4.1 Palette — dark theater (brand/marketing)

| Token | Hex | Role |
|---|---|---|
| Nightfall | `#121110` | ground |
| Stage | `#1C1A17` | elevated surfaces |
| Ivory | `#F2EDE6` | text |
| Ash | `#8A8378` | muted text / secondary |
| Goldenrod | `#D4A72C` | the single accent |

### 4.2 Palette — gallery light (client galleries, portal, portraits)

| Token | Hex | Role |
|---|---|---|
| Paper | `#FAF8F4` | ground |
| Ink | `#1C1B19` | text |
| Goldenrod Deep | `#A87F1E` | accent on light (contrast-adjusted) |

Gold is a spotlight: one accent per view, never decoration. Contrast pairs must meet WCAG AA (Goldenrod on Nightfall passes for large text/UI accents; body text is always Ivory/Ink).

### 4.3 Typography

- **Display / statements:** **Fraunces** (Google Fonts, variable: `ital, opsz 9–144, wght, SOFT, WONK`). Self-hosted via `next/font`.
- **UI / body / captions:** **Instrument Sans** (Google Fonts). Self-hosted via `next/font`.
- **Eyebrows:** Instrument Sans, uppercase, tracked ~0.26em, Goldenrod.
- Alternate pairing (rejected but recorded): Playfair Display + Inter.

### 4.4 Wordmark

"Goldenrod" set in **Fraunces Italic, weight 300, with variation settings `opsz 144, SOFT 100, WONK 1`** ("Fraunces, dialed up") in Ivory; "PHOTOGRAPHY" beneath in Instrument Sans, uppercase, tracked ~0.42em, Goldenrod; optional locator line "Tuscaloosa, Alabama" in Ash. Wordmark treatment is logo-only; page headings use standard Fraunces. A simple "G" monogram (same variation settings) covers favicon/avatar sizes. Deliverable in Sub-project 1: SVG wordmark + monogram exported from these settings.

### 4.5 Voice

Confident, warm, first-person-plural — a studio, not a vendor. Short sentences. Night language (glow, after dark, last song, golden hour) without clichés. **Honest numbers only — no invented stats, ever** (retires the fabricated "340+ Sessions / 12 Years" copy). Korrin's brand-voice samples remain the anchor for client-facing copy. Reference line: "We shoot the nights you'll want back."

### 4.6 Imagery & motion

- Marketing: full-bleed, graded to sit on the dark ground.
- Galleries: untouched images on Paper.
- Motion: slow (400–700ms), scroll-driven reveals, crossfades; never bouncy; no parallax-for-parallax's-sake. `prefers-reduced-motion` honored from day one.

### 4.7 UI accents

- Primary button: Goldenrod fill, Nightfall text, uppercase Instrument Sans.
- Secondary: ghost outline in Ivory (dark) / Ink (light).
- Border radius 2px; generous hit targets; visible gold focus rings for keyboard users.

---

## 5. Out of scope for this spec

Stack selection and token implementation (Sub-project 1); editor capability set (Sub-project 2 — informed by the 2026-07-02 editor-market research); admin keep/scrap/expand list (Sub-project 5 triage, decided per-feature with Quinn); logo/monogram SVG production (Sub-project 1 deliverable); business-entity/trademark filings (owner action).

## 6. Success criteria

- Owner has registered the domains and claimed handles (§2 urgent actions).
- Every visual decision downstream of this doc can cite a token/rule here rather than inventing one.
- The brand survives the founder-behind-the-camera leaving: nothing in name, mark, or voice is tied to one person.
