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

**Sidebar nav drift:** `AdminSidebar` currently lists Dashboard, Events, Booking Inquiries, Users. It does NOT yet include a link to `/admin/projects` (the new pipeline). Add the entry to the `NAV` array when you wire the projects route into the main nav.

## Dashboard (`page.tsx`)

Single Server Component, `export const dynamic = "force-dynamic"`. Uses `adminDb.collection(...).count().get()` for cheap counts in parallel via `Promise.all`. Recent inquiries are still pulled from `bookingInquiries` (legacy collection) — when the projects migration completes, swap these to `projects`.

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
revalidatePath("/admin/bookings");
revalidatePath("/admin");
```

See `inquiry-actions.ts` for the canonical pattern.
