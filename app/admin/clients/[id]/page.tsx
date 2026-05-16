// app/admin/clients/[id]/page.tsx — Wave 11
//
// Per-client detail page. Server Component. Loads:
//   - the client doc
//   - all projects for the client (descending by createdAt)
//   - all invoices for the client (descending by createdAt)
//   - aggregated message counts via projects[].messages subcollection .count()
// then renders sections: header, stats, project history, invoice ledger,
// communication summary, edit affordance.

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import {
  getClient,
  getClientByReferralCode,
  type ClientDoc,
  type RecurringCadence,
} from "@/lib/db/clients";
import { getProjectsByClientId, projectMessagesCol, type ProjectDoc, type ProjectStatus } from "@/lib/db/projects";
import { invoicesCol, type InvoiceDoc, type InvoiceStatus } from "@/lib/db/invoices";
import {
  listDownloadsForClient,
  type LeadMagnetDownloadDoc,
} from "@/lib/db/lead-magnet-downloads";
import {
  listEnrollmentsByClient,
  type SequenceEnrollmentDoc,
} from "@/lib/db/sequence-enrollments";
import { getLeadMagnet } from "@/lib/db/lead-magnets";
import { getSequence } from "@/lib/db/sequences";
import { formatDateTime, formatDisplayDate } from "@/lib/date";
import { EditClientForm } from "./EditClientForm";

export const metadata: Metadata = { title: "Client | Admin" };
export const dynamic = "force-dynamic";

function fmtUsd(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function statusLabel(status: ProjectStatus | InvoiceStatus): string {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const STATUS_BADGE: Record<string, React.CSSProperties> = {
  PAID: { background: "#D1FAE5", color: "#065F46" },
  SENT: { background: "#FEF3C7", color: "#78350F" },
  DRAFT: { background: "#E5E7EB", color: "#374151" },
  OVERDUE: { background: "#FEE2E2", color: "#991B1B" },
  VOID: { background: "#E5E7EB", color: "#6B7280" },
  ACTIVE: { background: "#D1FAE5", color: "#065F46" },
  COMPLETED: { background: "#E0E7FF", color: "#3730A3" },
  CANCELED: { background: "#E5E7EB", color: "#6B7280" },
  FAILED: { background: "#FEE2E2", color: "#991B1B" },
};

export default async function ClientDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await props.params;

  const client = await getClient(id);
  if (!client) notFound();

  // Fan-out: projects + invoices + acquisition reads in parallel.
  const [projects, invoicesSnap, downloads, enrollments] = await Promise.all([
    getProjectsByClientId(id),
    invoicesCol().where("clientId", "==", id).get(),
    listDownloadsForClient(id).catch(() => [] as LeadMagnetDownloadDoc[]),
    listEnrollmentsByClient(id).catch(() => [] as SequenceEnrollmentDoc[]),
  ]);

  // Resolve magnet titles + sequence names for the Acquisition section. The
  // sets are small (per-client downloads + enrollments) so a parallel fan-out
  // is cheap; missing docs (deleted post-enrollment) are tolerated.
  const magnetIds = Array.from(
    new Set(downloads.map((d) => d.leadMagnetId).filter(Boolean))
  );
  const sequenceIds = Array.from(
    new Set(enrollments.map((e) => e.sequenceId).filter(Boolean))
  );
  const [magnetTitles, sequenceNames] = await Promise.all([
    Promise.all(magnetIds.map((mid) => getLeadMagnet(mid).catch(() => null))).then(
      (arr) => {
        const m = new Map<string, string>();
        arr.forEach((doc, i) => {
          if (doc) m.set(magnetIds[i], doc.title);
        });
        return m;
      }
    ),
    Promise.all(sequenceIds.map((sid) => getSequence(sid).catch(() => null))).then(
      (arr) => {
        const m = new Map<string, string>();
        arr.forEach((doc, i) => {
          if (doc) m.set(sequenceIds[i], doc.name);
        });
        return m;
      }
    ),
  ]);

  const invoices: InvoiceDoc[] = invoicesSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as InvoiceDoc)
  );
  // Sort invoices in-memory: createdAt desc.
  invoices.sort((a, b) => {
    const am = a.createdAt?.toMillis?.() ?? 0;
    const bm = b.createdAt?.toMillis?.() ?? 0;
    return bm - am;
  });

  // Lifetime value — PAID invoices ONLY (per task constraint).
  const lifetimeValueCents = invoices
    .filter((inv) => inv.status === "PAID")
    .reduce((sum, inv) => sum + (Number(inv.amountCents) || 0), 0);

  const totalSessions = client.totalSessionsBooked ?? projects.length;
  const projectsWithValue = projects.filter((p) => typeof p.packagePriceUsd === "number" && p.packagePriceUsd! > 0);
  const avgProjectValueCents = projectsWithValue.length > 0
    ? Math.round(
        (projectsWithValue.reduce((s, p) => s + (Number(p.packagePriceUsd) || 0), 0) /
          projectsWithValue.length) *
          100
      )
    : 0;

  // Most recent NPS across projects, if any.
  const lastNps = projects
    .map((p) => ({ at: p.clientNpsAt?.toMillis?.() ?? 0, score: p.clientNps }))
    .filter((r) => typeof r.score === "number" && r.at > 0)
    .sort((a, b) => b.at - a.at)[0]?.score;

  // Communication summary — sum per-project message counts.
  const messageCounts = await Promise.all(
    projects.map(async (p) => {
      try {
        const snap = await projectMessagesCol(p.id).count().get();
        return snap.data().count;
      } catch {
        return 0;
      }
    })
  );
  const totalMessages = messageCounts.reduce((s, n) => s + n, 0);

  const lastContactedAt = projects
    .map((p) => p.lastContactedAt?.toMillis?.() ?? 0)
    .reduce((max, n) => (n > max ? n : max), 0);
  const lastRespondedAt = projects
    .map((p) => p.lastRespondedAt?.toMillis?.() ?? 0)
    .reduce((max, n) => (n > max ? n : max), 0);

  // Referrer lookup — `referredBy` stores the referrer's referralCode.
  let referrer: ClientDoc | null = null;
  if (client.referredBy) {
    referrer = await getClientByReferralCode(client.referredBy).catch(() => null);
  }

  // Time-to-first-inquiry: delta between firstTouchAt and the earliest
  // project createdAt. Rendered as "Xd Yh" or "Yh" (or "—" if either anchor
  // is missing or the project predates the touch).
  const firstTouchMs = client.firstTouchAt?.toMillis?.() ?? 0;
  const firstProjectMs = projects.length > 0
    ? Math.min(...projects.map((p) => p.createdAt?.toMillis?.() ?? Number.POSITIVE_INFINITY))
    : 0;
  let timeToFirstInquiry = "—";
  if (firstTouchMs > 0 && Number.isFinite(firstProjectMs) && firstProjectMs > firstTouchMs) {
    const delta = firstProjectMs - firstTouchMs;
    const days = Math.floor(delta / (24 * 60 * 60 * 1000));
    const hours = Math.floor((delta % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    timeToFirstInquiry = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
  }

  const fullName = `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim() || "—";
  const cadence: RecurringCadence = client.recurringCadence ?? "NONE";

  return (
    <div className="page-fade-in">
      <div style={{ marginBottom: "1.25rem" }}>
        <Link
          href="/admin/clients"
          style={{
            fontSize: "0.7rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--charcoal-muted)",
            textDecoration: "none",
          }}
        >
          ← All clients
        </Link>
      </div>

      {/* Header card */}
      <section
        style={{
          padding: "1.5rem 1.5rem 1.25rem",
          border: "0.5px solid var(--border-strong)",
          background: "var(--white)",
          marginBottom: "1.5rem",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "1rem",
          }}
        >
          <div>
            <p
              style={{
                fontSize: "0.6rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--olive)",
                marginBottom: "0.4rem",
              }}
            >
              Client
            </p>
            <h2
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "2rem",
                fontWeight: 300,
                marginBottom: "0.4rem",
              }}
            >
              {fullName}
            </h2>
            <div style={{ fontSize: "0.85rem", color: "var(--charcoal-light)", lineHeight: 1.7 }}>
              <div>{client.email}</div>
              {client.phone && <div>{client.phone}</div>}
            </div>
          </div>
          <EditClientForm
            clientId={client.id}
            initial={{
              firstName: client.firstName ?? "",
              lastName: client.lastName ?? "",
              phone: client.phone ?? "",
              recurringCadence: cadence,
              notes: client.notes ?? "",
            }}
          />
        </div>

        <div
          style={{
            marginTop: "1.5rem",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "1rem",
            paddingTop: "1.25rem",
            borderTop: "0.5px solid var(--border)",
          }}
        >
          <Meta label="First touch source" value={client.firstTouchSource ?? "—"} />
          <Meta label="First touch campaign" value={client.firstTouchCampaign ?? "—"} />
          <Meta label="Referral code" value={client.referralCode ?? "—"} />
          <Meta
            label="Referred by"
            value={
              referrer
                ? `${referrer.firstName} ${referrer.lastName} (${referrer.email})`
                : client.referredBy
                  ? client.referredBy
                  : "—"
            }
          />
          <Meta label="Cadence" value={cadenceLabel(cadence)} />
          <Meta label="Joined" value={formatDisplayDate(client.createdAt) ?? "—"} />
        </div>

        {/* Internal notes — admin-only */}
        {client.notes && client.notes.trim().length > 0 && (
          <div
            style={{
              marginTop: "1.25rem",
              padding: "0.85rem 1rem",
              background: "var(--olive-dim)",
              border: "0.5px solid var(--border)",
              fontSize: "0.85rem",
              color: "var(--charcoal-light)",
              whiteSpace: "pre-wrap",
              lineHeight: 1.6,
            }}
          >
            <p
              style={{
                fontSize: "0.6rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--charcoal-muted)",
                marginBottom: "0.35rem",
              }}
            >
              Internal notes (admin-only)
            </p>
            {client.notes}
          </div>
        )}
      </section>

      {/* Stats row */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <Stat label="Sessions booked" value={totalSessions.toString()} />
        <Stat label="Lifetime value (paid)" value={fmtUsd(lifetimeValueCents)} />
        <Stat label="Average project" value={avgProjectValueCents > 0 ? fmtUsd(avgProjectValueCents) : "—"} />
        <Stat label="Last NPS" value={lastNps ? `${lastNps}/5` : "—"} />
      </section>

      {/* Project history */}
      <section style={{ marginBottom: "1.5rem" }}>
        <SectionHeader title="Project history" subtitle={`${projects.length} project${projects.length === 1 ? "" : "s"}`} />
        <div style={{ border: "0.5px solid var(--border)", background: "var(--white)" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.85rem",
            }}
          >
            <thead>
              <tr>
                {["Title", "Status", "Session type", "Shoot date", "Package", "Created"].map((h) => (
                  <th key={h} style={thStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 && (
                <tr>
                  <td colSpan={6} style={emptyCellStyle}>
                    No projects yet for this client.
                  </td>
                </tr>
              )}
              {projects.map((p) => (
                <tr key={p.id}>
                  <td style={tdStyle}>
                    <Link
                      href={`/admin/projects/${p.id}`}
                      style={{ color: "var(--charcoal)", textDecoration: "none", fontWeight: 500 }}
                    >
                      {p.title || "Untitled"}
                    </Link>
                  </td>
                  <td style={tdStyle}>
                    <Badge label={statusLabel(p.status)} />
                  </td>
                  <td style={tdStyle}>{p.sessionType || "—"}</td>
                  <td style={tdStyle}>{formatDisplayDate(p.shootDate) ?? "—"}</td>
                  <td style={tdStyle}>
                    {p.packagePriceUsd ? `$${p.packagePriceUsd.toLocaleString()}` : "—"}
                  </td>
                  <td style={tdStyle}>{formatDisplayDate(p.createdAt) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Acquisition */}
      <section style={{ marginBottom: "1.5rem" }}>
        <SectionHeader
          title="Acquisition"
          subtitle={`${downloads.length} download${downloads.length === 1 ? "" : "s"} · ${enrollments.length} enrollment${enrollments.length === 1 ? "" : "s"}`}
        />

        {/* First-touch detail */}
        <div
          style={{
            border: "0.5px solid var(--border)",
            background: "var(--white)",
            padding: "1.25rem 1.5rem",
            marginBottom: "1rem",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "1rem",
          }}
        >
          <Meta label="Source" value={client.firstTouchSource ?? "—"} />
          <Meta label="Medium" value={client.firstTouchMedium ?? "—"} />
          <Meta label="Campaign" value={client.firstTouchCampaign ?? "—"} />
          <div title={client.firstTouchLandingUrl ?? undefined}>
            <p
              style={{
                fontSize: "0.6rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--charcoal-muted)",
                marginBottom: "0.3rem",
              }}
            >
              Landing URL
            </p>
            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--charcoal)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {client.firstTouchLandingUrl ?? "—"}
            </p>
          </div>
          <Meta
            label="First touch"
            value={formatDateTime(client.firstTouchAt) ?? "—"}
          />
          <Meta label="Time to first inquiry" value={timeToFirstInquiry} />
        </div>

        {/* Lead magnet downloads */}
        <div
          style={{
            border: "0.5px solid var(--border)",
            background: "var(--white)",
            marginBottom: "1rem",
          }}
        >
          <p
            style={{
              padding: "0.85rem 1rem",
              fontSize: "0.62rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--charcoal-muted)",
              borderBottom: "0.5px solid var(--border-strong)",
              margin: 0,
            }}
          >
            Lead magnet downloads
          </p>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.85rem",
            }}
          >
            <thead>
              <tr>
                {["Magnet", "Downloaded", "Source", "Medium", "Campaign"].map((h) => (
                  <th key={h} style={thStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {downloads.length === 0 && (
                <tr>
                  <td colSpan={5} style={emptyCellStyle}>
                    No lead-magnet downloads recorded for this client.
                  </td>
                </tr>
              )}
              {downloads.map((d) => {
                const title =
                  magnetTitles.get(d.leadMagnetId) ?? d.leadMagnetSlug ?? "—";
                return (
                  <tr key={d.id}>
                    <td style={tdStyle}>
                      <Link
                        href={`/admin/lead-magnets/${d.leadMagnetId}`}
                        style={{
                          color: "var(--charcoal)",
                          textDecoration: "none",
                          fontWeight: 500,
                        }}
                      >
                        {title}
                      </Link>
                    </td>
                    <td style={tdStyle}>
                      {formatDateTime(d.createdAt) ?? "—"}
                    </td>
                    <td style={tdStyle}>{d.firstTouchSource ?? "—"}</td>
                    <td style={tdStyle}>{d.firstTouchMedium ?? "—"}</td>
                    <td style={tdStyle}>{d.firstTouchCampaign ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Sequence enrollments */}
        <div
          style={{
            border: "0.5px solid var(--border)",
            background: "var(--white)",
          }}
        >
          <p
            style={{
              padding: "0.85rem 1rem",
              fontSize: "0.62rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--charcoal-muted)",
              borderBottom: "0.5px solid var(--border-strong)",
              margin: 0,
            }}
          >
            Sequence enrollments
          </p>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.85rem",
            }}
          >
            <thead>
              <tr>
                {["Sequence", "Status", "Step", "Next run", "Project"].map((h) => (
                  <th key={h} style={thStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {enrollments.length === 0 && (
                <tr>
                  <td colSpan={5} style={emptyCellStyle}>
                    No active or past sequence enrollments.
                  </td>
                </tr>
              )}
              {enrollments.map((e) => {
                const name =
                  sequenceNames.get(e.sequenceId) ??
                  `${e.sequenceId.slice(0, 8)}…`;
                return (
                  <tr key={e.id}>
                    <td style={tdStyle}>
                      <Link
                        href={`/admin/sequences/${e.sequenceId}`}
                        style={{
                          color: "var(--charcoal)",
                          textDecoration: "none",
                          fontWeight: 500,
                        }}
                      >
                        {name}
                      </Link>
                      {e.lastError && (
                        <div
                          style={{
                            fontSize: "0.7rem",
                            color: "var(--charcoal-muted)",
                            marginTop: "0.2rem",
                          }}
                        >
                          {e.lastError}
                        </div>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <Badge
                        label={
                          e.status.charAt(0) +
                          e.status.slice(1).toLowerCase()
                        }
                        variant={e.status}
                      />
                    </td>
                    <td style={tdStyle}>{e.currentStep + 1}</td>
                    <td style={tdStyle}>{formatDateTime(e.nextRunAt) ?? "—"}</td>
                    <td style={tdStyle}>
                      {e.projectId ? (
                        <Link
                          href={`/admin/projects/${e.projectId}`}
                          style={{
                            fontSize: "0.78rem",
                            color: "var(--olive)",
                            textDecoration: "none",
                          }}
                        >
                          View →
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Invoice ledger */}
      <section style={{ marginBottom: "1.5rem" }}>
        <SectionHeader
          title="Invoice ledger"
          subtitle={`${invoices.length} invoice${invoices.length === 1 ? "" : "s"} · ${fmtUsd(lifetimeValueCents)} lifetime paid`}
        />
        <div style={{ border: "0.5px solid var(--border)", background: "var(--white)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr>
                {["Type", "Amount", "Status", "Due", "Paid", "Refund / dispute", "Project"].map((h) => (
                  <th key={h} style={thStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={7} style={emptyCellStyle}>
                    No invoices on file.
                  </td>
                </tr>
              )}
              {invoices.map((inv) => {
                const refundStr = inv.refundCents && inv.refundCents > 0
                  ? `Refunded ${fmtUsd(inv.refundCents)}`
                  : null;
                const disputeStr = inv.disputeStatus && inv.disputeStatus !== "NONE"
                  ? `Dispute: ${statusLabel(inv.disputeStatus as InvoiceStatus)}`
                  : null;
                const incident = [refundStr, disputeStr].filter(Boolean).join(" · ") || "—";
                return (
                  <tr key={inv.id}>
                    <td style={tdStyle}>{inv.type}</td>
                    <td style={tdStyle}>{fmtUsd(inv.amountCents)}</td>
                    <td style={tdStyle}>
                      <Badge label={statusLabel(inv.status)} variant={inv.status} />
                    </td>
                    <td style={tdStyle}>{formatDisplayDate(inv.dueDate) ?? "—"}</td>
                    <td style={tdStyle}>{formatDisplayDate(inv.paidAt) ?? "—"}</td>
                    <td style={tdStyle}>{incident}</td>
                    <td style={tdStyle}>
                      <Link
                        href={`/admin/projects/${inv.projectId}`}
                        style={{
                          fontSize: "0.78rem",
                          color: "var(--olive)",
                          textDecoration: "none",
                        }}
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Communication summary */}
      <section style={{ marginBottom: "1.5rem" }}>
        <SectionHeader title="Communication summary" />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "1rem",
          }}
        >
          <Stat label="Total messages" value={totalMessages.toString()} />
          <Stat
            label="Last contacted"
            value={lastContactedAt > 0 ? formatDateTime(new Date(lastContactedAt)) ?? "—" : "—"}
          />
          <Stat
            label="Last responded"
            value={lastRespondedAt > 0 ? formatDateTime(new Date(lastRespondedAt)) ?? "—" : "—"}
          />
        </div>
      </section>
    </div>
  );
}

function cadenceLabel(c: RecurringCadence): string {
  if (c === "ANNUAL") return "Annual";
  if (c === "SEMI_ANNUAL") return "Semi-annual";
  return "None";
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        style={{
          fontSize: "0.6rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--charcoal-muted)",
          marginBottom: "0.3rem",
        }}
      >
        {label}
      </p>
      <p style={{ fontSize: "0.85rem", color: "var(--charcoal)" }}>{value}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "1rem 1.1rem",
        border: "0.5px solid var(--border)",
        background: "var(--white)",
      }}
    >
      <p
        style={{
          fontSize: "0.6rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--charcoal-muted)",
          marginBottom: "0.4rem",
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "1.5rem",
          fontWeight: 300,
          color: "var(--charcoal)",
        }}
      >
        {value}
      </p>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        marginBottom: "0.75rem",
      }}
    >
      <h3
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "1.3rem",
          fontWeight: 300,
          color: "var(--charcoal)",
        }}
      >
        {title}
      </h3>
      {subtitle && (
        <span
          style={{
            fontSize: "0.7rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--charcoal-muted)",
          }}
        >
          {subtitle}
        </span>
      )}
    </div>
  );
}

function Badge({ label, variant }: { label: string; variant?: string }) {
  const style = variant ? STATUS_BADGE[variant] : undefined;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.2rem 0.6rem",
        fontSize: "0.62rem",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        background: style?.background ?? "rgba(107,120,69,0.08)",
        color: style?.color ?? "var(--charcoal)",
      }}
    >
      {label}
    </span>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "0.7rem 1rem",
  fontSize: "0.62rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--charcoal-muted)",
  borderBottom: "0.5px solid var(--border-strong)",
  fontWeight: 400,
};

const tdStyle: React.CSSProperties = {
  padding: "0.85rem 1rem",
  borderBottom: "0.5px solid var(--border)",
  color: "var(--charcoal-light)",
  verticalAlign: "middle",
};

const emptyCellStyle: React.CSSProperties = {
  padding: "2rem",
  textAlign: "center",
  color: "var(--charcoal-muted)",
  fontSize: "0.85rem",
};
