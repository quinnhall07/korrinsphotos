// app/admin/page.tsx
// Admin dashboard — action-oriented panels (Today & Tomorrow + Needs Action)
// replace the legacy vanity counters. Recent Inquiries, Activity Feed and
// Recent Events are preserved.

import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { listRecentActivity } from "@/lib/db/activity";
import type { ProjectDoc, ProjectStatus } from "@/lib/db/projects";
import type { InvoiceDoc } from "@/lib/db/invoices";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard | Admin" };
export const dynamic = "force-dynamic";

const STUDIO_TZ = "America/New_York";

// ─── TZ helpers ────────────────────────────────────────────────────────────
// Construct a `Date` representing the wall-clock instant of (y/m/d hh:mm) in
// America/New_York. We compute the TZ offset by formatting the date in the
// studio TZ, comparing against UTC, and shifting accordingly.
function studioWallTimeToInstant(year: number, month: number, day: number, hour: number, minute: number): Date {
  // Build a Date as if it were UTC, then shift by the NY offset for that instant.
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  // Format that instant back in NY and extract the components.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: STUDIO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(utcGuess));
  const map: Record<string, number> = {};
  for (const p of parts) if (p.type !== "literal") map[p.type] = Number(p.value);
  // The hour Intl returns may be "24" at midnight — normalize to 0.
  if (map.hour === 24) map.hour = 0;
  const asUtcOfNyParts = Date.UTC(map.year, map.month - 1, map.day, map.hour, map.minute);
  const offsetMs = asUtcOfNyParts - utcGuess;
  return new Date(utcGuess - offsetMs);
}

function getStudioDayBoundaries() {
  // "Today" in America/New_York
  const nyParts = new Intl.DateTimeFormat("en-US", {
    timeZone: STUDIO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const m: Record<string, string> = {};
  for (const p of nyParts) if (p.type !== "literal") m[p.type] = p.value;
  const y = Number(m.year);
  const mo = Number(m.month);
  const d = Number(m.day);
  const startOfToday = studioWallTimeToInstant(y, mo, d, 0, 0);
  // End of tomorrow = start of (today + 2)
  const endOfTomorrow = new Date(studioWallTimeToInstant(y, mo, d, 0, 0).getTime() + 2 * 24 * 60 * 60 * 1000);
  // Start of tomorrow (used to label rows as "Today" vs "Tomorrow")
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  return { startOfToday, startOfTomorrow, endOfTomorrow };
}

function formatShootTime(ts: Timestamp | null | undefined): string {
  if (!ts?.toDate) return "—";
  return ts.toDate().toLocaleString("en-US", {
    timeZone: STUDIO_TZ,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ─── Types ─────────────────────────────────────────────────────────────────
type TodayTomorrowRow = {
  projectId: string;
  clientName: string;
  sessionType: string;
  shootTimeLabel: string;
  dayBucket: "Today" | "Tomorrow";
};

type NeedsActionRow = {
  key: string;
  label: string;
  subject: string; // project/client name
  href: string;
  bucket: number; // priority bucket (lower = higher priority)
  sortAt: number; // ms; within bucket, sort desc (newest overdue first)
};

type RecentInquiry = {
  id: string;
  name: string;
  sessionType: string;
  preferredDate: string | null;
  status: string;
};

type RecentEvent = {
  id: string;
  title: string;
  createdAt: string;
  photoCount: number;
  clientCount: number;
};

type DashboardData = {
  today: TodayTomorrowRow[];
  needsAction: NeedsActionRow[];
  recentInquiries: RecentInquiry[];
  recentEvents: RecentEvent[];
};

// ─── Data ──────────────────────────────────────────────────────────────────
async function resolveClientNames(clientIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = Array.from(new Set(clientIds.filter(Boolean)));
  if (unique.length === 0) return map;
  const refs = unique.map((id) => adminDb.collection("clients").doc(id));
  const snaps = await adminDb.getAll(...refs);
  for (const s of snaps) {
    if (!s.exists) continue;
    const c = s.data() ?? {};
    const name = `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || c.email || "—";
    map.set(s.id, name);
  }
  return map;
}

async function getDashboardData(): Promise<DashboardData> {
  const { startOfToday, startOfTomorrow, endOfTomorrow } = getStudioDayBoundaries();
  const nowTs = Timestamp.now();
  const todayTs = Timestamp.fromDate(startOfToday);
  const tomorrowEndTs = Timestamp.fromDate(endOfTomorrow);

  const UNSIGNED_STATUSES: ProjectStatus[] = ["CONTRACT_SENT", "NEGOTIATING", "PROPOSAL_SENT"];
  // 14 days from now — for COI proximity filter
  const fourteenDaysOut = Timestamp.fromMillis(Date.now() + 14 * 24 * 60 * 60 * 1000);

  // Run queries in parallel
  const [
    shootsSnap,
    depositPendingSnap,
    unsignedSnap,
    overdueInvoicesSnap,
    sentInvoicesSnap,
    followUpDueSnap,
    coiRequestedSnap,
    pendingTasksSnap,
    recentProjectsSnap,
    recentEventsSnap,
  ] = await Promise.all([
    adminDb
      .collection("projects")
      .where("shootDate", ">=", todayTs)
      .where("shootDate", "<=", tomorrowEndTs)
      .orderBy("shootDate", "asc")
      .get(),
    adminDb.collection("projects").where("status", "==", "DEPOSIT_PENDING").get(),
    adminDb.collection("projects").where("status", "in", UNSIGNED_STATUSES).get(),
    adminDb.collection("invoices").where("status", "==", "OVERDUE").get(),
    // Invoices marked SENT whose dueDate has passed (we'll filter dueDate < now in-memory to avoid an extra composite index)
    adminDb.collection("invoices").where("status", "==", "SENT").get(),
    adminDb
      .collection("projects")
      .where("followUpDate", "<=", nowTs)
      .orderBy("followUpDate", "desc")
      .limit(25)
      .get(),
    adminDb.collection("projects").where("coiStatus", "==", "REQUESTED").get(),
    adminDb
      .collection("scheduledTasks")
      .where("status", "==", "PENDING")
      .where("runAt", "<=", nowTs)
      .orderBy("runAt", "desc")
      .limit(25)
      .get(),
    adminDb.collection("projects").orderBy("createdAt", "desc").limit(5).get(),
    adminDb.collection("events").orderBy("createdAt", "desc").limit(5).get(),
  ]);

  // Helper: keep only docs whose shootDate falls inside our window.
  // (Defensive — query already does this, but timestamps from doc.data() use the helper.)
  const todayRows: { doc: FirebaseFirestore.QueryDocumentSnapshot; data: ProjectDoc }[] = [];
  for (const doc of shootsSnap.docs) {
    todayRows.push({ doc, data: doc.data() as ProjectDoc });
  }

  // ─── Build "Needs Action" candidates ─────────────────────────────────────
  const needsAction: NeedsActionRow[] = [];
  const allProjectIdsForNames = new Set<string>();
  const allClientIdsForNames = new Set<string>();

  // 1. DEPOSIT_PENDING (bucket 0 — most urgent revenue)
  for (const d of depositPendingSnap.docs) {
    const data = d.data() as ProjectDoc;
    if (data.clientId) allClientIdsForNames.add(data.clientId);
    needsAction.push({
      key: `dp-${d.id}`,
      label: "Deposit pending",
      subject: `${data.title ?? "—"}`,
      href: `/admin/projects/${d.id}`,
      bucket: 0,
      sortAt: data.updatedAt?.toMillis?.() ?? 0,
    });
    // We render subject as client name where useful; track for resolution.
    allProjectIdsForNames.add(d.id);
  }

  // 2. Unsigned contracts (bucket 1) — filter !contractSignedAt in-memory
  for (const d of unsignedSnap.docs) {
    const data = d.data() as ProjectDoc;
    if (data.contractSignedAt) continue; // already signed
    if (data.clientId) allClientIdsForNames.add(data.clientId);
    needsAction.push({
      key: `uc-${d.id}`,
      label: "Unsigned contract",
      subject: data.title ?? "—",
      href: `/admin/projects/${d.id}`,
      bucket: 1,
      sortAt: data.updatedAt?.toMillis?.() ?? 0,
    });
    allProjectIdsForNames.add(d.id);
  }

  // 3. Overdue invoices (bucket 2) — explicit OVERDUE + SENT past dueDate
  const overdueInvoices: { id: string; data: InvoiceDoc }[] = [];
  for (const d of overdueInvoicesSnap.docs) {
    overdueInvoices.push({ id: d.id, data: d.data() as InvoiceDoc });
  }
  for (const d of sentInvoicesSnap.docs) {
    const data = d.data() as InvoiceDoc;
    const dueMs = data.dueDate?.toMillis?.() ?? 0;
    if (dueMs && dueMs < Date.now()) {
      overdueInvoices.push({ id: d.id, data });
    }
  }
  for (const { id, data } of overdueInvoices) {
    if (data.clientId) allClientIdsForNames.add(data.clientId);
    needsAction.push({
      key: `inv-${id}`,
      label: `Overdue invoice ($${((data.amountCents ?? 0) / 100).toFixed(0)})`,
      subject: data.projectId ? `Project ${data.projectId.slice(0, 8)}…` : "—",
      href: data.projectId ? `/admin/projects/${data.projectId}` : "/admin/projects",
      bucket: 2,
      sortAt: data.dueDate?.toMillis?.() ?? 0,
    });
  }

  // 4. Follow-ups due (bucket 3)
  for (const d of followUpDueSnap.docs) {
    const data = d.data() as ProjectDoc;
    if (data.clientId) allClientIdsForNames.add(data.clientId);
    needsAction.push({
      key: `fu-${d.id}`,
      label: "Follow-up due",
      subject: data.title ?? "—",
      href: `/admin/projects/${d.id}`,
      bucket: 3,
      sortAt: data.followUpDate?.toMillis?.() ?? 0,
    });
  }

  // 5. COI requested + shootDate within 14 days (bucket 4)
  for (const d of coiRequestedSnap.docs) {
    const data = d.data() as ProjectDoc;
    const shootMs = data.shootDate?.toMillis?.();
    if (!shootMs) continue;
    if (shootMs > fourteenDaysOut.toMillis()) continue;
    if (shootMs < Date.now() - 24 * 60 * 60 * 1000) continue; // past shoots — skip
    if (data.clientId) allClientIdsForNames.add(data.clientId);
    needsAction.push({
      key: `coi-${d.id}`,
      label: "COI requested, not received",
      subject: data.title ?? "—",
      href: `/admin/projects/${d.id}`,
      bucket: 4,
      sortAt: shootMs,
    });
  }

  // 6. Scheduled tasks due (bucket 5)
  for (const d of pendingTasksSnap.docs) {
    const data = d.data() as { type?: string; projectId?: string; clientId?: string; runAt?: Timestamp };
    if (data.clientId) allClientIdsForNames.add(data.clientId);
    const label = data.type ? `Task: ${String(data.type).replace(/_/g, " ").toLowerCase()}` : "Scheduled task due";
    needsAction.push({
      key: `task-${d.id}`,
      label,
      subject: data.projectId ? `Project ${data.projectId.slice(0, 8)}…` : "—",
      href: data.projectId ? `/admin/projects/${data.projectId}` : "/admin/projects",
      bucket: 5,
      sortAt: data.runAt?.toMillis?.() ?? 0,
    });
  }

  // Sort: bucket asc, then sortAt desc (newest overdue first within each bucket)
  needsAction.sort((a, b) => (a.bucket - b.bucket) || (b.sortAt - a.sortAt));
  const needsActionCapped = needsAction.slice(0, 12);

  // ─── Resolve client names for Today/Tomorrow + recent inquiries ──────────
  for (const { data } of todayRows) {
    if (data.clientId) allClientIdsForNames.add(data.clientId);
  }
  for (const d of recentProjectsSnap.docs) {
    const data = d.data() as ProjectDoc;
    if (data.clientId) allClientIdsForNames.add(data.clientId);
  }
  const clientNames = await resolveClientNames(Array.from(allClientIdsForNames));

  // Today/Tomorrow rows
  const today: TodayTomorrowRow[] = todayRows.map(({ doc, data }) => {
    const shootMs = data.shootDate?.toMillis?.() ?? 0;
    const dayBucket: "Today" | "Tomorrow" = shootMs < startOfTomorrow.getTime() ? "Today" : "Tomorrow";
    return {
      projectId: doc.id,
      clientName: (data.clientId && clientNames.get(data.clientId)) || data.title || "—",
      sessionType: (data.sessionType as string) ?? "—",
      shootTimeLabel: formatShootTime(data.shootDate ?? null),
      dayBucket,
    };
  });

  // Recent inquiries
  const recentInquiries: RecentInquiry[] = recentProjectsSnap.docs.map((doc) => {
    const data = doc.data() as ProjectDoc;
    const name = (data.clientId && clientNames.get(data.clientId)) || "—";
    return {
      id: doc.id,
      name,
      sessionType: (data.sessionType as string) ?? "—",
      preferredDate: data.shootDate?.toDate
        ? data.shootDate.toDate().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : null,
      status: (data.status as string) ?? "INQUIRY",
    };
  });

  // Recent events with photo + client counts
  const recentEvents: RecentEvent[] = await Promise.all(
    recentEventsSnap.docs.map(async (doc) => {
      const data = doc.data();
      const [photoSnap, accessSnap] = await Promise.all([
        adminDb.collection("events").doc(doc.id).collection("photos").count().get(),
        adminDb.collection("eventAccess").where("eventId", "==", doc.id).count().get(),
      ]);
      return {
        id: doc.id,
        title: data.title as string,
        createdAt: data.createdAt?.toDate
          ? data.createdAt.toDate().toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "—",
        photoCount: photoSnap.data().count,
        clientCount: accessSnap.data().count,
      };
    })
  );

  return { today, needsAction: needsActionCapped, recentInquiries, recentEvents };
}

// ─── Styles / static maps ──────────────────────────────────────────────────
const STATUS_STYLES: Record<string, React.CSSProperties> = {
  SITE_VISIT:        { background: "#FEF3C7", color: "#92400E" },
  INQUIRY:           { background: "#FEF3C7", color: "#92400E" },
  QUALIFYING:        { background: "#E0E7FF", color: "#3730A3" },
  PROPOSAL_SENT:     { background: "#DBEAFE", color: "#1D4ED8" },
  NEGOTIATING:       { background: "#E0E7FF", color: "#3730A3" },
  CONTRACT_SENT:     { background: "#FED7AA", color: "#9A3412" },
  DEPOSIT_PENDING:   { background: "#FEE2E2", color: "#991B1B" },
  BOOKED:            { background: "#D1FAE5", color: "#065F46" },
  SHOOT_READY:       { background: "#CCFBF1", color: "#0F766E" },
  IN_EDITING:        { background: "#E0E7FF", color: "#3730A3" },
  GALLERY_DELIVERED: { background: "#F3E8FF", color: "#6B21A8" },
  REFERRAL_SENT:     { background: "#F3E8FF", color: "#6B21A8" },
  COMPLETED:         { background: "#F1F5F9", color: "var(--charcoal)" },
  LOST:              { background: "rgba(42,42,40,0.06)", color: "var(--charcoal-muted)" },
  ARCHIVED:          { background: "rgba(42,42,40,0.06)", color: "var(--charcoal-muted)" },
};

const ACTIVITY_ICONS: Record<string, string> = {
  LEAD_RECEIVED:  "✉️",
  STATUS_CHANGED: "⇄",
  EMAIL_SENT:     "📤",
  NOTE_ADDED:     "📝",
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// ─── Render ────────────────────────────────────────────────────────────────
export default async function AdminDashboard() {
  await requireAdmin();

  let data: DashboardData;
  try {
    data = await getDashboardData();
  } catch (err) {
    console.error("Dashboard data error:", err);
    data = { today: [], needsAction: [], recentInquiries: [], recentEvents: [] };
  }

  const activities = await listRecentActivity(8).catch(() => []);
  const { today, needsAction, recentInquiries, recentEvents } = data;

  return (
    <div className="page-fade-in">
      {/* Greeting */}
      <div style={{ marginBottom: "2.5rem" }}>
        <p
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--olive)",
            marginBottom: "0.5rem",
          }}
        >
          {getGreeting()}
        </p>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "2.2rem",
            fontWeight: 300,
          }}
        >
          Korrin&apos;s Studio
        </h1>
      </div>

      {/* Today & Tomorrow + Needs Action row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        {/* Today & Tomorrow */}
        <section style={cardStyle}>
          <div style={cardHeader}>
            <span style={cardHeaderLabel}>Today &amp; Tomorrow</span>
            <span style={cardHeaderMuted}>
              {today.length} {today.length === 1 ? "shoot" : "shoots"}
            </span>
          </div>
          {today.length === 0 ? (
            <p style={emptyStateStyle}>No shoots today or tomorrow.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {today.map((row) => (
                <li key={row.projectId} style={rowStyle}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: "0.6rem", alignItems: "baseline", marginBottom: "0.2rem" }}>
                      <span
                        style={{
                          fontSize: "0.6rem",
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          color: row.dayBucket === "Today" ? "var(--olive)" : "var(--charcoal-muted)",
                          fontWeight: 500,
                        }}
                      >
                        {row.dayBucket}
                      </span>
                      <span style={{ fontSize: "0.78rem", color: "var(--charcoal)" }}>
                        {row.shootTimeLabel}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.88rem", color: "var(--charcoal)", marginBottom: "0.1rem" }}>
                      {row.clientName}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--charcoal-muted)" }}>
                      {row.sessionType}
                    </div>
                  </div>
                  <Link href={`/admin/projects/${row.projectId}`} style={btnOutlineDark}>
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Needs Action */}
        <section style={cardStyle}>
          <div style={cardHeader}>
            <span style={cardHeaderLabel}>Needs Action</span>
            <span style={cardHeaderMuted}>
              {needsAction.length}
              {needsAction.length >= 12 ? "+" : ""} {needsAction.length === 1 ? "item" : "items"}
            </span>
          </div>
          {needsAction.length === 0 ? (
            <p style={emptyStateStyle}>Inbox zero. Nothing requires action right now.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {needsAction.map((row) => (
                <li key={row.key} style={rowStyle}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "0.6rem",
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "var(--olive)",
                        marginBottom: "0.2rem",
                        fontWeight: 500,
                      }}
                    >
                      {row.label}
                    </div>
                    <div
                      style={{
                        fontSize: "0.85rem",
                        color: "var(--charcoal)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.subject}
                    </div>
                  </div>
                  <Link href={row.href} style={btnOutlineDark}>
                    Review
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Two-column lower section */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        {/* Recent inquiries */}
        <div
          style={{
            border: "0.5px solid var(--border)",
            background: "var(--white)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "1.2rem 1.5rem",
              borderBottom: "0.5px solid var(--border)",
            }}
          >
            <span
              style={{
                fontSize: "0.72rem",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--charcoal)",
                fontWeight: 500,
              }}
            >
              Recent Inquiries
            </span>
            <Link href="/admin/projects" style={btnOutlineDark}>
              View All
            </Link>
          </div>

          {recentInquiries.length === 0 ? (
            <p
              style={{
                padding: "2rem",
                textAlign: "center",
                color: "var(--charcoal-muted)",
                fontSize: "0.85rem",
              }}
            >
              No inquiries yet. They&apos;ll appear here after clients submit the
              booking form.
            </p>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.85rem",
              }}
            >
              <thead>
                <tr>
                  {["Name", "Session Type", "Date Requested", "Status", ""].map(
                    (h) => (
                      <th key={h} style={thStyle}>
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {recentInquiries.map((inq) => (
                  <tr key={inq.id}>
                    <td style={tdStyle}>{inq.name}</td>
                    <td style={tdStyle}>{inq.sessionType}</td>
                    <td style={tdStyle}>{inq.preferredDate ?? "—"}</td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.25rem 0.65rem",
                          fontSize: "0.62rem",
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          ...(STATUS_STYLES[inq.status] ?? {}),
                        }}
                      >
                        {inq.status.replace("_", " ")}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <Link href={`/admin/projects/${inq.id}`} style={btnOutlineDark}>
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Activity feed */}
        <div
          style={{
            border: "0.5px solid var(--border)",
            background: "var(--white)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: "1.2rem 1.5rem",
              borderBottom: "0.5px solid var(--border)",
            }}
          >
            <span
              style={{
                fontSize: "0.72rem",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--charcoal)",
                fontWeight: 500,
              }}
            >
              Recent Activity
            </span>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {activities.length === 0 ? (
              <p
                style={{
                  padding: "2rem",
                  textAlign: "center",
                  color: "var(--charcoal-muted)",
                  fontSize: "0.82rem",
                  fontStyle: "italic",
                }}
              >
                Activity will appear here as you manage leads and galleries.
              </p>
            ) : (
              <div style={{ padding: "0.5rem 0" }}>
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "0.75rem",
                      padding: "0.75rem 1.2rem",
                      borderBottom: "0.5px solid var(--border)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "1rem",
                        flexShrink: 0,
                        marginTop: "0.1rem",
                        opacity: 0.8,
                      }}
                    >
                      {ACTIVITY_ICONS[activity.action] ?? "•"}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: "0.78rem",
                          color: "var(--charcoal)",
                          lineHeight: 1.5,
                          marginBottom: "0.2rem",
                        }}
                      >
                        {activity.message}
                      </p>
                      <p
                        style={{
                          fontSize: "0.65rem",
                          color: "var(--charcoal-muted)",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {activity.timestamp?.toDate?.()?.toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }) ?? "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent events */}
      <div style={{ border: "0.5px solid var(--border)", background: "var(--white)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1.2rem 1.5rem",
            borderBottom: "0.5px solid var(--border)",
          }}
        >
          <span
            style={{
              fontSize: "0.72rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--charcoal)",
              fontWeight: 500,
            }}
          >
            Recent Events
          </span>
          <Link
            href="/admin/events"
            style={{
              ...btnOlive,
              padding: "0.5rem 1.2rem",
              fontSize: "0.65rem",
            }}
          >
            + New Event
          </Link>
        </div>

        {recentEvents.length === 0 ? (
          <p
            style={{
              padding: "2rem",
              textAlign: "center",
              color: "var(--charcoal-muted)",
              fontSize: "0.85rem",
            }}
          >
            No events yet.{" "}
            <Link
              href="/admin/events"
              style={{ color: "var(--olive)", textDecoration: "none" }}
            >
              Create your first event →
            </Link>
          </p>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.85rem",
            }}
          >
            <thead>
              <tr>
                {["Event Name", "Photos", "Clients", "Created", ""].map((h) => (
                  <th key={h} style={thStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentEvents.map((ev) => (
                <tr key={ev.id}>
                  <td style={tdStyle}>
                    <strong style={{ fontWeight: 500 }}>{ev.title}</strong>
                  </td>
                  <td style={tdStyle}>{ev.photoCount.toLocaleString()}</td>
                  <td style={tdStyle}>{ev.clientCount}</td>
                  <td style={tdStyle}>{ev.createdAt}</td>
                  <td style={tdStyle}>
                    <Link href={`/admin/events/${ev.id}`} style={btnOutlineDark}>
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  border: "0.5px solid var(--border)",
  background: "var(--white)",
  display: "flex",
  flexDirection: "column",
};

const cardHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "1.1rem 1.5rem",
  borderBottom: "0.5px solid var(--border)",
};

const cardHeaderLabel: React.CSSProperties = {
  fontSize: "0.72rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--charcoal)",
  fontWeight: 500,
};

const cardHeaderMuted: React.CSSProperties = {
  fontSize: "0.65rem",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--charcoal-muted)",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  padding: "0.85rem 1.5rem",
  borderBottom: "0.5px solid var(--border)",
};

const emptyStateStyle: React.CSSProperties = {
  padding: "2rem 1.5rem",
  textAlign: "center",
  color: "var(--charcoal-muted)",
  fontSize: "0.85rem",
  fontStyle: "italic",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "0.75rem 1rem",
  fontSize: "0.65rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--charcoal-muted)",
  borderBottom: "0.5px solid var(--border-strong)",
  fontWeight: 400,
};

const tdStyle: React.CSSProperties = {
  padding: "0.9rem 1rem",
  borderBottom: "0.5px solid var(--border)",
  color: "var(--charcoal-light)",
  verticalAlign: "middle",
};

const btnOutlineDark: React.CSSProperties = {
  display: "inline-block",
  padding: "0.5rem 1.2rem",
  fontSize: "0.65rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--charcoal)",
  border: "0.5px solid var(--border-strong)",
  textDecoration: "none",
  background: "transparent",
  fontFamily: "'Jost', sans-serif",
};

const btnOlive: React.CSSProperties = {
  display: "inline-block",
  background: "var(--olive)",
  color: "var(--white)",
  textDecoration: "none",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  fontFamily: "'Jost', sans-serif",
};
