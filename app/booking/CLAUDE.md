# CLAUDE.md — `app/booking`

Public booking inquiry funnel. Three files: `page.tsx` renders the two-column
hero + form, `BookingForm.tsx` is the Client Component, `actions.ts` exports
the `submitBooking` Server Action. No API route is involved.

---

## `submitBooking` — Unified Write Sequence

`actions.ts` → `submitBooking(formData)` runs sequentially. Order matters.

| Step | Target | Purpose |
|---|---|---|
| 1 | `clients/{clientId}` | Find by email or create new; stamps first-touch attribution |
| 2 | `projects/{projectId}` | New `INQUIRY` project with `clientId`, `leadScore`, `tags` |
| 3 | `projects/{projectId}/messages/{id}` | First INBOUND message containing the inquiry body |
| 4 | `inboxItems` | `createInboxItem(...)` (best-effort) so `/admin/inbox` surfaces the new lead |
| 5 | `activityFeed` | `logActivity("LEAD_RECEIVED", …)` (best-effort) |
| 6 | `mail/` via `enqueueTrackedMail` | Tracked auto-responder (open/click counters land on the project) |

The legacy `bookingInquiries` write was retired May 2026 — do not reintroduce it.

---

## `__origin` Cookie → First-Touch Attribution

`middleware.ts` writes a JS-readable `__origin` JSON cookie on first visit and
only if absent — first touch is locked for 30 days. `submitBooking` reads it
server-side via `await cookies()` (Next 15 async) and stamps the new client:

| Cookie field | Client doc field |
|---|---|
| `source` (fallback `"WEBSITE"`) | `firstTouchSource` |
| `medium` | `firstTouchMedium` |
| `campaign` | `firstTouchCampaign` |
| `landingUrl` | `firstTouchLandingUrl` |
| `ts` → `Date` or server timestamp | `firstTouchAt` |

The project also gets `leadSource: origin.source ?? "WEBSITE"`. See
`DECISION.md` ADR-016 and the root CLAUDE.md "Middleware Responsibilities".
Do not overwrite these fields when reusing an existing client — first touch
is immutable.

---

## Lead Scoring + Auto-Tagging

`calculateLeadScore()` from `@/lib/lead-scoring` runs **at write time**, after
tags are computed and before step 2, so the project doc persists the score.
See `DECISION.md` ADR-008. The function uses the structural `LeadScoreInput`
shape — pass a compatible subset (`sessionType`, `message`, `preferredDate`,
`tags`).

Auto-tags applied inline:

| Tag | Trigger |
|---|---|
| `<sessionType>` | Always |
| `Rush` | `preferredDate` within 30 days |
| `High Budget` | `Wedding` or `Commercial` |
| `Destination` | Message matches `destinationKeywords[]` |
| `Needs Follow-Up` | No `preferredDate` |

Touch any scoring input → recompute (root CLAUDE.md gotcha #9) and mirror to
any admin write paths that edit the same fields.

---

## Validation

`BookingSchema` (Zod) is the single source of truth. The `sessionType` enum
is fixed: `Wedding | Portrait | Editorial | Family | Engagement | Commercial`.
Extending it requires synchronized changes in `lib/lead-scoring.ts`, the rate
table in `buildAutoResponderHtml`, and the `<select>` in `BookingForm.tsx`.
