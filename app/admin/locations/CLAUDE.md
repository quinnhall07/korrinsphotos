# CLAUDE.md — /admin/locations

Scouting database — one row per real-world place Korrin has scouted, considered, or shot at. Independent of the Project/Event lifecycle; an event may eventually reference a `locations/{id}`, but the inverse (location → events) is a soft, append-only history (`sampleEventIds`).

Admin-only — the parent `app/admin/layout.tsx` calls `requireAdmin()`. Every Server Action in this folder repeats that call (layout guards do not propagate into Server Actions).

## Schema

Lives in `lib/db/locations.ts` as `LocationDoc`. Key fields:

- `name`, `type` (`LocationType` union: `OUTDOOR_PARK | OUTDOOR_BEACH | OUTDOOR_FIELD | OUTDOOR_URBAN | INDOOR_STUDIO | INDOOR_VENUE | INDOOR_HOME | OTHER`)
- `address`, `city`, `state`, `latitude`, `longitude` — all optional; lat/lng are entered manually for now (no Maps API integration yet)
- `bestLightWindow: { startHour, endHour, notes? }` — hand-curated for now. Will be auto-augmented later by `lib/golden-hour.ts > computeSunTimes(date, lat, lon)` once a server helper consumes both pieces. Do NOT import `lib/golden-hour.ts` from this folder — that wiring belongs to a later phase
- `permitRequired`, `permitCost`, `permitContact` — surfaced as a permit chip on cards and a structured block on the detail page
- `accessibilityNotes`, `capacityMax`, `weatherDependent`
- `sampleEventIds: string[]`, `visitCount`, `lastVisited` — populated by the `recordVisit` helper
- `rating: 1|2|3|4|5`, `notes`, `tags: string[]`

`LOCATION_TYPE_LABELS` is re-exported alongside the union so the UI never hard-codes display strings.

## Server Actions (`actions.ts`)

All four call `requireAdmin()` first, log to `activityFeed` best-effort, and `revalidatePath` `/admin/locations` (+ the detail path on writes that target a single row, + `/admin` on create/delete so the dashboard refreshes):

- `createLocation(input)` — required `name`; coerces empty strings to undefined so Firestore doesn't reject them
- `updateLocation(id, patch)` — strips `undefined` from the patch before write
- `deleteLocation(id)` — does NOT cascade. Linked events are untouched (the relationship lives only on the location side via `sampleEventIds`)
- `recordLocationVisit(locationId, eventId)` — thin wrapper around the DB-layer `recordVisit`. Wired for the future event-create / project-transition flow; not yet called from anywhere in the app

## `recordVisit` convention (DB helper)

`lib/db/locations.ts > recordVisit(id, eventId)` appends to `sampleEventIds` via `FieldValue.arrayUnion`, increments `visitCount`, and stamps `lastVisited`. Idempotent on `eventId` — a duplicate call only bumps `lastVisited`. Call site **plan** (do not implement here): when an event transitions to `SHOOT_READY` or when an admin manually links an event to a location.

## Pages

- `page.tsx` — Server Component. Calls `requireAdmin()`, fetches via `listLocations()`, serialises Timestamps to ISO strings, delegates to `LocationsClientPage`.
- `LocationsClientPage.tsx` (`"use client"`) — search by name/city/address, filter by type, sort by `lastVisited | name | rating`, card grid (auto-fill 280px min). Modal-driven creation.
- `[id]/page.tsx` — Server Component. Loads the location and best-effort hydrates `sampleEventIds` into `{ id, title }` rows for the detail UI.
- `[id]/LocationDetailClient.tsx` (`"use client"`) — Two-column read view + inline edit toggle. Lat/lng render as `34.7333° N, -78.5333° W`. Light window renders as `Best light: 5:00 PM – 7:30 PM`. Delete button confirms before calling `deleteLocation`.

## Out of scope (do not add in this PR)

- Maps API / address geocoding — lat/lng are typed by hand for now.
- Photo galleries on locations.
- Weather integration. `lib/weather.ts` exists for project-level snapshots, not location browsing.
- AdminSidebar nav entry — wired by the orchestrator after all parallel agents finish.
