// app/admin/health/page.tsx
// Wave 11 — operational health dashboard.
//
// Read-only single-pane status view that surfaces the cron worker, Stripe
// webhook health, mail queue, env-var presence, inbox triage backlog, R2
// storage configuration, and runtime/version info.
//
// Defensive by design: each card's data fetch is wrapped in try/catch so
// missing collections, missing composite indexes, or admin-side schema
// drift never crash the page. Renders "—" / "n/a" instead.

import type { Metadata } from "next";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/session";
import { listInboxItems } from "@/lib/db/inbox";
import { formatDateTime, toDate } from "@/lib/date";
import packageJson from "../../../package.json";
import nextPackageJson from "next/package.json";

export const metadata: Metadata = { title: "Health | Admin" };
export const dynamic = "force-dynamic";

// ─── Types ─────────────────────────────────────────────────────────────────

type CronTaskType =
  | "SEND_REFERRAL"
  | "AUTO_FOLLOW_UP"
  | "SNEAK_PEEK"
  | "SHOOT_BRIEF";

interface CronCardData {
  lastRunAt: Date | null;
  lastRunSource: "cronRuns" | "scheduledTasks" | null;
  pendingByType: Record<CronTaskType, number>;
  pendingTotal: number;
  error: string | null;
}

interface StripeWebhookCardData {
  lastReceivedAt: Date | null;
  totalLast7d: number;
  byType: Array<{ type: string; count: number }>;
  recentFailures: Array<{ id: string; type: string; at: Date | null }>;
  error: string | null;
}

interface MailRow {
  id: string;
  to: string | null;
  subject: string | null;
  createdAt: Date | null;
  deliveryState: string | null;
}
interface MailCardData {
  recent: MailRow[];
  oldestUnsent: MailRow | null;
  totalLast24h: number;
  error: string | null;
}

interface EnvVarStatus {
  name: string;
  present: boolean;
  optional?: boolean;
}

interface InboxCardData {
  total: number;
  byType: Array<{ type: string; count: number }>;
  error: string | null;
}

interface StorageCardData {
  bucket: string | null;
  endpoint: string | null;
  smokeCount: number | null;
  smokeKind: "collectionGroup" | "single-event" | "none";
  error: string | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const HOUR_MS = 60 * 60 * 1000;

function relativeFromNow(d: Date | null): string {
  if (!d) return "—";
  const diff = Date.now() - d.getTime();
  if (diff < 0) {
    const future = Math.abs(diff);
    if (future < HOUR_MS) return `in ${Math.round(future / 60000)}m`;
    if (future < 24 * HOUR_MS) return `in ${Math.round(future / HOUR_MS)}h`;
    return `in ${Math.round(future / (24 * HOUR_MS))}d`;
  }
  if (diff < HOUR_MS) return `${Math.round(diff / 60000)}m ago`;
  if (diff < 24 * HOUR_MS) return `${Math.round(diff / HOUR_MS)}h ago`;
  return `${Math.round(diff / (24 * HOUR_MS))}d ago`;
}

function cronStatus(d: Date | null): {
  label: "GREEN" | "YELLOW" | "RED" | "UNKNOWN";
  color: string;
} {
  if (!d) return { label: "UNKNOWN", color: "var(--charcoal-muted)" };
  const ageH = (Date.now() - d.getTime()) / HOUR_MS;
  if (ageH <= 36) return { label: "GREEN", color: "#3F7D33" };
  if (ageH <= 72) return { label: "YELLOW", color: "#B45309" };
  return { label: "RED", color: "#9B2C2C" };
}

// ─── Card 1 — Cron worker ──────────────────────────────────────────────────

async function loadCronCard(): Promise<CronCardData> {
  const pendingByType: Record<CronTaskType, number> = {
    SEND_REFERRAL: 0,
    AUTO_FOLLOW_UP: 0,
    SNEAK_PEEK: 0,
    SHOOT_BRIEF: 0,
  };
  let pendingTotal = 0;
  let lastRunAt: Date | null = null;
  let lastRunSource: CronCardData["lastRunSource"] = null;

  try {
    // Prefer cronRuns/{id} if it exists.
    let usedCronRuns = false;
    try {
      const runsSnap = await adminDb
        .collection("cronRuns")
        .orderBy("ranAt", "desc")
        .limit(1)
        .get();
      if (!runsSnap.empty) {
        const data = runsSnap.docs[0].data();
        const ts = data.ranAt ?? data.completedAt ?? data.createdAt ?? null;
        lastRunAt = toDate(ts);
        lastRunSource = "cronRuns";
        usedCronRuns = true;
      }
    } catch {
      // collection may not exist or may have a different orderBy field.
    }

    if (!usedCronRuns) {
      // Fall back to scheduledTasks last COMPLETED row as a proxy.
      try {
        const completedSnap = await adminDb
          .collection("scheduledTasks")
          .where("status", "==", "COMPLETED")
          .orderBy("completedAt", "desc")
          .limit(1)
          .get();
        if (!completedSnap.empty) {
          const data = completedSnap.docs[0].data();
          lastRunAt = toDate(data.completedAt ?? null);
          lastRunSource = "scheduledTasks";
        }
      } catch {
        // composite index missing — leave lastRunAt null.
      }
    }

    // Pending counts per type. Catch per-type so a missing index on one
    // type doesn't poison the others.
    const types: CronTaskType[] = [
      "SEND_REFERRAL",
      "AUTO_FOLLOW_UP",
      "SNEAK_PEEK",
      "SHOOT_BRIEF",
    ];
    await Promise.all(
      types.map(async (t) => {
        try {
          const snap = await adminDb
            .collection("scheduledTasks")
            .where("status", "==", "PENDING")
            .where("type", "==", t)
            .count()
            .get();
          const c = snap.data().count ?? 0;
          pendingByType[t] = c;
          pendingTotal += c;
        } catch {
          // leave at 0
        }
      })
    );

    return {
      lastRunAt,
      lastRunSource,
      pendingByType,
      pendingTotal,
      error: null,
    };
  } catch (err) {
    return {
      lastRunAt,
      lastRunSource,
      pendingByType,
      pendingTotal,
      error: err instanceof Error ? err.message : "Cron card failed",
    };
  }
}

// ─── Card 2 — Stripe webhook health ────────────────────────────────────────

async function loadStripeWebhookCard(): Promise<StripeWebhookCardData> {
  try {
    let lastReceivedAt: Date | null = null;
    let totalLast7d = 0;
    const typeCounts = new Map<string, number>();
    const recentFailures: StripeWebhookCardData["recentFailures"] = [];

    // Most recent 10 — used for "last received" + most recent type sample.
    let recent10: Array<{
      id: string;
      type: string;
      at: Date | null;
      status: string | null;
    }> = [];
    try {
      const snap = await adminDb
        .collection("stripeWebhookEvents")
        .orderBy("processedAt", "desc")
        .limit(10)
        .get();
      recent10 = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          type: typeof data.type === "string" ? data.type : "unknown",
          at: toDate(data.processedAt ?? null),
          status:
            typeof data.status === "string" ? data.status : null,
        };
      });
    } catch {
      // collection or index may not exist yet — treat as empty.
    }

    if (recent10.length > 0) {
      lastReceivedAt = recent10[0].at;
      for (const e of recent10) {
        if (e.status && e.status.toLowerCase().includes("fail")) {
          recentFailures.push({ id: e.id, type: e.type, at: e.at });
        }
      }
    }

    // 7-day distinct-type breakdown. Use date filter; fall back to client filter.
    try {
      const cutoff = new Date(Date.now() - 7 * 24 * HOUR_MS);
      let docs: Array<{ data: () => Record<string, unknown> }> = [];
      try {
        const snap = await adminDb
          .collection("stripeWebhookEvents")
          .where("processedAt", ">=", cutoff)
          .limit(500)
          .get();
        docs = snap.docs;
      } catch {
        // index missing — fall back to recent 200 unfiltered.
        const snap = await adminDb
          .collection("stripeWebhookEvents")
          .orderBy("processedAt", "desc")
          .limit(200)
          .get();
        docs = snap.docs;
      }
      for (const d of docs) {
        const data = d.data();
        const at = toDate(
          (data as { processedAt?: unknown }).processedAt ?? null
        );
        if (at && at.getTime() < cutoff.getTime()) continue;
        const type =
          typeof (data as { type?: unknown }).type === "string"
            ? ((data as { type: string }).type)
            : "unknown";
        typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
        totalLast7d++;
      }
    } catch {
      // leave totals at 0
    }

    const byType = Array.from(typeCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    return {
      lastReceivedAt,
      totalLast7d,
      byType,
      recentFailures,
      error: null,
    };
  } catch (err) {
    return {
      lastReceivedAt: null,
      totalLast7d: 0,
      byType: [],
      recentFailures: [],
      error: err instanceof Error ? err.message : "Stripe webhook card failed",
    };
  }
}

// ─── Card 3 — Mail queue ───────────────────────────────────────────────────

async function loadMailCard(): Promise<MailCardData> {
  try {
    const recent: MailRow[] = [];
    let oldestUnsent: MailRow | null = null;
    let totalLast24h = 0;

    try {
      const snap = await adminDb
        .collection("mail")
        .orderBy("createdAt", "desc")
        .limit(5)
        .get();
      for (const d of snap.docs) {
        const data = d.data() as Record<string, unknown>;
        const message =
          (data.message as { subject?: unknown } | undefined) ?? undefined;
        const subject =
          message && typeof message.subject === "string"
            ? message.subject
            : null;
        const to =
          typeof data.to === "string"
            ? data.to
            : Array.isArray(data.to) && typeof data.to[0] === "string"
              ? (data.to[0] as string)
              : null;
        const delivery =
          (data.delivery as { state?: unknown } | undefined) ?? undefined;
        const deliveryState =
          delivery && typeof delivery.state === "string"
            ? delivery.state
            : null;
        const row: MailRow = {
          id: d.id,
          to,
          subject,
          createdAt: toDate(data.createdAt ?? null),
          deliveryState,
        };
        recent.push(row);
        if (
          row.deliveryState !== "SUCCESS" &&
          (!oldestUnsent ||
            (row.createdAt &&
              oldestUnsent.createdAt &&
              row.createdAt.getTime() < oldestUnsent.createdAt.getTime()))
        ) {
          oldestUnsent = row;
        }
      }
    } catch {
      // collection may not exist
    }

    // 24h count — best effort with composite-index fallback.
    try {
      const cutoff = new Date(Date.now() - 24 * HOUR_MS);
      try {
        const snap = await adminDb
          .collection("mail")
          .where("createdAt", ">=", cutoff)
          .count()
          .get();
        totalLast24h = snap.data().count ?? 0;
      } catch {
        const snap = await adminDb
          .collection("mail")
          .orderBy("createdAt", "desc")
          .limit(200)
          .get();
        totalLast24h = snap.docs.filter((d) => {
          const at = toDate((d.data() as { createdAt?: unknown }).createdAt ?? null);
          return at !== null && at.getTime() >= cutoff.getTime();
        }).length;
      }
    } catch {
      totalLast24h = 0;
    }

    return { recent, oldestUnsent, totalLast24h, error: null };
  } catch (err) {
    return {
      recent: [],
      oldestUnsent: null,
      totalLast24h: 0,
      error: err instanceof Error ? err.message : "Mail card failed",
    };
  }
}

// ─── Card 4 — Env var presence ─────────────────────────────────────────────

function loadEnvCard(): EnvVarStatus[] {
  // NOTE: We never read the value — only check non-empty. The card surfaces
  // names + present/absent only.
  const REQUIRED: ReadonlyArray<{ name: string; optional?: boolean }> = [
    { name: "NEXT_PUBLIC_FIREBASE_API_KEY" },
    { name: "FIREBASE_PROJECT_ID" },
    { name: "FIREBASE_PRIVATE_KEY" },
    { name: "ADMIN_EMAILS" },
    { name: "NEXT_PUBLIC_APP_URL" },
    { name: "CLOUDFLARE_R2_ENDPOINT" },
    { name: "CLOUDFLARE_R2_BUCKET_NAME" },
    { name: "CLOUDFLARE_IMAGES_API_TOKEN" },
    { name: "NEXT_PUBLIC_CLOUDFLARE_IMAGES_URL" },
    { name: "STRIPE_SECRET_KEY" },
    { name: "STRIPE_WEBHOOK_SECRET" },
    { name: "CRON_SECRET" },
    { name: "TOMORROW_IO_API_KEY", optional: true },
  ];
  return REQUIRED.map(({ name, optional }) => {
    const raw = process.env[name];
    const present = typeof raw === "string" && raw.trim().length > 0;
    return { name, present, optional };
  });
}

// ─── Card 5 — Inbox triage backlog ─────────────────────────────────────────

async function loadInboxCard(): Promise<InboxCardData> {
  try {
    const items = await listInboxItems({
      includeRead: false,
      includeSnoozed: false,
    });
    const counts = new Map<string, number>();
    for (const i of items) {
      counts.set(i.type, (counts.get(i.type) ?? 0) + 1);
    }
    const byType = Array.from(counts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
    return { total: items.length, byType, error: null };
  } catch (err) {
    return {
      total: 0,
      byType: [],
      error: err instanceof Error ? err.message : "Inbox card failed",
    };
  }
}

// ─── Card 6 — Storage / R2 sanity ──────────────────────────────────────────

async function loadStorageCard(): Promise<StorageCardData> {
  const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME ?? null;
  const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT ?? null;
  let smokeCount: number | null = null;
  let smokeKind: StorageCardData["smokeKind"] = "none";

  // Try the cheap collectionGroup count first; on any error fall through to a
  // single-event smoke check.
  try {
    const snap = await adminDb.collectionGroup("photos").count().get();
    smokeCount = snap.data().count ?? 0;
    smokeKind = "collectionGroup";
    return { bucket, endpoint, smokeCount, smokeKind, error: null };
  } catch {
    // try fallback
  }

  try {
    const eventsSnap = await adminDb.collection("events").limit(1).get();
    if (!eventsSnap.empty) {
      const evId = eventsSnap.docs[0].id;
      const photosSnap = await adminDb
        .collection("events")
        .doc(evId)
        .collection("photos")
        .count()
        .get();
      smokeCount = photosSnap.data().count ?? 0;
      smokeKind = "single-event";
    }
  } catch {
    // leave smokeCount null
  }

  return { bucket, endpoint, smokeCount, smokeKind, error: null };
}

// ─── Card 7 — System version (sync, server-only) ───────────────────────────

interface SystemVersionData {
  nextVersion: string;
  nodeVersion: string;
  commitSha: string | null;
}

function loadSystemVersion(): SystemVersionData {
  // package.json `dependencies.next` is "latest" in this repo, so it's
  // not a useful runtime version. We surface both: the declared
  // dependency string AND the package version installed under the app's
  // own version field is too generic to help, so we read it from the
  // runtime Next module if available.
  let nextVersion = "unknown";
  const installed = (nextPackageJson as { version?: string }).version;
  if (typeof installed === "string" && installed.length > 0) {
    nextVersion = installed;
  } else {
    const declared = (packageJson as { dependencies?: Record<string, string> })
      .dependencies?.next;
    if (declared) nextVersion = declared;
  }
  const nodeVersion = process.versions?.node ?? "unknown";
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA ?? null;
  return { nextVersion, nodeVersion, commitSha };
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default async function HealthPage() {
  await requireAdmin();

  const [cron, stripeWh, mail, inbox, storage] = await Promise.all([
    loadCronCard(),
    loadStripeWebhookCard(),
    loadMailCard(),
    loadInboxCard(),
    loadStorageCard(),
  ]);
  const env = loadEnvCard();
  const sys = loadSystemVersion();

  return (
    <div
      className="page-fade-in"
      style={{ padding: "2rem", maxWidth: 1400, margin: "0 auto" }}
    >
      <div style={{ marginBottom: "1.5rem" }}>
        <p
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--olive)",
            marginBottom: "0.25rem",
          }}
        >
          Reports
        </p>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontWeight: 300,
            fontSize: "2.4rem",
            margin: 0,
            color: "var(--charcoal)",
          }}
        >
          System Health
        </h1>
        <p
          style={{
            fontSize: "0.78rem",
            color: "var(--charcoal-muted)",
            marginTop: "0.5rem",
          }}
        >
          Read-only operational status. Cron, queues, webhooks, mail, env
          vars. Refreshes on every load.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
          gap: "1.25rem",
        }}
      >
        <CronCard data={cron} />
        <StripeWebhookCard data={stripeWh} />
        <MailCard data={mail} />
        <EnvCard rows={env} />
        <InboxBacklogCard data={inbox} />
        <StorageCard data={storage} />
        <SystemVersionCard data={sys} />
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function CardShell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        border: "0.5px solid var(--border)",
        background: "var(--white)",
        padding: "1.25rem 1.4rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      <header>
        <p
          style={{
            fontSize: "0.6rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--charcoal-muted)",
            margin: 0,
          }}
        >
          {eyebrow}
        </p>
        <h2
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontWeight: 400,
            fontSize: "1.4rem",
            margin: "0.15rem 0 0",
            color: "var(--charcoal)",
          }}
        >
          {title}
        </h2>
      </header>
      {children}
    </section>
  );
}

function StatusDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
        marginRight: 6,
        verticalAlign: "middle",
      }}
    />
  );
}

function KeyValueRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "0.3rem 0",
        borderBottom: "0.5px solid var(--border)",
        fontSize: "0.78rem",
      }}
    >
      <span style={{ color: "var(--charcoal-light)" }}>{label}</span>
      <span
        style={{
          color: "var(--charcoal)",
          fontFamily: mono
            ? '"SFMono-Regular", Menlo, Consolas, monospace'
            : "inherit",
          fontSize: mono ? "0.72rem" : undefined,
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function CronCard({ data }: { data: CronCardData }) {
  const { label, color } = cronStatus(data.lastRunAt);
  const sourceNote =
    data.lastRunSource === "scheduledTasks"
      ? " (proxy: scheduledTasks.completedAt)"
      : data.lastRunSource === "cronRuns"
        ? " (cronRuns)"
        : "";
  return (
    <CardShell eyebrow="Card 1" title="Cron worker">
      {data.error && <ErrorLine msg={data.error} />}
      <KeyValueRow
        label="Status"
        value={
          <span style={{ color }}>
            <StatusDot color={color} />
            {label}
          </span>
        }
      />
      <KeyValueRow
        label="Last run"
        value={
          data.lastRunAt
            ? `${relativeFromNow(data.lastRunAt)} · ${formatDateTime(data.lastRunAt) ?? "—"}`
            : "—"
        }
      />
      <KeyValueRow label="Source" value={sourceNote.trim() || "—"} />
      <div style={{ marginTop: "0.5rem" }}>
        <p
          style={{
            fontSize: "0.6rem",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--charcoal-muted)",
            margin: "0 0 0.4rem",
          }}
        >
          Pending tasks ({data.pendingTotal})
        </p>
        {(Object.keys(data.pendingByType) as CronTaskType[]).map((t) => (
          <KeyValueRow
            key={t}
            label={t}
            value={String(data.pendingByType[t])}
            mono
          />
        ))}
      </div>
    </CardShell>
  );
}

function StripeWebhookCard({ data }: { data: StripeWebhookCardData }) {
  return (
    <CardShell eyebrow="Card 2" title="Stripe webhook health">
      {data.error && <ErrorLine msg={data.error} />}
      <KeyValueRow
        label="Last received"
        value={
          data.lastReceivedAt
            ? `${relativeFromNow(data.lastReceivedAt)} · ${formatDateTime(data.lastReceivedAt) ?? "—"}`
            : "—"
        }
      />
      <KeyValueRow
        label="Events (last 7d)"
        value={String(data.totalLast7d)}
      />
      <KeyValueRow
        label="Distinct types (7d)"
        value={String(data.byType.length)}
      />
      <div style={{ marginTop: "0.5rem" }}>
        <p
          style={{
            fontSize: "0.6rem",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--charcoal-muted)",
            margin: "0 0 0.4rem",
          }}
        >
          Top types (7d)
        </p>
        {data.byType.length === 0 ? (
          <p style={{ fontSize: "0.78rem", color: "var(--charcoal-muted)" }}>
            n/a
          </p>
        ) : (
          data.byType
            .slice(0, 6)
            .map((t) => (
              <KeyValueRow
                key={t.type}
                label={t.type}
                value={String(t.count)}
                mono
              />
            ))
        )}
      </div>
      {data.recentFailures.length > 0 && (
        <div style={{ marginTop: "0.5rem" }}>
          <p
            style={{
              fontSize: "0.6rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#9B2C2C",
              margin: "0 0 0.4rem",
            }}
          >
            Recent failures
          </p>
          {data.recentFailures.slice(0, 5).map((f) => (
            <KeyValueRow
              key={f.id}
              label={`${f.type}`}
              value={f.at ? relativeFromNow(f.at) : "—"}
              mono
            />
          ))}
        </div>
      )}
    </CardShell>
  );
}

function MailCard({ data }: { data: MailCardData }) {
  return (
    <CardShell eyebrow="Card 3" title="Mail queue">
      {data.error && <ErrorLine msg={data.error} />}
      <KeyValueRow
        label="Mail docs (24h)"
        value={String(data.totalLast24h)}
      />
      <KeyValueRow
        label="Oldest unsent"
        value={
          data.oldestUnsent
            ? `${relativeFromNow(data.oldestUnsent.createdAt)} · ${data.oldestUnsent.deliveryState ?? "queued"}`
            : "—"
        }
      />
      <div style={{ marginTop: "0.5rem" }}>
        <p
          style={{
            fontSize: "0.6rem",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--charcoal-muted)",
            margin: "0 0 0.4rem",
          }}
        >
          Recent (5)
        </p>
        {data.recent.length === 0 ? (
          <p style={{ fontSize: "0.78rem", color: "var(--charcoal-muted)" }}>
            n/a
          </p>
        ) : (
          data.recent.map((m) => (
            <div
              key={m.id}
              style={{
                padding: "0.4rem 0",
                borderBottom: "0.5px solid var(--border)",
                fontSize: "0.78rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "0.5rem",
                }}
              >
                <span
                  style={{
                    color: "var(--charcoal)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                  }}
                  title={m.subject ?? ""}
                >
                  {m.subject ?? "(no subject)"}
                </span>
                <span
                  style={{
                    color:
                      m.deliveryState === "SUCCESS"
                        ? "#3F7D33"
                        : m.deliveryState === "ERROR"
                          ? "#9B2C2C"
                          : "var(--charcoal-muted)",
                    fontSize: "0.7rem",
                  }}
                >
                  {m.deliveryState ?? "queued"}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  color: "var(--charcoal-muted)",
                  fontSize: "0.7rem",
                  marginTop: "0.15rem",
                }}
              >
                <span>{m.to ?? "—"}</span>
                <span>{relativeFromNow(m.createdAt)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </CardShell>
  );
}

function EnvCard({ rows }: { rows: EnvVarStatus[] }) {
  return (
    <CardShell eyebrow="Card 4" title="Environment variables">
      <p
        style={{
          fontSize: "0.7rem",
          color: "var(--charcoal-muted)",
          margin: 0,
        }}
      >
        Presence ping — values are never read or rendered.
      </p>
      <div style={{ marginTop: "0.5rem" }}>
        {rows.map((r) => (
          <div
            key={r.name}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0.3rem 0",
              borderBottom: "0.5px solid var(--border)",
              fontSize: "0.78rem",
            }}
          >
            <span
              style={{
                color: "var(--charcoal)",
                fontFamily:
                  '"SFMono-Regular", Menlo, Consolas, monospace',
                fontSize: "0.72rem",
              }}
            >
              {r.name}
              {r.optional && (
                <span
                  style={{
                    fontSize: "0.6rem",
                    color: "var(--charcoal-muted)",
                    marginLeft: "0.4rem",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  optional
                </span>
              )}
            </span>
            <span
              aria-label={r.present ? "present" : "missing"}
              style={{
                color: r.present
                  ? "#3F7D33"
                  : r.optional
                    ? "var(--charcoal-muted)"
                    : "#9B2C2C",
                fontSize: "0.85rem",
                fontWeight: 500,
              }}
            >
              {r.present ? "✓" : r.optional ? "—" : "✗"}
            </span>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

function InboxBacklogCard({ data }: { data: InboxCardData }) {
  return (
    <CardShell eyebrow="Card 5" title="Inbox triage backlog">
      {data.error && <ErrorLine msg={data.error} />}
      <KeyValueRow label="Total open" value={String(data.total)} />
      <div style={{ marginTop: "0.5rem" }}>
        <p
          style={{
            fontSize: "0.6rem",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--charcoal-muted)",
            margin: "0 0 0.4rem",
          }}
        >
          By type
        </p>
        {data.byType.length === 0 ? (
          <p style={{ fontSize: "0.78rem", color: "var(--charcoal-muted)" }}>
            n/a
          </p>
        ) : (
          data.byType.map((b) => (
            <KeyValueRow
              key={b.type}
              label={b.type}
              value={String(b.count)}
              mono
            />
          ))
        )}
      </div>
    </CardShell>
  );
}

function StorageCard({ data }: { data: StorageCardData }) {
  const smokeLabel =
    data.smokeKind === "collectionGroup"
      ? "Photos (collectionGroup count)"
      : data.smokeKind === "single-event"
        ? "Photos (single-event smoke)"
        : "Photos";
  return (
    <CardShell eyebrow="Card 6" title="Storage / R2">
      {data.error && <ErrorLine msg={data.error} />}
      <KeyValueRow label="Bucket" value={data.bucket ?? "—"} mono />
      <KeyValueRow label="Endpoint" value={data.endpoint ?? "—"} mono />
      <KeyValueRow
        label={smokeLabel}
        value={data.smokeCount === null ? "n/a" : String(data.smokeCount)}
      />
      <p
        style={{
          fontSize: "0.7rem",
          color: "var(--charcoal-muted)",
          margin: "0.4rem 0 0",
        }}
      >
        Informational. R2 is not contacted from this page to avoid request
        cost.
      </p>
    </CardShell>
  );
}

function SystemVersionCard({ data }: { data: SystemVersionData }) {
  const sha = data.commitSha ? data.commitSha.slice(0, 7) : null;
  return (
    <CardShell eyebrow="Card 7" title="System version">
      <KeyValueRow label="Next.js" value={data.nextVersion} mono />
      <KeyValueRow label="Node" value={data.nodeVersion} mono />
      <KeyValueRow label="Commit" value={sha ?? "—"} mono />
    </CardShell>
  );
}

function ErrorLine({ msg }: { msg: string }) {
  return (
    <p
      style={{
        fontSize: "0.7rem",
        color: "#9B2C2C",
        margin: 0,
        padding: "0.4rem 0.6rem",
        background: "rgba(155,44,44,0.06)",
        border: "0.5px solid rgba(155,44,44,0.2)",
      }}
    >
      Soft failure: {msg}
    </p>
  );
}
