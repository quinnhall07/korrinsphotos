# PROGRESS.md — Korrin's Photos

> Last updated: May 2026
> Update this file whenever a feature is completed, a bug is fixed, or a task is abandoned.
> Keep it honest — it is the source of truth for "what state is the codebase actually in."

---

## Overall Status: **Feature-Complete Prototype → Production Hardening Phase**

The core application is architecturally complete. All major user flows are implemented with real Firebase/Cloudflare integrations (not mocked). The remaining work is primarily production hardening, missing edge cases, and UX polish.

---

## Completed Features

### Infrastructure & Auth
- [x] Next.js 15 App Router project scaffolded with TypeScript strict mode
- [x] Tailwind CSS + custom CSS design system (tokens, typography, animations)
- [x] Firebase Admin SDK singleton (`lib/firebase-admin.ts`) with `\n` key normalisation
- [x] Firebase Client SDK singleton (`lib/firebase.ts`) with graceful no-config fallback
- [x] 14-day HTTP-only session cookie system (`lib/session.ts`)
- [x] `requireSession()` and `requireAdmin()` route guards with Firestore role fallback
- [x] Two-step admin session flow (first-login custom claim refresh)
- [x] Edge middleware (`middleware.ts`) for fast cookie-presence checks on `/admin` and `/gallery`
- [x] Magic link email delivery via Firebase Identity Toolkit REST API (`lib/firebase-email.ts`)
- [x] Google + Microsoft OAuth sign-in via popup
- [x] Email + password sign-up and sign-in
- [x] `AuthProvider` context with `useAuth()` hook and magic link completion handler
- [x] Sign-out flow (client Firebase + server session cookie clear)
- [x] `continueUrl` builder for magic link emails (`buildContinueUrl`)

### Cloudflare Integration
- [x] R2 pre-signed PUT URL generation (`generatePresignedUploadUrl`)
- [x] R2 pre-signed GET URL generation (`generatePresignedGetUrl`)
- [x] R2 object delete (`deleteFromR2`)
- [x] Cloudflare Images upload-from-URL (`uploadToCloudflareImages`)
- [x] Cloudflare Images delete (`deleteFromCloudflareImages`)
- [x] CDN URL builder with variants: `thumbnail`, `gallery`, `download`, `public`
- [x] `next.config.ts` remote patterns for `imagedelivery.net`, `*.r2.cloudflarestorage.com`, `picsum.photos`

### Database (Firestore)
- [x] All collection helpers in `lib/firestore.ts`: users, events, photos, eventAccess, bookingInquiries, mail, activityFeed
- [x] `upsertUser` with transaction to safely set `createdAt` only on first write
- [x] `logActivity` for admin dashboard activity feed
- [x] `listRecentActivity` with graceful empty fallback for fresh projects

### Public Pages
- [x] Home page (`/`) with hero slideshow, curated masonry grid, stats row, CTA section, footer
- [x] Portfolio page (`/portfolio`) with category filter tabs (client-side), masonry grid, lightbox
- [x] Booking page (`/booking`) — validated form → Server Action → Firestore write + auto-responder email
- [x] Login page (`/login`) with Google, Microsoft, email/password, and error state for expired links
- [x] Login complete page (`/login/complete`) for magic link finalisation
- [x] 404 (`not-found.tsx`), error boundary (`error.tsx`), root loading state (`loading.tsx`)

### Admin Dashboard
- [x] Admin layout with `requireAdmin()` guard and `AdminSidebar` navigation
- [x] Dashboard (`/admin`) — live Firestore counts, recent inquiries table, recent events table, activity feed
- [x] Events list (`/admin/events`) — table with photo/client counts, status badges, create event action
- [x] Event detail (`/admin/events/[id]`) — inline title editor, shoot date editor, Google/Outlook/.ics calendar export, upload zone, client invite panel, photo grid
- [x] Photo upload zone — full 3-step R2 pipeline with per-file progress bars and error states
- [x] Photo grid with hover-reveal delete button
- [x] Gallery editor (`/admin/events/[id]/gallery`) — bulk select, toggle `galleryReady` status
- [x] Invite panel — invite by email, revoke access, show current clients
- [x] Loading skeleton for event detail page
- [x] Booking inquiries (`/admin/bookings`) — Kanban board with HTML5 drag-and-drop between 5 pipeline columns
- [x] Lead detail drawer — tabbed (Overview / Notes & CRM / Comms / Send Email)
- [x] Lead scoring algorithm (`lib/lead-scoring.ts`) with 0-100 score, color coding, labels
- [x] Tag manager (preset + custom tags, toggle UI)
- [x] Communication logger (Phone / Email / SMS / In Person channels)
- [x] Email template selector (5 pre-built templates)
- [x] Smart filters (Hot Leads, Needs Follow-Up, High Value, This Week, Weddings)
- [x] Bulk actions bar (multi-select, bulk status change, archive with confirmation)
- [x] New inquiry modal (manual creation from admin)
- [x] Event linking (link booking inquiry to an event via `/api/events-list`)
- [x] Follow-up date setter
- [x] Lead source tracker
- [x] `sendBookingResponse` — writes to Firestore `mail` collection for Firebase Trigger Email
- [x] Users page (`/admin/users`) — role badges, event access counts, remove user action
- [x] `removeUser` — batch deletes `eventAccess` docs + disables Firebase Auth account

### Client Portal
- [x] Gallery dashboard (`/gallery`) — event cards with cover photo and photo count
- [x] Private event gallery (`/gallery/[id]`) — dual auth (session + `eventAccess` lookup), masonry 4-col grid
- [x] Gallery viewer — back link, event header, download request button (toast), lightbox
- [x] Empty state for users with no galleries yet

### UI Components
- [x] `Navbar` — role-aware links, profile avatar dropdown, admin badge, sign-out
- [x] `Toaster` — event-driven global toast, no context needed
- [x] `MasonryGrid` — CSS-columns masonry, works with SSR
- [x] `Lightbox` — keyboard nav (←, →, Escape), click-outside close, counter, label
- [x] `SecureImage` — pointer-events-none, no right-click, no drag
- [x] `HeroSlideshow` — opacity crossfade, 5s interval
- [x] `Footer`
- [x] `LeadScoreBadge` — small (inline) and medium (circular gauge) sizes
- [x] `KanbanCard` — draggable, overdue indicator, session color coding, tag chips
- [x] `ViewToggle` — segmented control for Kanban/Table toggle (Table view deprecated in favour of Kanban-only for now)
- [x] `AddToCalendarButton` — Google Calendar, Outlook, and .ics download
- [x] `TitleEditor` — click-to-edit inline title
- [x] `ShootDateEditor` — date range picker with save action

### Settings
- [x] Settings page (`/settings`) — profile, notifications, connected accounts, account/sign-out

---

## In Progress / Partially Complete

### Known Gaps (Functionality Exists But Needs Work)
- [ ] **Table view in bookings** — `BookingTable.tsx` is implemented but the `ViewToggle` button is no longer wired into `BookingsClientPage.tsx`. The Kanban board renders exclusively. Re-wire or remove the toggle entirely.
- [ ] **`r2Key` not stored on photo docs** — `app/api/upload/confirm/route.ts` does not save the `r2Key` field, so `PhotoGrid` always passes `r2Key: null` to `deletePhoto`. R2 cleanup during photo deletion silently no-ops. The key needs to be passed through from the upload pipeline and stored.
- [ ] **`galleryReady` filter on client gallery** — `app/gallery/[id]/page.tsx` fetches all photos regardless of `galleryReady` status. The admin gallery editor sets this flag but it has no effect on what clients see yet.
- [ ] **`GalleryViewer` has double-columns bug** — `app/gallery/[id]/GalleryViewer.tsx` wraps `<MasonryGrid>` in a `<div style={{ columns: 4 }}>` while also passing `columns={4}` to `MasonryGrid`. This causes double-applied column styles. Remove the outer div wrapper.
- [ ] **`SecureImage` component unused** — `components/SecureImage.tsx` is built but not used anywhere. All image rendering uses plain `<img>` tags with manual `onContextMenu`/`draggable={false}` props. Either adopt `SecureImage` consistently or document why it was skipped.
- [ ] **Settings page uses `localStorage`** — notification preferences and phone number in `app/settings/page.tsx` are stored in `localStorage`, not Firestore. Works for now but doesn't persist across devices.
- [ ] **`/api/upload/confirm` R2 URL construction** — The R2 public URL is constructed as `https://${BUCKET}.${ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`. This is the S3-compat endpoint and may not be the correct public URL depending on R2 bucket settings. Verify against actual Cloudflare account configuration.
- [ ] **Activity feed timestamps** — `activity.timestamp?.toDate?.()` in `app/admin/page.tsx` works but will fail silently if the Timestamp field is missing. Add a fallback display.

### Missing Features (Designed, Not Built)
- [ ] **Download fulfillment** — The "Request Full Download" button in `GalleryViewer` fires a toast but does not actually trigger a download or email. Needs an API route that generates a signed R2 URL (or a Cloudflare Images zip) and emails it to the client.
- [ ] **Firestore Security Rules** — No `firestore.rules` file exists. The app currently relies on Firebase Admin SDK (which bypasses rules) server-side. Client-side reads/writes from the Firebase Client SDK have no rules enforced. This is a **security gap** before production launch.
- [ ] **Firebase Auth email templates** — The sign-in link email uses Firebase's default template. Custom branding should be applied in the Firebase Console (Authentication → Templates).
- [ ] **`/admin/events/[id]` status field** — The event detail page doesn't expose a UI to change event status (`draft` / `scheduled` / `delivered` / `archived`). The field exists in the data model and is displayed on the events list, but there's no editor.
- [ ] **Pagination** — All Firestore queries are unbounded or use a small `limit()`. Admin pages that will grow (bookings, events, users) need cursor-based pagination.
- [ ] **Image category assignment on upload** — Photos are uploaded without a `category` field. The portfolio page filters by `category`, but there's no UI to assign one. Either add a category selector to the upload zone or to the photo edit flow.
- [ ] **Photo label editing** — Labels are set from the filename on upload but can't be edited afterward.
- [ ] **`/admin/bookings` archived view** — `ARCHIVED` is a valid `LeadStatus` but there's no column for it on the Kanban board (`KANBAN_STATUSES` excludes it). Archived leads are invisible once moved there. Need a filter or separate view.

---

## Bugs

| # | Location | Description | Severity |
|---|---|---|---|
| 1 | `app/gallery/[id]/GalleryViewer.tsx` | Double `columns` CSS applied (outer div + MasonryGrid prop) | Medium |
| 2 | `app/api/upload/confirm/route.ts` | `r2Key` not persisted to Firestore photo doc, breaking R2 cleanup on delete | Medium |
| 3 | `app/admin/bookings/BookingsClientPage.tsx` | `ViewToggle` imported and rendered but state change has no effect (Kanban always shows) | Low |
| 4 | `app/gallery/[id]/page.tsx` | `galleryReady` flag ignored — all uploaded photos shown to clients regardless | Medium |
| 5 | `app/admin/page.tsx` | Activity feed timestamp renders `"—"` if `toDate()` is unavailable on Timestamp | Low |

---

## Dev Placeholders Still Active

These use `picsum.photos` seeds and must be replaced before go-live:

| Location | Placeholder Used For |
|---|---|
| `app/page.tsx` `DEV_PHOTOS` | Home page masonry grid (shown when Firestore returns 0 photos) |
| `app/portfolio/page.tsx` `DEV_PHOTOS` | Portfolio grid fallback |
| `components/HeroSlideshow.tsx` | Hero background slides |
| `app/booking/page.tsx` | Left panel background image |
| `app/login/page.tsx` | Login card background |

---

## Infrastructure / Deployment Status

| Item | Status | Notes |
|---|---|---|
| Vercel deployment | ✅ Ready | Ensure all env vars set in Vercel project settings |
| Firebase project | ⚠️ Configure | Auth providers, Authorized domains, Trigger Email extension |
| Cloudflare R2 bucket | ⚠️ Configure | Create bucket, set CORS for PUT from app domain |
| Cloudflare Images | ⚠️ Configure | Create variants: `thumbnail` (400px), `gallery` (1200px), `download` (2048px), `public` (800px) |
| Firestore indexes | ⚠️ Needed | `photos` collectionGroup: `(category ASC, uploadedAt DESC)`. Add via Firebase Console or `firestore.indexes.json` |
| Firestore Security Rules | ❌ Missing | Must be written before production |
| Firebase Trigger Email extension | ⚠️ Install | Install in Firebase Console, configure with SMTP provider (e.g., Resend, SendGrid) |
| Custom domain + HTTPS | ⚠️ Configure | Vercel custom domain, Firebase Auth Authorized Domains list |
