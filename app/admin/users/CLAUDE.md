# CLAUDE.md — /admin/users

User management for the `users/` collection — Firebase Auth identity joined with the role + access flags Firestore tracks per UID.

Root conventions: see root CLAUDE.md.

---

## `users/{uid}` vs `clients/{clientId}` — Don't Conflate

| Collection | Keyed by | Purpose | Written by |
|---|---|---|---|
| `users/{uid}` | Firebase Auth UID | Auth join doc. `role` field drives `requireAdmin`. Exists once the user signs in. | `lib/session.ts` on session-cookie creation; `lib/db/users.ts > upsertUser` |
| `clients/{clientId}` | Auto-id keyed off email lookup | Universal client record — name, phone, referral, attribution, session count. Independent of whether the person has ever logged in. | `app/booking/actions.ts > submitBooking`; `lib/project-transitions.ts` |

A Korrin client may have a `clients/{...}` doc with NO `users/{uid}` doc (they booked but never logged in). The reverse is also possible (admin account with no client record). This page lists `users/` only — not clients.

`requireAdmin()` reads either the JWT `role` claim or, as fallback, `users/{uid}.role`. Demoting a user to `CLIENT` here will eventually lock them out of `/admin` (next session refresh).

## Files

| File | Role |
|---|---|
| `page.tsx` | Server Component. Lists all `users/` docs, joins per-row with `eventAccess` count via `.count().get()`. Sorts in memory by `createdAt` ascending. |
| `actions.ts` | `removeUser(uid)` |
| `RemoveUserButton.tsx` | Client component, calls `removeUser` |

`page.tsx` fetches without `orderBy("createdAt")` deliberately — Firestore omits docs missing the orderBy field, which would silently hide users whose `createdAt` was never set. Sort happens in memory after the read.

## `removeUser` Cascade

`actions.ts > removeUser(uid)` performs:

1. Query `eventAccess` where `userId == uid`.
2. Single batch: delete every matching `eventAccess` doc + delete `users/{uid}`.
3. `adminAuth.updateUser(uid, { disabled: true })` (try/catch — invited users may not yet have a Firebase Auth record).
4. `revalidatePath("/admin/users")`.

The Auth account is **disabled, not deleted** — softer rollback path and preserves UID for audit. Adjust if you actually want hard-delete (`adminAuth.deleteUser`).

The UI in `page.tsx` blocks removing the current session user (`user.uid !== session.uid`) and blocks removing any other ADMIN (`user.role !== "ADMIN"`). Preserve both checks if you refactor the row rendering.

## DB Helpers

`lib/db/users.ts`:

- `usersCol()` — `CollectionReference`
- `getUser(uid)` → `UserDoc | null`
- `upsertUser(uid, data)` — transactional set-with-merge that stamps `createdAt` on first write
- `listUsers()` — orderBy createdAt desc (won't pick up legacy docs missing the field; the page deliberately uses raw `adminDb.collection("users").get()` for this reason)

`lib/db/event-access.ts` exposes `grantEventAccess`, `revokeEventAccess`, `userHasEventAccess`, `listEventAccess`, `listUserEvents`, `countEventAccess`. Doc IDs are deterministic: `${eventId}_${userId}`. Use these helpers instead of writing raw `adminDb.collection("eventAccess")` calls.

## Gotchas

- The role badge styles (`ROLE_STYLES`) hard-code `ADMIN` and `CLIENT`. Any new role in `lib/db/users.ts > Role` needs a style here or it renders unstyled.
- Removing a user does NOT touch `clients/` — the universal client record persists by design.
