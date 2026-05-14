# CLAUDE.md — /admin/vendors

> Vendor CRM. Korrin's personal network of venues, planners, florists, HMUAs,
> videographers, etc. — separate from the client/project pipeline, but used to
> source reciprocal referrals.

Root conventions (auth guard, server/client boundary, env): see root CLAUDE.md.
Admin shell conventions: see `app/admin/CLAUDE.md`.

---

## Data Model

The canonical schema lives in `lib/db/vendors.ts` (`VendorDoc`, `VendorCategory`).
This collection is independent of `clients` and `projects` — vendors are vendors,
not customers. Categories are a closed union: `VENUE | PLANNER | FLORIST | HMUA |
VIDEOGRAPHER | DJ | OFFICIANT | RENTALS | CATERER | BAKER | STATIONERY | OTHER`.
Helpers exported: `vendorsCol`, `getVendor`, `listVendors`, `listVendorsByCategory`,
`createVendor`, `updateVendor`, `deleteVendor`. All optional fields (including
`phone`, `email`, `latitude`, `longitude`) stay optional — never reject on
missing contact info.

## Routes

- `page.tsx` — Server Component, lists every vendor via `listVendors()` and
  hydrates to `VendorsClientPage`. Filtering, search, sort, and the "New vendor"
  modal all live client-side.
- `[id]/page.tsx` — Server Component, hydrates a single `VendorDoc` and renders
  `VendorDetailClient` (inline edit form, preferred toggle, reciprocity actions,
  delete-with-confirm).

Both pages call `await requireAdmin()` as their first line. The shell guard in
`app/admin/layout.tsx` does not propagate into Server Actions, so the same call
is repeated at the top of every action in `actions.ts`.

## Server Actions (`actions.ts`)

| Action | Purpose |
|---|---|
| `createVendor(input)` | Validate name + category, write `vendors/{id}` with `referralsSent: 0`, `referralsReceived: 0`. |
| `updateVendor(id, patch)` | Merge partial patch; empty strings become `FieldValue.delete()` so we don't store empty fields. |
| `deleteVendor(id)` | Permanent delete; logs an activity entry. |
| `incrementReferralSent(id)` | Atomic `FieldValue.increment(1)` on `referralsSent`; also bumps `lastWorkedWith`. |
| `incrementReferralReceived(id)` | Atomic `FieldValue.increment(1)` on `referralsReceived`; also bumps `lastWorkedWith`. |

All actions return `{ success: boolean; error?: string }`. Reciprocity counters
are the **only** mutation path for `referralsSent` / `referralsReceived` — do not
write those fields from a generic `updateVendor` call, or two writers will fight
and the increment guarantee dies.

## Reciprocity Convention

`referralsSent` counts referrals Korrin sent **to** the vendor; `referralsReceived`
counts referrals the vendor sent **back to** Korrin. The detail page's "+ Sent
referral" / "+ Received referral" buttons are the user-facing trigger. Whenever
either counter ticks, `lastWorkedWith` updates so the "Last worked" sort on the
list page stays meaningful.

## Map Preview — Placeholder

The detail page shows a coordinate-only placeholder (`lat.toFixed(5), lng.toFixed(5)`)
rather than a real map embed. A Maps integration (likely Mapbox or Google Static
Maps) is on the Phase 3.5 / 3.8 roadmap — see `business-dashboard-roadmap.md`.
When wiring it, do not push the API key to the client; render the static tile
on the server and pass the image URL through props.

## Out of Scope (Deferred)

- Image uploads (logo / hero shot per vendor) — Phase 3.8+.
- A real map embed.
- Linking vendors to specific `projects/{id}` (the wedding-vendor-team feature
  also lives in Phase 3.8+; design that as a join collection, not an array field).
