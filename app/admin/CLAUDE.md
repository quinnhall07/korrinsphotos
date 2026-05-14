# CLAUDE.md — /admin

Server-guarded admin shell. Everything under this path is gated by Firebase session cookie + ADMIN claim.
Boundaries, env vars, and session cookie protocol live in root CLAUDE.md > "Critical Architecture Rules".

---

## Layout & Guard

`layout.tsx` calls `await requireAdmin()` from `@/lib/session` as its **first line** before rendering. Every child page (and every Server Action) MUST repeat that call — the layout guard does not propagate into actions, and inner Server Components that omit it will leak data through Next.js's RSC stream.

```
app/admin/layout.tsx → requireAdmin() → <AdminSidebar /> + <children />
```

The sidebar component is at `components/admin/AdminSidebar.tsx` (NOT inside `app/admin/`). Import it as `@/components/admin/AdminSidebar`. It is a `"use client"` component because it uses `usePathname()` for active-link highlighting.

`AdminSidebar` is organised into four groups: **Overview** (Dashboard, Inbox, Pipeline), **Content** (Events, Locations, Vendors), **Clients** (Segments, Sequences, Questionnaires, Users), **Settings** (Automations). The `isActive` check uses `pathname.startsWith(href)` for non-root entries, so the Pipeline entry highlights for `/admin/projects` and `/admin/projects/[id]` alike.

## Dashboard (`page.tsx`)

Single Server Component, `export const dynamic = "force-dynamic"`. Uses `adminDb.collection(...).count().get()` for cheap counts in parallel via `Promise.all`. The "Pending Inquiries" counter reads `projects where status == "INQUIRY"`; the "Recent Inquiries" table reads the five most recent `projects` and joins each one's `clients/{clientId}` for the display name.

## Activity Feed

Two helpers in `lib/db/activity.ts`:

| Helper | Purpose |
|---|---|
| `logActivity(action, message, metadata?)` | Append to `activityFeed` collection with `serverTimestamp()` |
| `listRecentActivity(limit = 8)` | Read most recent N entries, returns `[]` on error |

`ActivityAction` is a closed union: `"LEAD_RECEIVED" | "STATUS_CHANGED" | "EMAIL_SENT" | "NOTE_ADDED"`. Always wrap `logActivity` calls in `.catch(() => {})` — they are best-effort and must never block the primary mutation.

## Server Action Conventions

Every mutation in `app/admin/**/*actions.ts` follows this shape:

1. `"use server"` at top of file.
2. `await requireAdmin()` (or `await requireAdmin()` capturing `session.uid` if needed).
3. Mutation against `adminDb`.
4. Best-effort `logActivity(...)`.
5. `revalidatePath` for EVERY route that displays the mutated data.

After dashboard-relevant mutations, revalidate both the specific route AND `/admin` so the dashboard cards refresh:

```ts
revalidatePath("/admin/projects");
revalidatePath("/admin");
```

See `app/admin/projects/actions.ts > updateProjectStatus` for the canonical pattern.
