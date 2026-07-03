# Goldenrod Greenfield Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the new `goldenrod` repository as a deployed, tested "hello-world with the brand's bones": pinned Next 16 stack, brand token system, primitive components, ported auth/storage/Stripe plumbing, and CI.

**Architecture:** Fresh Next.js 16 App Router app in a sibling repo. Tailwind v4 CSS-first tokens implement the brand spec's two-surface (dark/light) system. ~12 bespoke primitives (Radix cores where a11y is hard); shadcn quarantined for future admin. Battle-tested server plumbing is ported from `korrinsphotos` with audit fixes applied at the door, landing with tests.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Tailwind v4, Radix UI, Zod v4, firebase-admin v13 / firebase v11+, Stripe (pinned API version), Vitest + Testing Library, Playwright, GitHub Actions, Vercel.

## Global Constraints

- New repo path: `C:\Users\danie\Documents\GitHub\goldenrod` (sibling of the reference repo `C:\Users\danie\Documents\GitHub\korrinsphotos`, hereafter **REF**).
- All dependencies pinned **exact** (no `^`, `~`, or `latest`) in package.json. Node `24.x`, npm.
- Palette tokens verbatim from the brand spec: Nightfall `#121110`, Stage `#1C1A17`, Ivory `#F2EDE6`, Ash `#8A8378`, Goldenrod `#D4A72C`, Paper `#FAF8F4`, Ink `#1C1B19`, Goldenrod Deep `#A87F1E`. Radius `2px`. Motion 400–700 ms, easing `cubic-bezier(0.25, 0.46, 0.45, 0.94)`.
- Fonts: Fraunces (variable, axes `opsz`, `SOFT`, `WONK`, italic) display; Instrument Sans UI — via `next/font/google` only. No `<link>` font tags.
- Wordmark treatment: Fraunces Italic wght 300, `opsz 144, SOFT 100, WONK 1`.
- `prefers-reduced-motion` respected; visible gold `:focus-visible` rings; TS `strict` + `noUncheckedIndexedAccess` + `noImplicitOverride`.
- Same env-var names as REF (`FIREBASE_*`, `NEXT_PUBLIC_FIREBASE_*`, `ADMIN_EMAILS`, `CLOUDFLARE_*`, `STRIPE_*`, `NEXT_PUBLIC_APP_URL`). Copy `.env.local` from REF unchanged.
- Commit after every green test cycle. Conventional-commit messages. All commits end with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Env-gated tests (need real credentials) must auto-skip when their env vars are absent so CI stays green without secrets.

---

### Task 1: Scaffold the repo with pinned stack

**Files:**
- Create: entire app via create-next-app at `C:\Users\danie\Documents\GitHub\goldenrod`
- Modify: `package.json`, `tsconfig.json`
- Create: `scripts/pin-deps.mjs`, `.nvmrc`

**Interfaces:**
- Produces: a building Next 16 + Tailwind v4 app; `npm run typecheck` script; exact-pinned package.json every later task depends on.

- [ ] **Step 1: Scaffold**

```bash
cd "C:/Users/danie/Documents/GitHub"
npx create-next-app@latest goldenrod --typescript --eslint --tailwind --app --no-src-dir --import-alias "@/*" --use-npm
cd goldenrod
git add -A && git commit -m "chore: scaffold Next.js app (create-next-app defaults)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

Expected: app builds with Next 16.x, Tailwind v4 postcss plugin, app/ dir. Verify with `npm ls next tailwindcss` (major versions 16 / 4 — if create-next-app produced something else, install `next@16` `tailwindcss@4` explicitly before continuing).

- [ ] **Step 2: Strict TypeScript + Node pin + scripts**

In `tsconfig.json` `compilerOptions`, add:

```json
"noUncheckedIndexedAccess": true,
"noImplicitOverride": true
```

Create `.nvmrc`:

```
24
```

In `package.json` add scripts (keep existing):

```json
"typecheck": "tsc --noEmit",
"test": "vitest run",
"test:watch": "vitest",
"test:e2e": "playwright test"
```

and:

```json
"engines": { "node": ">=24 <25" }
```

- [ ] **Step 3: Pin all deps exact**

Create `scripts/pin-deps.mjs`:

```js
import { readFileSync, writeFileSync } from "node:fs";
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
for (const key of ["dependencies", "devDependencies"]) {
  for (const dep of Object.keys(pkg[key] ?? {})) {
    const v = JSON.parse(
      readFileSync(`node_modules/${dep}/package.json`, "utf8"),
    ).version;
    pkg[key][dep] = v;
  }
}
writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
console.log("pinned");
```

Run: `node scripts/pin-deps.mjs && npm install`
Expected: package.json has zero `^`/`~` prefixes; `npm install` exits clean.

- [ ] **Step 4: Verify build + typecheck**

Run: `npm run build && npm run typecheck`
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: strict TS, node 24 pin, exact dependency pinning

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Testing infrastructure (Vitest + Testing Library + Playwright)

**Files:**
- Create: `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts`, `e2e/smoke.spec.ts`, `lib/example.test.ts`

**Interfaces:**
- Produces: `npm test` (Vitest, jsdom, RTL matchers), `npm run test:e2e` (Playwright against `next dev`). All later tasks write tests against these harnesses.

- [ ] **Step 1: Install**

```bash
npm install --save-exact -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Configs**

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules", "e2e", ".next"],
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
```

`vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

`playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://localhost:3111" },
  webServer: {
    command: "npm run dev -- --port 3111",
    url: "http://localhost:3111",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 3: Write a failing unit test**

`lib/example.test.ts`:

```ts
import { expect, it } from "vitest";
import { hello } from "./example";

it("greets", () => {
  expect(hello("Goldenrod")).toBe("Hello, Goldenrod");
});
```

Run: `npm test`
Expected: FAIL — `Cannot find module './example'`.

- [ ] **Step 4: Make it pass**

`lib/example.ts`:

```ts
export function hello(name: string): string {
  return `Hello, ${name}`;
}
```

Run: `npm test` → PASS.

- [ ] **Step 5: Playwright smoke**

`e2e/smoke.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("home responds", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toBeVisible();
});
```

Run: `npm run test:e2e` → PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "test: vitest + testing-library + playwright harnesses

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: GitHub repo + CI

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: remote `goldenrod` repo; CI running typecheck/lint/test/e2e on every PR and push to main.

- [ ] **Step 1: Create remote**

```bash
gh repo create goldenrod --private --source . --push
```

Expected: repo created, main pushed. (If `gh` is unauthenticated, run `gh auth login` — user-assisted.)

- [ ] **Step 2: CI workflow**

`.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request:
jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
        env: { CI: "true" }
```

- [ ] **Step 3: Push and verify**

```bash
git add -A && git commit -m "ci: typecheck, lint, unit, e2e on PR and main

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push
gh run watch --exit-status
```

Expected: workflow green. Then enable branch protection on main (user-assisted or `gh api`).

---

### Task 4: Fonts + design tokens (two-surface system)

**Files:**
- Create: `lib/fonts.ts`, `components/Surface.tsx`, `components/Surface.test.tsx`
- Modify: `app/globals.css` (replace scaffold content), `app/layout.tsx`

**Interfaces:**
- Produces: CSS custom properties `--color-nightfall|stage|ivory|ash|goldenrod|paper|ink|goldenrod-deep`; semantic runtime vars `--surface-bg|fg|muted|accent`; Tailwind utilities `bg-surface`, `text-surface`, `text-surface-muted`, `text-accent`, `bg-accent`, `rounded-brand`, `ease-cinematic`, `duration-cine-*`; fonts as `font-display` (Fraunces) / `font-ui` (Instrument Sans); `<Surface mode="dark" | "light">` wrapper; z-scale `--z-nav|overlay|toast`.

- [ ] **Step 1: Failing test for Surface**

`components/Surface.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Surface } from "./Surface";

it("sets data-surface for token switching", () => {
  render(<Surface mode="light"><p>hi</p></Surface>);
  expect(screen.getByText("hi").parentElement).toHaveAttribute(
    "data-surface",
    "light",
  );
});
```

Run: `npm test` → FAIL (module not found).

- [ ] **Step 2: Fonts**

`lib/fonts.ts`:

```ts
import { Fraunces, Instrument_Sans } from "next/font/google";

export const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz", "SOFT", "WONK"],
  variable: "--font-fraunces",
  display: "swap",
});

export const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});
```

- [ ] **Step 3: Tokens**

Replace `app/globals.css` with:

```css
@import "tailwindcss";

@theme {
  --color-nightfall: #121110;
  --color-stage: #1c1a17;
  --color-ivory: #f2ede6;
  --color-ash: #8a8378;
  --color-goldenrod: #d4a72c;
  --color-paper: #faf8f4;
  --color-ink: #1c1b19;
  --color-goldenrod-deep: #a87f1e;

  --font-display: var(--font-fraunces);
  --font-ui: var(--font-instrument);

  --radius-brand: 2px;
  --ease-cinematic: cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --duration-cine-fast: 400ms;
  --duration-cine: 550ms;
  --duration-cine-slow: 700ms;
}

/* Semantic, surface-driven tokens (runtime-switchable) */
@theme inline {
  --color-surface: var(--surface-bg);
  --color-surface-fg: var(--surface-fg);
  --color-surface-muted: var(--surface-muted);
  --color-accent: var(--surface-accent);
}

:root,
[data-surface="dark"] {
  --surface-bg: var(--color-nightfall);
  --surface-raised: var(--color-stage);
  --surface-fg: var(--color-ivory);
  --surface-muted: var(--color-ash);
  --surface-accent: var(--color-goldenrod);
  --z-nav: 100;
  --z-overlay: 1000;
  --z-toast: 9000;
}

[data-surface="light"] {
  --surface-bg: var(--color-paper);
  --surface-raised: #ffffff;
  --surface-fg: var(--color-ink);
  --surface-muted: var(--color-ash);
  --surface-accent: var(--color-goldenrod-deep);
}

@layer base {
  body {
    background: var(--surface-bg);
    color: var(--surface-fg);
    font-family: var(--font-ui), sans-serif;
  }
  :focus-visible {
    outline: 2px solid var(--surface-accent);
    outline-offset: 2px;
  }
  ::selection {
    background: var(--color-goldenrod);
    color: var(--color-nightfall);
  }
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
}
```

- [ ] **Step 4: Surface + layout**

`components/Surface.tsx`:

```tsx
export function Surface({
  mode,
  children,
  className,
}: {
  mode: "dark" | "light";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div data-surface={mode} className={className}>
      {children}
    </div>
  );
}
```

`app/layout.tsx` (replace):

```tsx
import type { Metadata } from "next";
import { fraunces, instrumentSans } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Goldenrod Photography — Tuscaloosa, AL",
  description:
    "Photography & content for the college South. Tuscaloosa, Alabama.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-surface="dark"
      className={`${fraunces.variable} ${instrumentSans.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: Verify**

Run: `npm test` → Surface test PASS. `npm run build` → exit 0.

Note: Tailwind v4 generates `ease-cinematic`, `rounded-brand`, `font-display`/`font-ui`, and all color utilities from the `@theme` namespaces above. If `duration-cine*` utilities do NOT generate (the `--duration-*` namespace varies by v4 minor), use arbitrary values `duration-[400ms]`/`duration-[550ms]`/`duration-[700ms]` at call sites instead — do not block on it.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: brand token system (two-surface), next/font Fraunces + Instrument Sans

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Brand assets (wordmark SVG, monogram, favicon, OG template)

**Files:**
- Create: `scripts/build-brand-assets.mjs`, `public/brand/wordmark.svg`, `public/brand/monogram.svg`, `app/icon.svg`, `components/Wordmark.tsx`, `components/Wordmark.test.tsx`

**Interfaces:**
- Produces: `<Wordmark />` (live-text lockup, both sizes), static outline SVGs for favicon/social use. Later sub-projects import `Wordmark` for nav/footer.

- [ ] **Step 1: Failing Wordmark test**

`components/Wordmark.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Wordmark } from "./Wordmark";

it("renders name and descriptor", () => {
  render(<Wordmark />);
  expect(screen.getByText("Goldenrod")).toBeInTheDocument();
  expect(screen.getByText("Photography")).toBeInTheDocument();
});
```

Run: `npm test` → FAIL.

- [ ] **Step 2: Wordmark component**

`components/Wordmark.tsx`:

```tsx
const WONK: React.CSSProperties = {
  fontFamily: "var(--font-fraunces)",
  fontStyle: "italic",
  fontWeight: 300,
  fontVariationSettings: "'opsz' 144, 'SOFT' 100, 'WONK' 1",
};

export function Wordmark({ size = "md" }: { size?: "md" | "lg" }) {
  const namePx = size === "lg" ? 52 : 28;
  return (
    <span className="inline-flex flex-col items-center text-center">
      <span style={{ ...WONK, fontSize: namePx, lineHeight: 1.05 }}>
        Goldenrod
      </span>
      <span
        className="font-ui uppercase text-accent"
        style={{ fontSize: namePx * 0.23, letterSpacing: "0.42em" }}
      >
        Photography
      </span>
    </span>
  );
}
```

Run: `npm test` → PASS.

- [ ] **Step 3: Outline-SVG build script**

```bash
npm install --save-exact -D fontkit
mkdir -p public/brand assets/fonts
curl -L -o "assets/fonts/Fraunces-Italic-Variable.ttf" "https://github.com/google/fonts/raw/main/ofl/fraunces/Fraunces-Italic%5BSOFT%2CWONK%2Copsz%2Cwght%5D.ttf"
```

`scripts/build-brand-assets.mjs`:

```js
import { openSync } from "fontkit";
import { writeFileSync } from "node:fs";

const font = openSync("assets/fonts/Fraunces-Italic-Variable.ttf").getVariation(
  { opsz: 144, SOFT: 100, WONK: 1, wght: 300 },
);

function textToSvg(text, fontSize, fill) {
  const run = font.layout(text);
  const scale = fontSize / font.unitsPerEm;
  let x = 0;
  const paths = [];
  for (let i = 0; i < run.glyphs.length; i++) {
    const g = run.glyphs[i];
    const pos = run.positions[i];
    const d = g.path.scale(scale, -scale).translate(x + pos.xOffset * scale, 0)
      .toSVG();
    if (d) paths.push(`<path d="${d}" fill="${fill}"/>`);
    x += pos.xAdvance * scale;
  }
  const ascent = font.ascent * scale;
  const descent = -font.descent * scale;
  return {
    width: x,
    svg: (w, h, extra = "") =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${-ascent} ${w} ${h}">${extra}<g>${paths.join("")}</g></svg>`,
    height: ascent + descent,
    ascent,
  };
}

const word = textToSvg("Goldenrod", 96, "#F2EDE6");
writeFileSync(
  "public/brand/wordmark.svg",
  word.svg(word.width, word.height),
);

const mono = textToSvg("G", 96, "#F2EDE6");
const pad = 28;
const side = Math.max(mono.width, mono.height) + pad * 2;
writeFileSync(
  "public/brand/monogram.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}"><rect width="${side}" height="${side}" fill="#121110"/><g transform="translate(${(side - mono.width) / 2}, ${pad + mono.ascent})">${mono
    .svg(mono.width, mono.height)
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>$/, "")}</g></svg>`,
);
console.log("brand assets written");
```

Run: `node scripts/build-brand-assets.mjs`
Expected: `public/brand/wordmark.svg` + `public/brand/monogram.svg` written; open both in a browser and visually confirm the dialed-up Fraunces letterforms on the monogram's Nightfall square. (If glyph positioning looks wrong, adjust the transform — the visual check is the test here.)

- [ ] **Step 4: Favicon**

Copy the monogram as the app icon: `cp public/brand/monogram.svg app/icon.svg`
Run: `npm run dev` and confirm the tab shows the G monogram at `http://localhost:3000`.

- [ ] **Step 5: OG image**

```bash
npm install --save-exact -D sharp
```

Extend `scripts/build-brand-assets.mjs` — append after the monogram block:

```js
import sharp from "sharp"; // move to top of file with the other imports

const ogWord = textToSvg("Goldenrod", 160, "#F2EDE6");
const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#121110"/>
  <g transform="translate(${(1200 - ogWord.width) / 2}, ${315 - ogWord.height / 2 + ogWord.ascent})">${ogWord
    .svg(ogWord.width, ogWord.height)
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>$/, "")}</g>
  <rect x="500" y="470" width="200" height="2" fill="#D4A72C"/>
</svg>`;
await sharp(Buffer.from(ogSvg)).png().toFile("public/brand/og.png");
console.log("og.png written");
```

Run: `node scripts/build-brand-assets.mjs` → `public/brand/og.png` exists (1200×630). Then add to `app/layout.tsx` metadata:

```ts
openGraph: { images: ["/brand/og.png"] },
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: brand assets — wordmark component, outline SVGs, favicon

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Core primitives (no Radix): Button, TextLink, Badge, Spinner, Skeleton, EmptyState, VisuallyHidden

**Files:**
- Create: `components/ui/Button.tsx`, `components/ui/TextLink.tsx`, `components/ui/Badge.tsx`, `components/ui/Spinner.tsx`, `components/ui/Skeleton.tsx`, `components/ui/EmptyState.tsx`, `components/ui/VisuallyHidden.tsx`, `components/ui/core.test.tsx`
- Create: `lib/cx.ts`

**Interfaces:**
- Produces: `Button({variant: "primary"|"ghost"|"link", size?: "md"|"lg", ...buttonProps})`, `TextLink({href, children})`, `Badge({tone?: "neutral"|"accent"})`, `Spinner()`, `Skeleton({className})`, `EmptyState({title, body?, action?})`, `VisuallyHidden({children})`, `cx(...classes)` string joiner. All later UI consumes these exact names.

- [ ] **Step 1: Failing tests**

`components/ui/core.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Button } from "./Button";
import { Badge } from "./Badge";
import { EmptyState } from "./EmptyState";

it("Button renders variants as real buttons", () => {
  render(<Button variant="primary">Book the night</Button>);
  expect(screen.getByRole("button", { name: "Book the night" })).toBeEnabled();
});

it("Badge renders tone", () => {
  render(<Badge tone="accent">New</Badge>);
  expect(screen.getByText("New")).toBeInTheDocument();
});

it("EmptyState shows title and action", () => {
  render(<EmptyState title="No photos yet" action={<Button variant="ghost">Upload</Button>} />);
  expect(screen.getByText("No photos yet")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Upload" })).toBeInTheDocument();
});
```

Run: `npm test` → FAIL (modules not found).

- [ ] **Step 2: Implement**

`lib/cx.ts`:

```ts
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
```

`components/ui/Button.tsx`:

```tsx
import { cx } from "@/lib/cx";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant: "primary" | "ghost" | "link";
  size?: "md" | "lg";
};

const base =
  "font-ui uppercase tracking-[0.14em] rounded-brand transition-colors duration-cine-fast ease-cinematic disabled:opacity-50 disabled:pointer-events-none";
const variants = {
  primary: "bg-accent text-nightfall font-semibold hover:brightness-110",
  ghost:
    "border border-surface-fg/35 text-surface-fg hover:border-surface-fg/70",
  link: "normal-case tracking-normal text-accent border-b border-accent rounded-none pb-0.5",
};
const sizes = { md: "px-6 py-3 text-xs", lg: "px-8 py-4 text-sm" };

export function Button({ variant, size = "md", className, ...rest }: Props) {
  return (
    <button
      className={cx(base, variants[variant], variant !== "link" && sizes[size], className)}
      {...rest}
    />
  );
}
```

`components/ui/TextLink.tsx`:

```tsx
import Link from "next/link";

export function TextLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`text-accent border-b border-accent/60 pb-0.5 transition-colors duration-cine-fast hover:border-accent ${className ?? ""}`}
    >
      {children}
    </Link>
  );
}
```

`components/ui/Badge.tsx`:

```tsx
export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "accent";
  children: React.ReactNode;
}) {
  const tones = {
    neutral: "text-surface-muted border-surface-fg/20",
    accent: "text-accent border-accent/40",
  };
  return (
    <span
      className={`font-ui text-[11px] uppercase tracking-[0.18em] border rounded-brand px-2 py-0.5 ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
```

`components/ui/Spinner.tsx`:

```tsx
export function Spinner() {
  return (
    <span
      role="status"
      aria-label="Loading"
      className="inline-block size-4 animate-spin rounded-full border-2 border-surface-fg/25 border-t-accent motion-reduce:animate-none"
    />
  );
}
```

`components/ui/Skeleton.tsx`:

```tsx
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse rounded-brand bg-surface-fg/10 motion-reduce:animate-none ${className ?? ""}`}
    />
  );
}
```

`components/ui/EmptyState.tsx`:

```tsx
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <p className="font-display text-2xl text-surface-fg">{title}</p>
      {body ? <p className="max-w-md text-sm text-surface-muted">{body}</p> : null}
      {action}
    </div>
  );
}
```

`components/ui/VisuallyHidden.tsx`:

```tsx
export function VisuallyHidden({ children }: { children: React.ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
```

- [ ] **Step 3: Verify + commit**

Run: `npm test` → all PASS. `npm run build` → exit 0.

```bash
git add -A && git commit -m "feat: core UI primitives (Button, TextLink, Badge, Spinner, Skeleton, EmptyState)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Radix primitives: Dialog, Popover, Tabs, Toast, Field/Input/Textarea, Select

**Files:**
- Create: `components/ui/Dialog.tsx`, `components/ui/Popover.tsx`, `components/ui/Tabs.tsx`, `components/ui/Toast.tsx`, `components/ui/Field.tsx`, `components/ui/Select.tsx`, `components/ui/radix.test.tsx`

**Interfaces:**
- Consumes: `cx` from Task 6.
- Produces: `Dialog({open, onOpenChange, title, children, footer?})`, `Popover({trigger, children})`, `Tabs({items: {value, label, content}[], defaultValue})`, `toast(message: string)` + `<Toaster />` (module-level emitter, mount Toaster once in layout), `Field({label, error?, children})`, `Input`/`Textarea` (styled forwardRef), `Select({value, onValueChange, options: {value, label}[], placeholder?})`.

- [ ] **Step 1: Install**

```bash
npm install --save-exact @radix-ui/react-dialog @radix-ui/react-popover @radix-ui/react-tabs @radix-ui/react-toast @radix-ui/react-select
```

- [ ] **Step 2: Failing tests**

`components/ui/radix.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { useState } from "react";
import { Dialog } from "./Dialog";
import { Field, Input } from "./Field";
import { Toaster, toast } from "./Toast";

function DialogHost() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>open</button>
      <Dialog open={open} onOpenChange={setOpen} title="Publish page?">
        <p>Draft goes live.</p>
      </Dialog>
    </>
  );
}

it("Dialog opens with accessible title", async () => {
  render(<DialogHost />);
  await userEvent.click(screen.getByText("open"));
  expect(await screen.findByRole("dialog", { name: "Publish page?" })).toBeVisible();
});

it("Field wires label to input and shows error", () => {
  render(
    <Field label="Email" error="Required">
      <Input name="email" />
    </Field>,
  );
  expect(screen.getByLabelText("Email")).toBeInTheDocument();
  expect(screen.getByText("Required")).toBeInTheDocument();
});

it("toast() renders via Toaster", async () => {
  render(<Toaster />);
  toast("Saved");
  expect(await screen.findByText("Saved")).toBeVisible();
});
```

Run: `npm test` → FAIL.

- [ ] **Step 3: Implement**

`components/ui/Dialog.tsx`:

```tsx
"use client";
import * as RD from "@radix-ui/react-dialog";

export function Dialog({
  open,
  onOpenChange,
  title,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-(--z-overlay) bg-black/60 backdrop-blur-sm" />
        <RD.Content
          data-surface="dark"
          className="fixed left-1/2 top-1/2 z-(--z-overlay) w-[min(92vw,480px)] -translate-x-1/2 -translate-y-1/2 rounded-brand border border-surface-fg/15 bg-(--surface-raised) p-6 text-surface-fg"
        >
          <RD.Title className="font-display text-xl">{title}</RD.Title>
          <div className="mt-3 text-sm text-surface-muted">{children}</div>
          {footer ? <div className="mt-6 flex justify-end gap-3">{footer}</div> : null}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
```

`components/ui/Popover.tsx`:

```tsx
"use client";
import * as RP from "@radix-ui/react-popover";

export function Popover({
  trigger,
  children,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <RP.Root>
      <RP.Trigger asChild>{trigger}</RP.Trigger>
      <RP.Portal>
        <RP.Content
          sideOffset={6}
          className="z-(--z-overlay) rounded-brand border border-surface-fg/15 bg-(--surface-raised) p-3 text-sm text-surface-fg shadow-xl"
        >
          {children}
        </RP.Content>
      </RP.Portal>
    </RP.Root>
  );
}
```

`components/ui/Tabs.tsx`:

```tsx
"use client";
import * as RT from "@radix-ui/react-tabs";

export function Tabs({
  items,
  defaultValue,
}: {
  items: { value: string; label: string; content: React.ReactNode }[];
  defaultValue: string;
}) {
  return (
    <RT.Root defaultValue={defaultValue}>
      <RT.List className="flex gap-6 border-b border-surface-fg/15">
        {items.map((i) => (
          <RT.Trigger
            key={i.value}
            value={i.value}
            className="pb-2 font-ui text-xs uppercase tracking-[0.16em] text-surface-muted data-[state=active]:border-b data-[state=active]:border-accent data-[state=active]:text-surface-fg"
          >
            {i.label}
          </RT.Trigger>
        ))}
      </RT.List>
      {items.map((i) => (
        <RT.Content key={i.value} value={i.value} className="pt-4">
          {i.content}
        </RT.Content>
      ))}
    </RT.Root>
  );
}
```

`components/ui/Toast.tsx`:

```tsx
"use client";
import * as RTo from "@radix-ui/react-toast";
import { useEffect, useState } from "react";

type Entry = { id: number; message: string };
const listeners = new Set<(message: string) => void>();

export function toast(message: string) {
  for (const l of listeners) l(message);
}

export function Toaster() {
  const [entries, setEntries] = useState<Entry[]>([]);
  useEffect(() => {
    const add = (message: string) =>
      setEntries((e) => [...e, { id: Date.now() + Math.random(), message }]);
    listeners.add(add);
    return () => void listeners.delete(add);
  }, []);
  return (
    <RTo.Provider swipeDirection="right" duration={4000}>
      {entries.map((e) => (
        <RTo.Root
          key={e.id}
          onOpenChange={(open) =>
            !open && setEntries((prev) => prev.filter((p) => p.id !== e.id))
          }
          className="rounded-brand border border-surface-fg/15 bg-(--surface-raised) px-4 py-3 text-sm text-surface-fg"
        >
          <RTo.Description>{e.message}</RTo.Description>
        </RTo.Root>
      ))}
      <RTo.Viewport className="fixed bottom-6 right-6 z-(--z-toast) flex w-80 flex-col gap-2" />
    </RTo.Provider>
  );
}
```

`components/ui/Field.tsx`:

```tsx
"use client";
import { forwardRef, useId } from "react";
import { cx } from "@/lib/cx";

const inputCls =
  "w-full rounded-brand border border-surface-fg/25 bg-transparent px-3 py-2.5 text-sm text-surface-fg placeholder:text-surface-muted focus:border-accent focus:outline-none";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cx(inputCls, className)} {...rest} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx(inputCls, "min-h-28", className)} {...rest} />;
});

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactElement<{ id?: string; "aria-invalid"?: boolean }>;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-ui text-[11px] uppercase tracking-[0.2em] text-surface-muted">
        {label}
      </label>
      {cloneElement(children, { id, "aria-invalid": !!error })}
      {error ? <p className="text-xs text-accent">{error}</p> : null}
    </div>
  );
}
```

(Add `cloneElement` to the react import at the top: `import { cloneElement, forwardRef, useId } from "react";`)

`components/ui/Select.tsx`:

```tsx
"use client";
import * as RS from "@radix-ui/react-select";

export function Select({
  value,
  onValueChange,
  options,
  placeholder,
}: {
  value?: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <RS.Root value={value} onValueChange={onValueChange}>
      <RS.Trigger className="flex w-full items-center justify-between rounded-brand border border-surface-fg/25 px-3 py-2.5 text-sm text-surface-fg data-[placeholder]:text-surface-muted">
        <RS.Value placeholder={placeholder} />
        <RS.Icon>▾</RS.Icon>
      </RS.Trigger>
      <RS.Portal>
        <RS.Content className="z-(--z-overlay) rounded-brand border border-surface-fg/15 bg-(--surface-raised) p-1 text-surface-fg">
          <RS.Viewport>
            {options.map((o) => (
              <RS.Item
                key={o.value}
                value={o.value}
                className="cursor-pointer rounded-brand px-3 py-2 text-sm outline-none data-[highlighted]:bg-surface-fg/10"
              >
                <RS.ItemText>{o.label}</RS.ItemText>
              </RS.Item>
            ))}
          </RS.Viewport>
        </RS.Content>
      </RS.Portal>
    </RS.Root>
  );
}
```

- [ ] **Step 4: Verify + commit**

Run: `npm test` → PASS. `npm run build` → exit 0.

```bash
git add -A && git commit -m "feat: Radix-backed primitives (Dialog, Popover, Tabs, Toast, Field, Select)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: /styleguide route (both surfaces)

**Files:**
- Create: `app/styleguide/page.tsx`
- Modify: `e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: every primitive from Tasks 6–7, `Wordmark`, `Surface`.
- Produces: dev/preview reference page at `/styleguide`; e2e coverage that both surfaces render.

- [ ] **Step 1: Page**

`app/styleguide/page.tsx`:

```tsx
"use client";
import { useState } from "react";
import { Surface } from "@/components/Surface";
import { Wordmark } from "@/components/Wordmark";
import { Button } from "@/components/ui/Button";
import { TextLink } from "@/components/ui/TextLink";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Dialog } from "@/components/ui/Dialog";
import { Popover } from "@/components/ui/Popover";
import { Tabs } from "@/components/ui/Tabs";
import { Toaster, toast } from "@/components/ui/Toast";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";

function Kit({ surface }: { surface: "dark" | "light" }) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<string | undefined>();
  return (
    <Surface mode={surface} className="bg-surface p-10 text-surface-fg">
      <p className="mb-6 font-ui text-[11px] uppercase tracking-[0.3em] text-surface-muted">
        surface: {surface}
      </p>
      <div className="mb-8"><Wordmark size="lg" /></div>
      <h2 className="font-display text-3xl">
        Display heading <em className="font-light">with italics</em>
      </h2>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button variant="primary">Book the night</Button>
        <Button variant="ghost">See the work</Button>
        <Button variant="link">Pricing</Button>
        <TextLink href="#">A text link</TextLink>
        <Badge tone="accent">New</Badge>
        <Badge>Neutral</Badge>
        <Spinner />
      </div>
      <div className="mt-6 grid max-w-md gap-4">
        <Field label="Email"><Input placeholder="you@example.com" /></Field>
        <Field label="Message" error="Required"><Textarea /></Field>
        <Select
          value={sel}
          onValueChange={setSel}
          placeholder="Session type"
          options={[
            { value: "formal", label: "Formal" },
            { value: "portrait", label: "Portrait" },
          ]}
        />
      </div>
      <div className="mt-6 flex gap-4">
        <Button variant="ghost" onClick={() => setOpen(true)}>Open dialog</Button>
        <Popover trigger={<Button variant="ghost">Popover</Button>}>Hello from a popover.</Popover>
        <Button variant="ghost" onClick={() => toast("Saved")}>Toast</Button>
      </div>
      <div className="mt-8 max-w-md">
        <Tabs
          defaultValue="one"
          items={[
            { value: "one", label: "Overview", content: <Skeleton className="h-16" /> },
            { value: "two", label: "Details", content: <EmptyState title="No photos yet" body="Uploads will appear here." /> },
          ]}
        />
      </div>
      <Dialog open={open} onOpenChange={setOpen} title="Publish page?"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={() => setOpen(false)}>Publish</Button></>}>
        Your draft goes live immediately.
      </Dialog>
      <Toaster />
    </Surface>
  );
}

export default function Styleguide() {
  return (
    <main>
      <Kit surface="dark" />
      <Kit surface="light" />
    </main>
  );
}
```

- [ ] **Step 2: e2e assertion**

Append to `e2e/smoke.spec.ts`:

```ts
test("styleguide renders both surfaces", async ({ page }) => {
  await page.goto("/styleguide");
  await expect(page.locator('[data-surface="dark"]').first()).toBeVisible();
  await expect(page.locator('[data-surface="light"]').first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Book the night" }).first()).toBeVisible();
});
```

Run: `npm run test:e2e` → PASS. Visually check `/styleguide` in the browser on both surfaces.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: /styleguide reference page in both surfaces + e2e

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: shadcn (admin-quarantined) + ESLint boundary

**Files:**
- Create: `components/admin-ui/` (shadcn output dir), `components.json`
- Modify: `eslint.config.mjs`

**Interfaces:**
- Produces: shadcn generator configured to emit into `components/admin-ui`; lint error if anything outside `app/admin/**` imports from it.

- [ ] **Step 1: Init shadcn into quarantine dir**

```bash
npx shadcn@latest init
```

When prompted (or via `components.json` after): set component alias to `@/components/admin-ui`, css `app/globals.css`, keep the brand tokens (do NOT let it overwrite `@theme` — if init rewrites globals.css, restore the token block from git and merge shadcn's additions below it). Add one exemplar: `npx shadcn@latest add button` → emitted at `components/admin-ui/button.tsx`.

- [ ] **Step 2: Boundary rule**

In `eslint.config.mjs`, add to the exported array:

```js
{
  files: ["**/*.{ts,tsx}"],
  ignores: ["app/admin/**", "components/admin-ui/**"],
  rules: {
    "no-restricted-imports": [
      "error",
      { patterns: [{ group: ["@/components/admin-ui/*", "**/admin-ui/*"], message: "shadcn primitives are admin-only. Use components/ui/* on public surfaces." }] },
    ],
  },
},
```

- [ ] **Step 3: Prove the rule works**

Temporarily add `import "@/components/admin-ui/button";` to `app/styleguide/page.tsx`, run `npm run lint` → expect ERROR with the quarantine message. Remove the import, `npm run lint` → clean.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: shadcn quarantined to admin-ui with ESLint boundary

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Port Firebase singletons + session library

**Files:**
- Create: `lib/firebase-admin.ts`, `lib/firebase.ts`, `lib/session.ts`, `lib/session.test.ts`
- Reference: REF `lib/firebase-admin.ts`, REF `lib/firebase.ts`, REF `lib/session.ts`

**Interfaces:**
- Produces: `adminAuth`, `adminDb` (server singletons); `createSession(idToken)`, `getSessionUser(): Promise<SessionUser | null>`, `getSessionOrNull()`, `requireSession()`, `requireAdmin()`, `clearSession()`; `SessionUser = { uid: string; email: string | null; role: "ADMIN" | "CLIENT" }`. Task 11 consumes all of these.

- [ ] **Step 1: Copy reference files**

Copy REF `lib/firebase-admin.ts` and REF `lib/firebase.ts` verbatim (they are sound per the 2026-07-02 audit — keep the `FIREBASE_PRIVATE_KEY` `.replace(/\\n/g, "\n")` normalization and the lazy-throwing proxies). Copy REF `lib/session.ts` and then apply Step 2's changes.

- [ ] **Step 2: Port adjustments to `lib/session.ts`**

Keep: cookie name `__session`, 14-day expiry, httpOnly/secure/lax flags, `verifySessionCookie(cookie, true)` (checkRevoked), `requireAdmin` claim-then-Firestore fallback, the exported helper set.
Change: (a) export the `SessionUser` type shown in Interfaces; (b) `getSessionOrNull` must return `null` (not a CLIENT-role fallback) when the Firestore role lookup throws — the audit flagged the fail-open; callers decide their own fallback.

- [ ] **Step 3: Failing unit tests (mock firebase-admin)**

`lib/session.test.ts`:

```ts
import { beforeEach, expect, it, vi } from "vitest";

const verifySessionCookie = vi.fn();
const getDoc = vi.fn();
vi.mock("./firebase-admin", () => ({
  adminAuth: { verifySessionCookie, createSessionCookie: vi.fn() },
  adminDb: { collection: () => ({ doc: () => ({ get: getDoc }) }) },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "cookie" }), set: vi.fn(), delete: vi.fn() }),
}));

import { getSessionOrNull, getSessionUser } from "./session";

beforeEach(() => vi.clearAllMocks());

it("returns ADMIN from JWT claim without Firestore lookup", async () => {
  verifySessionCookie.mockResolvedValue({ uid: "u1", email: "a@b.c", role: "ADMIN" });
  const s = await getSessionUser();
  expect(s).toMatchObject({ uid: "u1", role: "ADMIN" });
  expect(getDoc).not.toHaveBeenCalled();
});

it("falls back to Firestore role for legacy sessions", async () => {
  verifySessionCookie.mockResolvedValue({ uid: "u1", email: "a@b.c" });
  getDoc.mockResolvedValue({ exists: true, data: () => ({ role: "ADMIN" }) });
  const s = await getSessionUser();
  expect(s?.role).toBe("ADMIN");
});

it("getSessionOrNull returns null when role lookup throws (no CLIENT fail-open)", async () => {
  verifySessionCookie.mockResolvedValue({ uid: "u1", email: "a@b.c" });
  getDoc.mockRejectedValue(new Error("firestore down"));
  expect(await getSessionOrNull()).toBeNull();
});

it("returns null for invalid cookie", async () => {
  verifySessionCookie.mockRejectedValue(new Error("revoked"));
  expect(await getSessionUser()).toBeNull();
});
```

Run: `npm test lib/session.test.ts` → FAIL, then adjust the ported implementation until PASS. (Match the mock's shape to the real import names in the ported file — if the port uses `adminDb.collection("users").doc(uid).get()`, the mock above already fits.)

- [ ] **Step 4: Verify + commit**

Run: `npm test && npm run typecheck` → PASS.

```bash
git add -A && git commit -m "feat: port firebase singletons + session lib (fail-open fixed, tested)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: Auth API routes + AuthProvider + minimal /login + e2e

**Files:**
- Create: `app/api/auth/session/route.ts`, `app/api/auth/signout/route.ts`, `components/AuthProvider.tsx`, `app/login/page.tsx`, `e2e/auth.spec.ts`
- Reference: REF `app/api/auth/session/route.ts`, REF `app/api/auth/signout/route.ts`, REF `components/AuthProvider.tsx`, REF `app/login/LoginForm.tsx`
- Copy env: `cp ../korrinsphotos/.env.local .env.local`

**Interfaces:**
- Consumes: Task 10 exports; Task 6/7 primitives for the login form.
- Produces: working sign-in round trip incl. admin `needsRefresh` two-step; `useAuth()` context with `afterSignIn()`; minimal email/password + Google login page (plumbing-grade, restyled properly in SP3/4).

- [ ] **Step 1: Port routes + provider**

Copy the three REF files, updating imports to the new repo's paths. Keep the `needsRefresh` protocol exactly: server sets `role: "ADMIN"` custom claim for `ADMIN_EMAILS` matches and returns `{ needsRefresh: true }` without a cookie; client force-refreshes the ID token and re-POSTs; cookie minted with the claim. Keep the `users/{uid}` upsert on every sign-in.

- [ ] **Step 2: Minimal login page**

`app/login/page.tsx` — client component using `Field`/`Input`/`Button`, email+password sign-in and sign-up, Google `signInWithPopup`, calling `afterSignIn()` from `useAuth()`, then `router.push("/styleguide")`. Reference REF `app/login/LoginForm.tsx` for the firebase calls (`signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, `GoogleAuthProvider`); strip the magic-link completion logic (not needed until SP4) and all inline styles.

- [ ] **Step 3: Env-gated e2e**

`e2e/auth.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

const email = process.env.TEST_ADMIN_EMAIL;
const password = process.env.TEST_ADMIN_PASSWORD;

test.skip(!email || !password, "TEST_ADMIN_EMAIL/PASSWORD not set");

test("admin sign-in round trip mints session cookie", async ({ page, context }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/styleguide");
  const cookies = await context.cookies();
  expect(cookies.some((c) => c.name === "__session")).toBe(true);
});
```

Run locally with real creds: `TEST_ADMIN_EMAIL=... TEST_ADMIN_PASSWORD=... npm run test:e2e e2e/auth.spec.ts` → PASS. In CI (no secrets): reported as skipped.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: auth routes + provider + minimal login, env-gated e2e round trip

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 12: Port storage (R2 + Cloudflare Images)

**Files:**
- Create: `lib/storage/r2.ts`, `lib/storage/images.ts`, `lib/storage/images.test.ts`, `lib/storage/r2.integration.test.ts`
- Reference: REF `lib/storage/r2.ts`, REF `lib/storage/images.ts`

**Interfaces:**
- Produces (same names as REF): `generatePresignedUploadUrl`, `createMultipartUpload`, `generatePresignedPartUrls`, `completeMultipartUpload`, `abortMultipartUpload`, `generatePresignedGetUrl`, `deleteFromR2`, `listObjectsV2`; `uploadToCloudflareImages`, `deleteFromCloudflareImages`, `buildCdnUrl(imageId, variant?: "thumbnail" | "gallery" | "download" | "public")`. No `lib/cloudflare.ts` facade.

- [ ] **Step 1: Copy both files from REF verbatim** (audited sound), fixing only import paths.

- [ ] **Step 2: Unit test for the pure part**

`lib/storage/images.test.ts`:

```ts
import { expect, it, vi } from "vitest";

vi.stubEnv("NEXT_PUBLIC_CLOUDFLARE_IMAGES_URL", "https://imagedelivery.net/HASH");
const { buildCdnUrl } = await import("./images");

it("builds variant URLs", () => {
  expect(buildCdnUrl("abc123", "thumbnail")).toBe(
    "https://imagedelivery.net/HASH/abc123/thumbnail",
  );
});

it("defaults to gallery variant", () => {
  expect(buildCdnUrl("abc123")).toBe("https://imagedelivery.net/HASH/abc123/gallery");
});
```

Run: `npm test lib/storage` → PASS (adjust expectations to the ported implementation's actual default if it differs — the REF default is `gallery`).

- [ ] **Step 3: Env-gated R2 integration test**

`lib/storage/r2.integration.test.ts`:

```ts
import { describe, expect, it } from "vitest";

const gated = !process.env.CLOUDFLARE_R2_ENDPOINT;

describe.skipIf(gated)("R2 round trip", () => {
  it("presigns PUT, uploads, presigns GET, reads back, deletes", async () => {
    const { generatePresignedUploadUrl, generatePresignedGetUrl, deleteFromR2 } =
      await import("./r2");
    const key = `foundation-test/${Date.now()}.txt`;
    const { presignedUrl } = await generatePresignedUploadUrl({
      key,
      contentType: "text/plain",
    });
    const put = await fetch(presignedUrl, { method: "PUT", body: "goldenrod" });
    expect(put.ok).toBe(true);
    const getUrl = await generatePresignedGetUrl(key, 60);
    const body = await (await fetch(getUrl)).text();
    expect(body).toBe("goldenrod");
    await deleteFromR2(key);
  });
});
```

Note: match the exact exported signature of the ported `generatePresignedUploadUrl` (REF's takes `{ eventId, fileName, contentType }` and derives the key — if so, adapt the test to that signature rather than changing the port).

Run with `.env.local` present: `npm test lib/storage` → PASS. Without env: skipped.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: port R2 + Cloudflare Images storage layer with tests

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 13: Port Stripe + webhook skeleton (idempotency fixed)

**Files:**
- Create: `lib/stripe.ts`, `app/api/webhooks/stripe/route.ts`, `app/api/webhooks/stripe/idempotency.ts`, `app/api/webhooks/stripe/idempotency.test.ts`
- Reference: REF `lib/stripe.ts`, REF `app/api/webhooks/stripe/route.ts`

**Interfaces:**
- Produces: `stripe` singleton (pinned apiVersion, **throws at import in production if `STRIPE_SECRET_KEY` unset** — no mock-key fallback); `claimEvent(eventId: string): Promise<boolean>` (atomic, returns false if already claimed); webhook route verifying signatures and dispatching to a `handlers: Record<string, (event: Stripe.Event) => Promise<void>>` map that SP5 will populate. Payment-link helpers ported as-is.

- [ ] **Step 1: Port `lib/stripe.ts`** from REF, replacing the `sk_test_mock` fallback with a **lazy-throwing pattern matching `lib/firebase-admin.ts`** (decision 2026-07-03, review adjudication: module-eval throw coupled `next build` to secret availability; lazy keeps builds env-free while a misconfigured production runtime still throws loudly on first Stripe use — and no mock key ever exists in production):

```ts
// Lazy singleton: no secret needed at build time; first use without
// STRIPE_SECRET_KEY throws in production (dev warns + placeholder).
let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("STRIPE_SECRET_KEY is required in production");
    }
    console.warn("[stripe] STRIPE_SECRET_KEY not set — Stripe calls will fail");
  }
  _stripe = new Stripe(key ?? "sk_test_placeholder", {
    apiVersion: "2026-04-22.dahlia" as never, // pinned account apiVersion; cast scoped to the literal
  });
  return _stripe;
}
```

(Callers use `getStripe()`; a `stripe` proxy export delegating property access to `getStripe()` is an acceptable equivalent.)

- [ ] **Step 2: Failing idempotency test**

`app/api/webhooks/stripe/idempotency.test.ts`:

```ts
import { beforeEach, expect, it, vi } from "vitest";

const create = vi.fn();
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: () => ({ doc: () => ({ create }) }) },
}));

import { claimEvent } from "./idempotency";

beforeEach(() => vi.clearAllMocks());

it("claims an unseen event", async () => {
  create.mockResolvedValue(undefined);
  expect(await claimEvent("evt_1")).toBe(true);
});

it("refuses a duplicate delivery (create throws ALREADY_EXISTS)", async () => {
  create.mockRejectedValue(Object.assign(new Error("exists"), { code: 6 }));
  expect(await claimEvent("evt_1")).toBe(false);
});

it("double delivery executes the handler exactly once", async () => {
  create
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(Object.assign(new Error("exists"), { code: 6 }));
  const handler = vi.fn();
  for (const _ of [1, 2]) {
    if (await claimEvent("evt_2")) await handler();
  }
  expect(handler).toHaveBeenCalledTimes(1);
});
```

Run: `npm test idempotency` → FAIL.

- [ ] **Step 3: Implement**

`app/api/webhooks/stripe/idempotency.ts`:

```ts
import { adminDb } from "@/lib/firebase-admin";

/** Atomically claim a Stripe event id. True = we own it; false = already processed. */
export async function claimEvent(eventId: string): Promise<boolean> {
  try {
    await adminDb
      .collection("stripeWebhookEvents")
      .doc(eventId)
      .create({ processedAt: new Date() });
    return true;
  } catch (err) {
    if ((err as { code?: number }).code === 6) return false; // ALREADY_EXISTS
    throw err;
  }
}
```

`app/api/webhooks/stripe/route.ts` — port REF's signature verification exactly (400 on missing sig/secret/bad signature), then:

```ts
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { claimEvent } from "./idempotency";

export const runtime = "nodejs";

const handlers: Record<string, (event: Stripe.Event) => Promise<void>> = {
  // populated in sub-project 5 (invoice payment, refunds, disputes, product delivery)
};

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return new NextResponse("missing signature", { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), sig, secret);
  } catch {
    return new NextResponse("invalid signature", { status: 400 });
  }
  if (!(await claimEvent(event.id))) return NextResponse.json({ duplicate: true });
  const handler = handlers[event.type];
  if (handler) await handler(event);
  return NextResponse.json({ received: true });
}
```

Run: `npm test idempotency` → PASS. `npm run typecheck` → PASS.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: stripe port with atomic webhook idempotency (double-delivery tested)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 14: lib/db convention + users exemplar + repo docs

**Files:**
- Create: `lib/db/users.ts`, `lib/db/users.test.ts`, `CLAUDE.md`, `docs/CONVENTIONS.md`

**Interfaces:**
- Produces: `UserDoc { uid, email, role: "ADMIN" | "CLIENT", displayName?, createdAt, updatedAt }`, `usersCol()`, `getUser(uid)`, `upsertUser(uid, data)`; the documented module shape every future `lib/db/*` file follows.

- [ ] **Step 1: Failing test**

`lib/db/users.test.ts`:

```ts
import { expect, it, vi } from "vitest";

const set = vi.fn();
const get = vi.fn();
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: () => ({ doc: () => ({ set, get }) }) },
}));

import { getUser, upsertUser } from "./users";

it("upsertUser merges with timestamps", async () => {
  await upsertUser("u1", { email: "a@b.c", role: "CLIENT" });
  expect(set).toHaveBeenCalledWith(
    expect.objectContaining({ email: "a@b.c", role: "CLIENT", updatedAt: expect.anything() }),
    { merge: true },
  );
});

it("getUser returns null when missing", async () => {
  get.mockResolvedValue({ exists: false });
  expect(await getUser("nope")).toBeNull();
});
```

Run → FAIL.

- [ ] **Step 2: Implement**

`lib/db/users.ts`:

```ts
import { adminDb } from "@/lib/firebase-admin";

export interface UserDoc {
  uid: string;
  email: string;
  role: "ADMIN" | "CLIENT";
  displayName?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export function usersCol() {
  return adminDb.collection("users");
}

export async function getUser(uid: string): Promise<UserDoc | null> {
  const snap = await usersCol().doc(uid).get();
  return snap.exists ? ({ uid, ...snap.data() } as UserDoc) : null;
}

export async function upsertUser(
  uid: string,
  data: Partial<Omit<UserDoc, "uid">>,
): Promise<void> {
  await usersCol().doc(uid).set({ ...data, updatedAt: new Date() }, { merge: true });
}
```

Run → PASS.

- [ ] **Step 3: Repo docs**

`docs/CONVENTIONS.md` — document: the `lib/db/*` module shape (col getter + `Doc` interface + pure async helpers; server-only; modules never import each other; cross-collection logic goes to `lib/domain/*` later); the two-surface token system and that all styling is Tailwind classes on tokens (no inline styles); the shadcn admin quarantine; env-gated test pattern; exact-pin dependency policy (`node scripts/pin-deps.mjs` after any install).

`CLAUDE.md` (new repo, concise): project identity (Goldenrod Photography rebuild of korrinsphotos), pointer to the two specs in REF `docs/superpowers/specs/`, the conventions doc, the commands (`dev/build/lint/typecheck/test/test:e2e`), env-var list (same names as REF), and the rule that REF is read-only reference.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: lib/db convention with users exemplar; repo CLAUDE.md + conventions

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 15: Vercel project + deploy

**Files:**
- Create: `vercel.json` (only if needed — default zero-config preferred)

**Interfaces:**
- Produces: production deployment + preview URLs on PRs. Acceptance criterion 1.

- [ ] **Step 1: Link and deploy (user-assisted auth)**

```bash
npm i -g vercel
vercel login        # user completes browser auth
vercel link         # create new project "goldenrod"
vercel env pull .env.vercel-check   # confirm project env starts empty
```

Then add env vars from `.env.local` to the Vercel project (Production + Preview) via `vercel env add` for each var name used in Global Constraints, or the dashboard.

- [ ] **Step 2: Deploy + verify**

```bash
vercel deploy --prod
```

Expected: build succeeds; visiting the deployment URL shows the app; `/styleguide` renders both surfaces with fonts. Open a trivial PR and confirm a preview URL appears.

- [ ] **Step 3: Commit anything generated and push**

```bash
git add -A && git commit -m "chore: vercel project config" --allow-empty
git push
```

---

## Verification checklist (spec acceptance criteria → tasks)

1. Deployed on Vercel with PR previews → Task 15 (+ Task 3 CI).
2. `/styleguide` shows all primitives in both surfaces → Task 8.
3. Auth round trip incl. `needsRefresh` verified by Playwright → Task 11 (env-gated).
4. R2 presign/upload/CDN round trip integration test → Task 12 (env-gated).
5. Stripe signature + idempotency unit tests incl. double delivery → Task 13.
6. Zero `latest`/caret versions; build + suite green → Tasks 1–15 (pin script Task 1).
