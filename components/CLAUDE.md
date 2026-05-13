# CLAUDE.md — `components/`

Shared React components consumed by routes under `app/`. No data fetching
belongs here — components receive props or call `useAuth()`.

---

## Layout

Files: `AuthProvider.tsx`, `Footer.tsx`, `HeroSlideshow.tsx`, `Lightbox.tsx`,
`MasonryGrid.tsx`, `Navbar.tsx` at the root; `admin/AdminSidebar.tsx` for
admin-only UI; `ui/Toaster.tsx` for cross-cutting primitives.

- Default home is the **root** of `components/`.
- `components/admin/` — admin-only UI, imported only by `app/admin/**`.
- `components/ui/` — app-wide UI primitives (toasts, future modal/button).
- Pick by audience, not size.

---

## Server vs Client

No folder distinction. The first line decides:

| First line | Kind | Allowed |
|---|---|---|
| `"use client";` | Client | hooks, refs, event handlers, browser APIs, Firebase client SDK |
| (none) | Server | direct Firestore via `adminDb`, async, no hooks |

`AuthProvider`, `Navbar`, `Toaster`, `Lightbox`, `MasonryGrid`,
`HeroSlideshow` are Client. `Footer` is Server. Never call
`lib/firebase-admin`, `lib/db/*`, `lib/storage/*`, `lib/session`, or
`lib/stripe` from a Client Component (root CLAUDE.md rule 1).

---

## `AuthProvider` — Single Owner of Auth State

Wrapped around the app in `app/layout.tsx`. Consumers read only via
`useAuth()`: `const { user, loading, signOut, afterSignIn } = useAuth();`.

Responsibilities: (1) `onAuthStateChanged` subscription keeps `user` in
sync; (2) magic-link completion detects `isSignInWithEmailLink`, calls
`signInWithEmailLink` with `localStorage.emailForSignIn`, redirects to
`/gallery`; (3) `afterSignIn()` POSTs the ID token to
`/api/auth/session`. On `{ needsRefresh: true }` (admin first login) it
force-refreshes and re-POSTs so the cookie embeds `role:"ADMIN"`.

Never instantiate `firebase/auth` directly elsewhere — it breaks the
two-step admin flow.

---

## `Toaster` — Event-Driven, No Context

`components/ui/Toaster.tsx` exports `<Toaster />` (mounted once in
`app/layout.tsx`) and `toast(text)`. Messages fan out through a module-level
`Set` of listeners — no provider needed:

```ts
import { toast } from "@/components/ui/Toaster";
toast("Photo deleted");
```

Z-index `9000`, below the `body::before` grain overlay (`9999`), but the
container has `pointerEvents: "none"` so clicks pass through. Lightbox is
`1000`. Do not introduce a competing toast system.

---

## Image Conventions

```tsx
// eslint-disable-next-line @next/next/no-img-element
<img
  src={buildCdnUrl(photo.cloudflareImageId, "gallery")}
  alt={photo.label ?? ""}
  onContextMenu={(e) => e.preventDefault()}
  draggable={false}
/>
```

- Prefer `<img>` over `next/image`; the CDN handles resizing.
- URLs come from `buildCdnUrl(imageId, variant)` (`@/lib/cloudflare`).
  Variants in use: `"thumbnail"`, `"gallery"`. Never raw R2 URLs.
- `MasonryPhoto` (from `MasonryGrid.tsx`) is the shared photo shape across
  `MasonryGrid`, `Lightbox`, and the gallery routes.
