# CLAUDE.md — `app/api/`

> Scoped guidance for HTTP route handlers. Read the repo-root `CLAUDE.md` and `DECISION.md` (ADR-006, ADR-015) first.

---

## Route inventory

| Path | Method | Purpose | Auth model |
|---|---|---|---|
| `/api/auth/session` | POST | Exchange Firebase ID token for 14-day session cookie; sets `role:"ADMIN"` claim on first admin login (two-step `needsRefresh` dance) | Verifies `idToken` via `adminAuth.verifyIdToken` |
| `/api/auth/signout` | POST | Clears the `__session` cookie | None (idempotent) |
| `/api/cron/run-tasks` | GET | Drains `scheduledTasks` where `status == "PENDING"` and `runAt <= now` | `Bearer ${CRON_SECRET}` header |
| `/api/events-list` | GET | Returns `{id, title}` for every event (dropdown source) | `requireAdmin()` |
| `/api/invite` | POST | Upsert Firebase Auth user + `users` doc + `eventAccess/{uid}_{eventId}` + send Firebase magic link | `getSessionUser()` then `session.role === "ADMIN"` |
| `/api/upload` | POST | Step 1 of single-PUT pipeline: presign one R2 PUT URL | `getSessionUser()` admin check |
| `/api/upload/confirm` | POST | Step 2: ingest R2 object into Cloudflare Images, write `events/{id}/photos/{id}` doc | `getSessionUser()` admin check |
| `/api/upload/multipart/init` | POST | Multipart Step 1: `createMultipartUpload` + `generatePresignedPartUrls` (≤10 000 parts) | `getSessionUser()` admin check |
| `/api/upload/multipart/complete` | POST | Multipart Step 2: `completeMultipartUpload`, write photo doc with `storageKey` (R2-only — no CF Images ingestion) | `getSessionUser()` admin check |
| `/api/webhooks/stripe` | POST | Verify Stripe signature, mark invoice `PAID`, advance project status, call `handleProjectTransition` | `stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)` |

---

## When to add an API route vs a Server Action

**Default: Server Action** (`actions.ts` co-located with the page). See `DECISION.md` ADR-006. API routes only for the exceptions already represented above: session cookie exchange called from `AuthProvider.tsx` before any page is known (`/api/auth/session`, `/api/auth/signout`); multi-step upload pipelines with different callers (`/api/upload/*`); the multi-step invite flow (Auth upsert + Firestore write + email, `/api/invite`); lightweight GETs feeding client dropdowns (`/api/events-list`); inbound webhooks signed by an external service (`/api/webhooks/stripe`); the Vercel-invoked cron worker (`/api/cron/run-tasks`).

Anything else — kanban status drag, project edits, contract send, manual invoice send, photo delete — belongs in an `actions.ts` Server Action.

---

## Auth is per-route

`middleware.ts` does **not** run inside `/api/*` (its `config.matcher` excludes `api`). On protected pages it only checks cookie *presence* at the Edge — the Admin SDK does not run on Edge. Every protected handler must guard itself on the first line:

```ts
import { requireAdmin, getSessionUser } from "@/lib/session";

export async function POST(req: NextRequest) {
  await requireAdmin();                          // redirects on failure
  // or, for JSON 401 instead of redirect:
  const session = await getSessionUser();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
```

Webhook and cron routes use their own signature / bearer-token checks (below) and must not call `requireAdmin()` — they have no user session.

---

## Upload pipeline (two paths)

Two pipelines exist because Vercel route handlers cap request bodies at **4.5 MB**. Image bytes never transit the API — only metadata does.

**Single-PUT** — `image/jpeg | image/png | image/webp | image/heic`, Zod-validated in `/api/upload`:

```
Browser → POST /api/upload          { eventId, fileName, contentType }
        ← { presignedUrl, key }     // key = events/{eventId}/{uuid}.{ext}
Browser → PUT  {presignedUrl}       (file body, direct to R2)
Browser → POST /api/upload/confirm  { key, eventId, label?, category? }
        Server: uploadToCloudflareImages(r2ObjectUrl) → writes events/{id}/photos/{id}
```

**Multipart** — any `contentType`; for RAW exports and multi-GB deliverables a single PUT cannot reliably handle:

```
Browser → POST /api/upload/multipart/init      { eventId, fileName, contentType, parts }
        ← { uploadId, key, partUrls[] }
Browser → PUT each part to its presigned URL (parallel; capture ETag)
Browser → POST /api/upload/multipart/complete  { eventId, key, uploadId, parts:[{PartNumber,ETag}] }
        Server: completeMultipartUpload() → writes photo doc { storageKey, isRaw:true }
```

The multipart `complete` route does **not** ingest into Cloudflare Images — RAW formats (`.cr2`, `.nef`) are not uniformly CF-supported, so the photo doc carries `storageKey` instead of `cloudflareImageId`. On failure after `completeMultipartUpload`, the route calls `abortMultipartUpload` to clean up. Client orchestrator: `lib/upload.ts`.

---

## Stripe webhook

`/api/webhooks/stripe` is the **only non-admin writer of project status**; the other writer is `updateProjectStatus` in `app/admin/projects/actions.ts`. Do not introduce a third.

Signature verification is mandatory: missing `stripe-signature` header or missing `STRIPE_WEBHOOK_SECRET` → `400 Missing signature or secret`; failed `stripe.webhooks.constructEvent(...)` → `400 Invalid signature`. Both checks must remain. Handled events drive transitions via `processInvoicePayment` → `handleProjectTransition`:

| Stripe event | Invoice type | Project status before → after |
|---|---|---|
| `checkout.session.completed` / `payment_intent.succeeded` | `DEPOSIT` | `DEPOSIT_PENDING` → `BOOKED` (sets `depositPaidAt`) |
| `checkout.session.completed` / `payment_intent.succeeded` | `BALANCE` | `IN_EDITING` → `GALLERY_DELIVERED` (sets `balancePaidAt`) |

Invoice correlation: `session.metadata.invoiceId` (preferred), `session.client_reference_id`, or `paymentIntent.metadata.invoiceId`. Idempotent — already-`PAID` invoices return early. Downstream side effects (event auto-create, gallery access, referral task) live in `lib/project-transitions.ts` — never duplicate them in the webhook.

---

## Cron worker

`/api/cron/run-tasks` is invoked by Vercel Cron. Schedule from `vercel.json`: `{ "path": "/api/cron/run-tasks", "schedule": "0 2 * * *" }` — daily at 02:00 UTC. Auth: `Authorization: Bearer ${CRON_SECRET}`. If `CRON_SECRET` is **unset**, the route runs unauthenticated — acceptable locally, **required in production**. The route queries `scheduledTasks` where `status == "PENDING"` and `runAt <= now`, then dispatches by `type`:

- `SEND_REFERRAL` — composes the $150 referral email (`mail/` queue → Trigger Email extension) using `client.referralCode` and `NEXT_PUBLIC_APP_URL`.
- `AUTO_FOLLOW_UP` — currently stubbed (proposal-stuck-too-long sequence; see ADR-015).

Each processed task is marked `{ status: "COMPLETED", completedAt }`.

---

## Body size

Vercel route handlers cap request bodies at **4.5 MB**. Never POST image bytes, ZIPs, or video. Anything large must flow through an R2 presigned URL (single-PUT for normal files, multipart for very large ones). The only acceptable bodies for these routes are JSON metadata, ID tokens, and the raw text body of a Stripe webhook (which is well under the limit).
