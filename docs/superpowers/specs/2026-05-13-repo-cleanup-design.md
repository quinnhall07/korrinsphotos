# Repo Cleanup & Claude Code Optimization — Design

Date: 2026-05-13
Branch: `Phase-1-MVP`
Author: Claude (Opus 4.7) on behalf of Quinn

## Goal

Bring the repo into a state where (a) the on-disk documentation matches the code, (b) dead code is gone, (c) the in-flight `lib/firestore.ts` → `lib/db/*` migration is *finished* (not just marker-commented), and (d) Claude Code has the config and per-area context files it needs to be fast and accurate in this repo.

## Audit Findings (verified, not assumed)

### Documentation drift

`CLAUDE.md`, `DECISION.md`, and `PROGRESS.md` were written when the codebase was a single-Event model with `lib/firestore.ts` as the only DB module. Since then a "Unified Client Lifecycle" refactor (see `NEW UNIFIED CLIENT ARCHITECTURE.txt` at the root) has shipped most of the way:

- `lib/db/{activity,bookings,clients,contracts,event-access,events,invoices,mail,photos,projects,users}.ts` — per-collection helpers (canonical).
- `lib/domain/events.ts`, `lib/storage/{r2,images}.ts`, `lib/stripe.ts`, `lib/contract-renderer.ts`, `lib/project-transitions.ts`, `lib/upload.ts`, `lib/date.ts`.
- `app/admin/projects/**` — Projects pipeline (new master state machine).
- `app/api/webhooks/stripe`, `app/api/cron/run-tasks`, `app/api/upload/multipart/{init,complete}` — new infrastructure routes.
- Middleware now sets a `__origin` UTM-attribution cookie (not documented).
- `app/booking/actions.ts` dual-writes to `projects` AND `bookingInquiries` during the transition.

None of this is reflected in the root docs.

### `lib/firestore.ts` is a 35-line facade

The file re-exports from `lib/db/*` and adds one function (`getDashboardCounts`) that **is never called**. The 7 files that still import from `lib/firestore.ts` need only trivial import-path swaps:

| File | Symbols imported | Target module |
|---|---|---|
| `app/booking/actions.ts` | `logActivity` | `@/lib/db/activity` |
| `app/admin/page.tsx` | `listRecentActivity` | `@/lib/db/activity` |
| `app/admin/bookings/inquiry-actions.ts` | `logActivity` | `@/lib/db/activity` |
| `app/admin/bookings/comms-actions.ts` | `logActivity` | `@/lib/db/activity` |
| `app/admin/projects/actions.ts` | `logActivity` | `@/lib/db/activity` |
| `app/api/auth/session/route.ts` | `upsertUser` | `@/lib/db/users` |
| `lib/lead-scoring.ts` | `BookingInquiryDoc` (type only) | `@/lib/db/bookings` |

Finishing the migration is a 15-minute job, not a refactor.

### Dead code (verified by `grep -rln` — no consumers)

- `components/SecureImage.tsx`
- `app/admin/bookings/BookingTable.tsx`
- `app/admin/bookings/ViewToggle.tsx`
- `app/admin/AdminSidebar.tsx` — duplicate of `components/admin/AdminSidebar.tsx`; `app/admin/layout.tsx` imports it from `./AdminSidebar` instead of the canonical version. ADR-012 documents the intent to consolidate.

### Other organizational issues

- `tsconfig.tsbuildinfo` (310 KB) is committed to git and not in `.gitignore`.
- `NEW UNIFIED CLIENT ARCHITECTURE.txt` (29.5 KB) is a markdown-shaped design doc at the repo root with spaces in its filename and a `.txt` extension.
- `.agents/skills/{code-simplifier,improve-codebase-architecture}.md` is a one-commit artifact from another tool's conventions. Claude Code does not load it.

## Plan

Execute in parallel via three sub-agents, each with a tightly scoped, non-overlapping set of file changes.

### Agent A — Documentation rewrite

Touches: `CLAUDE.md`, `DECISION.md`, `PROGRESS.md`, `docs/architecture/unified-client-lifecycle.md`, `docs/superpowers/specs/2026-05-13-repo-cleanup-design.md` (this file already written), `NEW UNIFIED CLIENT ARCHITECTURE.txt` (delete), and per-area `CLAUDE.md` files:

- `app/admin/CLAUDE.md`
- `app/admin/bookings/CLAUDE.md`
- `app/admin/projects/CLAUDE.md`
- `lib/db/CLAUDE.md`
- `lib/CLAUDE.md`
- `app/api/CLAUDE.md`

Root `CLAUDE.md` describes:
- The dual Event/Project model and where each lives.
- `lib/db/*` as canonical (no mention of `lib/firestore.ts` — it will be gone).
- New routes (`projects`, `webhooks/stripe`, `cron/run-tasks`, `upload/multipart`).
- The `__origin` middleware cookie.
- The dual-write transition in `app/booking/actions.ts`.

`DECISION.md` keeps ADR-001 through ADR-011 verbatim. ADR-012 (dual AdminSidebar) gets a "Resolved" note. Adds ADR-013 (split `lib/firestore.ts` → `lib/db/*`), ADR-014 (unified Client/Project model), ADR-015 (Stripe + cron worker), ADR-016 (`__origin` UTM attribution).

`PROGRESS.md` is rewritten honestly with the current state. Resolved items move out; the dual-write status, missing Firestore rules, missing pagination, etc. remain.

### Agent B — Finish the migration and remove dead code

Touches: `lib/firestore.ts` (delete), `app/booking/actions.ts`, `app/admin/page.tsx`, `app/admin/bookings/inquiry-actions.ts`, `app/admin/bookings/comms-actions.ts`, `app/admin/projects/actions.ts`, `app/api/auth/session/route.ts`, `lib/lead-scoring.ts` (rewire imports). Then:
- Delete `app/admin/AdminSidebar.tsx`, update `app/admin/layout.tsx` to import from `@/components/admin/AdminSidebar`.
- Delete `components/SecureImage.tsx`, `app/admin/bookings/BookingTable.tsx`, `app/admin/bookings/ViewToggle.tsx`.
- Delete `.agents/`.
- Add `tsconfig.tsbuildinfo` and `.claude/local/` to `.gitignore`; `git rm --cached tsconfig.tsbuildinfo`.

### Agent C — Claude Code config

Touches: `.claude/settings.json`, `.claude/agents/*` (optional).
- Allowlist `npm run build`, `npm run lint`, `npm run dev` (run-in-background), common safe git reads (`git status`, `git diff`, `git log`, `git show`), `tsc --noEmit`, `gh pr view`, `gh pr list`, `grep`, `rg`, `find` reads, `ls`.
- Permission-prompt-bypass list, not auto-execution of anything destructive.
- Optionally add a `code-simplifier` agent that mirrors the intent of `.agents/skills/code-simplifier.md` if its content is genuinely useful (drop otherwise).

## Out of Scope

- Fixing functional bugs in PROGRESS.md (galleryReady filter, r2Key persistence, double-columns bug). Tracked, not addressed.
- Firestore security rules.
- The Event-model vs Project-model dual-write — that's a multi-week migration; documented but untouched.
- Any feature work.

## Verification

1. `npm run lint` — must pass with zero errors after Agent B's import rewires.
2. `npm run build` — must pass; this catches any missed import path or type drift.
3. `git status` after agents finish — review file list, no stray edits outside the planned set.

## Commit Strategy

One commit per agent's worth of work would be cleaner history but riskier (build failures between commits). Single commit with a clear body listing the three streams. Do not push.
