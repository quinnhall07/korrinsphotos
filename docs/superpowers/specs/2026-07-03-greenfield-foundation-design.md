# Goldenrod — Greenfield Foundation (Sub-project 1)

**Date:** 2026-07-03
**Status:** Approved by Quinn (pending final written review)
**Depends on:** `2026-07-02-goldenrod-brand-definition-design.md` (brand tokens, decomposition)

---

## 1. Goal

A new repository containing a deployed, tested "hello-world with the brand's bones": design tokens, primitive components, ported auth + storage + Stripe plumbing, testing infrastructure, and CI. Sub-projects 2–5 build on this without revisiting any decision here.

## 2. Repo & deployment

- **New repository `goldenrod`**, created as a sibling folder to `korrinsphotos` (which becomes the read-only reference archive).
- GitHub remote + fresh Vercel project on day one; every PR gets a preview deployment.
- `main` protected. During the foundation build (this sub-project), commits land directly on `main` with CI validating every push — decided with Quinn 2026-07-03. From sub-project 2 onward, all work lands via PRs (by then Vercel preview deployments make them useful). Node 24 LTS, npm.
- `.env.local` carries over from the old app **unchanged** — same Firebase project, Stripe account, R2 bucket, Cloudflare Images account, and the same env-var names.

## 3. Stack (all versions pinned exactly — no `"latest"`, no floating carets on core deps)

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16** (App Router) | Cache Components / PPR replace the old blanket `force-dynamic`: public pages are statically cached with targeted revalidation on publish |
| UI | **React 19** | |
| Language | **TypeScript strict** | plus `noUncheckedIndexedAccess`, `noImplicitOverride` |
| Styling | **Tailwind v4** | CSS-first `@theme`; no inline-style styling system |
| Validation | **Zod v4** | |
| Backend SDKs | `firebase-admin` v13, `firebase` (client) v11, `stripe` pinned + pinned API version, `@aws-sdk/client-s3` v3 | |
| Interaction | `@dnd-kit/*` (editor, later), Radix primitives (a11y cores) | |
| Fonts | `next/font` self-hosted **Fraunces** (variable incl. SOFT/WONK axes) + **Instrument Sans** | no Google Fonts `<link>` tags |
| Testing | **Vitest** + Testing Library, **Playwright** | from the first commit |

## 4. Design-token implementation

Brand spec §4 becomes the single source of truth in code:

- Tailwind v4 `@theme` defines both palettes as CSS custom properties. Surface switching via `data-surface="dark" | "light"` on layout containers — **dark theater** is the default for public/marketing; **gallery light** for galleries/portal contexts.
- Token groups: color (Nightfall, Stage, Ivory, Ash, Goldenrod / Paper, Ink, Goldenrod Deep), spacing scale, radius (2px), motion durations (400–700ms) + easings, z-index scale (named layers — retiring the old magic numbers).
- Base layer includes: `prefers-reduced-motion` handling, visible gold `:focus-visible` rings, selection color, image-protection defaults (context-menu/drag suppression utilities to be applied per-component, not globally).
- **Brand asset deliverables:** SVG wordmark + "G" monogram exported from Fraunces Italic 300 / `opsz 144, SOFT 100, WONK 1` (text converted to outlines), favicon set, OG-image template.

## 5. Primitive component library

~12 owned primitives with a bespoke API, Radix underneath where accessibility is hard:

Button, TextLink, Field/Input/Textarea, Select, Dialog, Popover, Toast, Tabs, Badge, EmptyState, Spinner/Skeleton, VisuallyHidden.

- Styled exclusively with Tailwind classes referencing tokens; both surfaces supported.
- **shadcn/ui** installed and re-themed by the same tokens, **quarantined to admin routes** via an ESLint boundary rule (`components/admin-ui/**` importable only from `app/admin/**`). Public site and editor never import shadcn.
- Dev-only `/styleguide` route renders every primitive in both surfaces (doubles as a visual regression target).

## 6. Ports from the old app (logic in, bugs fixed at the door)

Each port is re-typed, reviewed against the 2026-07-02 audit findings, and lands **with tests**:

1. **Auth/session** (`lib/session.ts`, `lib/firebase-admin.ts`, `lib/firebase.ts`, `AuthProvider`, `/api/auth/session` + `signout`): full cookie protocol including the admin `needsRefresh` two-step. Port faithfully — the audit found this layer sound.
2. **Storage** (`lib/storage/r2.ts`, `lib/storage/images.ts`): R2 presign single + multipart, delete, presigned GET, Cloudflare Images upload/delete, `buildCdnUrl` variants. No deprecated `lib/cloudflare.ts` facade in the new repo.
3. **Stripe** (`lib/stripe.ts` + webhook route skeleton): payment-link creation ported; webhook **idempotency fixed** — atomic `stripeWebhookEvents/{event.id}` `create()` claim *before* handler execution (the old get-then-set race is not carried over); **no `sk_test_mock` fallback** — missing key in production throws at boot.
4. **DB-module pattern** as a convention doc + one exemplar (`lib/db/users.ts`). Other collections arrive with their owning sub-projects; no speculative ports.

Explicitly **not ported**: the sections model (rebuilt as v2 in sub-project 2), any UI, `lead-scoring`, cron worker, transitions engine (redesigned with the admin core), the 40-collection db layer.

## 7. Testing & CI

- Vitest + Testing Library (units/components), Playwright (flows). The auth protocol and Stripe webhook land with their suites — the two highest-risk ports get regression protection first.
- CI on every PR: typecheck → lint → unit → Playwright smoke. Merge blocked on red.
- Scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:e2e`.

## 8. Acceptance criteria

1. Repo deployed on Vercel; preview URLs on PRs; CI green.
2. `/styleguide` shows all primitives in both surfaces with the real fonts and tokens.
3. Sign-in round-trip works end-to-end against the shared Firebase project (admin `needsRefresh` dance verified by Playwright).
4. An R2 presign + upload + CDN-URL round-trip passes an integration test.
5. Stripe webhook signature + idempotency covered by unit tests (double-delivery test proves single execution).
6. Zero `"latest"` versions; `npm run build` and full test suite green.

## 9. Out of scope

Sections/editor (SP2), public pages (SP3), galleries/portal (SP4), admin routes & feature triage (SP5), data migrations, print sales, old-repo cleanup.
