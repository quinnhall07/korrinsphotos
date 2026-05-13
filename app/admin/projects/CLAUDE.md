# CLAUDE.md — /admin/projects

> **Master state machine.** This is the canonical pipeline. `/admin/bookings` is legacy. New CRM behaviour belongs here.

Canonical schema reference: `docs/architecture/unified-client-lifecycle.md`.
Root conventions: see root CLAUDE.md > "Critical Architecture Rules".

---

## Data Model

`lib/db/projects.ts` defines the lifecycle:

```ts
ProjectStatus =
  SITE_VISIT | INQUIRY | QUALIFYING | PROPOSAL_SENT | NEGOTIATING |
  CONTRACT_SENT | DEPOSIT_PENDING | BOOKED | SHOOT_READY | IN_EDITING |
  GALLERY_DELIVERED | REFERRAL_SENT | COMPLETED | LOST | ARCHIVED
```

Helpers exported: `projectsCol()`, `projectMessagesCol(projectId)`, `getProject`, `createProject`, `updateProject`, `listProjects`, `getProjectsByClientId`, `addProjectMessage`. `MessageDoc` is the shape for the `projects/{id}/messages` subcollection.

A Project always points at exactly one `clients/{clientId}` doc (universal record, keyed by email). `page.tsx` hydrates the join in-memory by pre-fetching all clients into a record map — fine at current scale, swap to per-row fetches if the clients collection grows large.

## Status Transitions — One Writer Rule

`updateProjectStatus(projectId, newStatus)` in `actions.ts` is the **only** path a human-initiated status change should take. It:

1. Reads the existing project, captures `oldStatus`.
2. No-ops if equal.
3. Writes the new status + `updatedAt`.
4. Calls `handleProjectTransition(projectId, oldStatus, newStatus)` from `lib/project-transitions.ts`.
5. Logs `STATUS_CHANGED` activity.
6. Revalidates `/admin/projects` AND `/admin/projects/[id]`.

`handleProjectTransition` is where lifecycle side effects live:

| toStatus | Side effects (in `lib/project-transitions.ts`) |
|---|---|
| `PROPOSAL_SENT` | `onProposalSent` — creates DRAFT deposit invoice (50% of `packagePriceUsd`, due in 7 days) |
| `BOOKED` | `onProjectBooked` — auto-creates `events/{id}`, grants `eventAccess`, increments `clients/{id}.totalSessionsBooked`, queues questionnaire email, creates DRAFT balance invoice |
| `GALLERY_DELIVERED` | `onGalleryDelivered` — schedules `SEND_REFERRAL` task in `scheduledTasks` for +7 days |

**Never duplicate these side effects.** The Stripe webhook at `app/api/webhooks/stripe/route.ts` is the *only* other writer of project status — it advances `DEPOSIT_PENDING → BOOKED` and `IN_EDITING → GALLERY_DELIVERED` on paid invoices, and it goes through `handleProjectTransition` too. Adding a third writer (or skipping the transition hook) will leak invoices / events / referral tasks.

## Sibling Action Files

```
actions.ts           updateProjectStatus, updateProjectDetails
contract-actions.ts  createDraftContract, sendContract  (writes to contracts/, triggers mail/)
invoice-actions.ts   sendInvoice  (creates Stripe Payment Link, marks invoice SENT, triggers mail/)
```

`createDraftContract` delegates to `generateContractForProject` in `lib/contract-renderer.ts`. `sendInvoice` requires `STRIPE_SECRET_KEY`; `createPaymentLinkForInvoice` lives in `lib/stripe.ts`.

## Project Detail Page

`[id]/page.tsx` is currently a thin scaffold — header, client sidebar, single "Overview" panel. Tabs (Messages, Contract, Invoice, Gallery, Timeline) are stubbed but not yet implemented; the "Advance Status" / "Send Email" header buttons are not wired. Extending this page is expected work — keep the `await requireAdmin()` call as the first line of the Server Component and pass serialised props to any new client tabs.

## Gotchas

- `updateProjectDetails` only revalidates `/admin/projects/${projectId}`, not the list. If you add fields that surface in the pipeline view (e.g. `estimatedValue`), add `revalidatePath("/admin/projects")` too.
- `[id]/page.tsx` reads `params.id` synchronously — Next.js 15 expects `await params`. Fix when you next touch the file.
- Messages are a **subcollection** (`projects/{id}/messages`), not an array field. Use `addProjectMessage` from `lib/db/projects.ts`.
