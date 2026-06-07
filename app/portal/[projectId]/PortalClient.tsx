"use client";

// app/portal/[projectId]/PortalClient.tsx
// Client-facing project workspace. Read-only / client-action-only.
//
// Visual language mirrors /investment: editorial off-white, Cormorant
// Garamond display, Jost body, 0.5px borders, no border-radius.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "@/components/ui/Toaster";
import { sendPortalMessage } from "./actions";
import type {
  PortalProject,
  PortalClientShape,
  PortalContract,
  PortalInvoice,
  PortalQuestionnaire,
  PortalTimelineEntry,
  PortalGallery,
  PortalMessage,
  PortalJournal,
  PortalWelcomePacket,
} from "./page";

// ─── Tokens ──────────────────────────────────────────────────────────────────

const EYEBROW: React.CSSProperties = {
  fontSize: "0.65rem",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "var(--olive)",
  fontWeight: 400,
  margin: 0,
};

const CARD: React.CSSProperties = {
  background: "var(--white)",
  border: "0.5px solid var(--border)",
  padding: "1.5rem",
};

const SECTION_HEAD: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 300,
  fontSize: "1.8rem",
  margin: "0 0 1.25rem 0",
  letterSpacing: "0.01em",
  color: "var(--charcoal)",
};

const BTN_PRIMARY: React.CSSProperties = {
  display: "inline-block",
  padding: "0.7rem 1.4rem",
  border: "0.5px solid var(--olive)",
  background: "var(--olive)",
  color: "var(--white)",
  fontFamily: "'Jost', sans-serif",
  fontSize: "0.72rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  cursor: "pointer",
  borderRadius: 0,
  textDecoration: "none",
};

const BTN_GHOST: React.CSSProperties = {
  display: "inline-block",
  padding: "0.7rem 1.4rem",
  border: "0.5px solid var(--border-strong)",
  background: "transparent",
  color: "var(--charcoal)",
  fontFamily: "'Jost', sans-serif",
  fontSize: "0.72rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  cursor: "pointer",
  borderRadius: 0,
  textDecoration: "none",
};

const PILL_BASE: React.CSSProperties = {
  display: "inline-block",
  padding: "0.25rem 0.7rem",
  fontSize: "0.6rem",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  border: "0.5px solid var(--border-strong)",
  background: "transparent",
  color: "var(--charcoal-light)",
};

// ─── Tabs ────────────────────────────────────────────────────────────────────

type TabId =
  | "overview"
  | "documents"
  | "invoices"
  | "timeline"
  | "gallery"
  | "inspiration"
  | "contact";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "documents", label: "Documents" },
  { id: "invoices", label: "Invoices" },
  { id: "timeline", label: "Timeline" },
  { id: "gallery", label: "Gallery" },
  { id: "inspiration", label: "Inspiration" },
  { id: "contact", label: "Contact" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", opts ?? { month: "long", day: "numeric", year: "numeric" });
}

function fmtTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function fmtCurrencyCents(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const diff = d.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ─── Component ───────────────────────────────────────────────────────────────

interface PortalClientProps {
  project: PortalProject;
  client: PortalClientShape;
  contract: PortalContract | null;
  invoices: PortalInvoice[];
  questionnaires: PortalQuestionnaire[];
  timeline: PortalTimelineEntry[];
  gallery: PortalGallery | null;
  journal: PortalJournal | null;
  messages: PortalMessage[];
  welcomePacket: PortalWelcomePacket | null;
}

export function PortalClient({
  project,
  client,
  contract,
  invoices,
  questionnaires,
  timeline,
  gallery,
  journal,
  messages,
  welcomePacket,
}: PortalClientProps) {
  const [tab, setTab] = useState<TabId>("overview");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--white)",
        paddingTop: "100px",
        paddingBottom: "5rem",
      }}
    >
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "0 1.5rem",
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header style={{ marginBottom: "2.5rem" }}>
          <p style={EYEBROW}>Your Portal</p>
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontWeight: 300,
              fontSize: "clamp(2rem, 5vw, 3rem)",
              letterSpacing: "0.01em",
              color: "var(--charcoal)",
              margin: "0.5rem 0 0.25rem 0",
              lineHeight: 1.1,
            }}
          >
            <em style={{ fontStyle: "italic" }}>Welcome,</em> {client.firstName || "friend"}
          </h1>
          <p
            style={{
              fontFamily: "'Jost', sans-serif",
              fontSize: "0.85rem",
              color: "var(--charcoal-muted)",
              margin: 0,
              letterSpacing: "0.02em",
            }}
          >
            {project.title} · {project.sessionType}
          </p>
        </header>

        {/* ── Tabs: select on mobile, row on desktop ─────────────────────── */}
        <div style={{ marginBottom: "2rem" }}>
          {/* Mobile select */}
          <div style={{ display: "block" }} className="portal-tabs-mobile">
            <select
              value={tab}
              onChange={(e) => setTab(e.target.value as TabId)}
              style={{
                width: "100%",
                padding: "0.85rem 1rem",
                fontFamily: "'Jost', sans-serif",
                fontSize: "0.85rem",
                letterSpacing: "0.04em",
                background: "var(--white)",
                border: "0.5px solid var(--border-strong)",
                color: "var(--charcoal)",
                borderRadius: 0,
                appearance: "none",
              }}
            >
              {TABS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Desktop row */}
          <div
            className="portal-tabs-desktop"
            style={{
              display: "none",
              borderBottom: "0.5px solid var(--border)",
            }}
          >
            {TABS.map((t) => {
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "0.75rem 1.25rem 1rem",
                    fontFamily: "'Jost', sans-serif",
                    fontSize: "0.7rem",
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: active ? "var(--charcoal)" : "var(--charcoal-muted)",
                    borderBottom: active ? "1px solid var(--olive)" : "1px solid transparent",
                    marginBottom: "-0.5px",
                    transition: "color 0.2s, border-color 0.2s",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Tab body ───────────────────────────────────────────────────── */}
        <main>
          {tab === "overview" && (
            <OverviewTab
              project={project}
              contract={contract}
              invoices={invoices}
              questionnaires={questionnaires}
              gallery={gallery}
            />
          )}
          {tab === "documents" && (
            <DocumentsTab
              projectId={project.id}
              contract={contract}
              questionnaires={questionnaires}
              welcomePacket={welcomePacket}
            />
          )}
          {tab === "invoices" && <InvoicesTab invoices={invoices} />}
          {tab === "timeline" && <TimelineTab timeline={timeline} />}
          {tab === "gallery" && <GalleryTab gallery={gallery} />}
          {tab === "inspiration" && <InspirationTab journal={journal} />}
          {tab === "contact" && (
            <ContactTab projectId={project.id} messages={messages} />
          )}
        </main>
      </div>

      {/* Mobile / desktop swap via media query — must live in the document
          since this is a "use client" file and we don't have a CSS module. */}
      <style>{`
        @media (min-width: 768px) {
          .portal-tabs-mobile { display: none !important; }
          .portal-tabs-desktop { display: flex !important; flex-wrap: wrap; gap: 0.25rem; }
        }
      `}</style>
    </div>
  );
}

// ─── Overview ────────────────────────────────────────────────────────────────

function OverviewTab({
  project,
  contract,
  invoices,
  questionnaires,
  gallery,
}: {
  project: PortalProject;
  contract: PortalContract | null;
  invoices: PortalInvoice[];
  questionnaires: PortalQuestionnaire[];
  gallery: PortalGallery | null;
}) {
  const nextBestAction = useMemo(() => {
    // Order matters — first match wins.
    if (contract && contract.status === "SENT" && contract.signingToken) {
      return {
        title: "Sign your contract",
        body: "Your contract is ready for your signature.",
        ctaLabel: "Review & Sign",
        href: `/sign-contract/${contract.id}?t=${contract.signingToken}`,
      };
    }
    const unpaidDeposit = invoices.find(
      (i) => i.type === "DEPOSIT" && i.status !== "PAID" && i.status !== "VOID"
    );
    if (unpaidDeposit && unpaidDeposit.stripePaymentLinkUrl) {
      return {
        title: "Pay your deposit",
        body: `Your deposit of ${fmtCurrencyCents(unpaidDeposit.amountCents)} secures your date.`,
        ctaLabel: "Pay Deposit",
        href: unpaidDeposit.stripePaymentLinkUrl,
        external: true,
      };
    }
    const pendingQ = questionnaires.find((q) => q.status === "PENDING");
    if (pendingQ) {
      return {
        title: "Complete your questionnaire",
        body: "A few details from you help me plan the perfect session.",
        ctaLabel: "Open Questionnaire",
        href: `/questionnaire/${pendingQ.id}`,
      };
    }
    const unpaidBalance = invoices.find(
      (i) => (i.type === "BALANCE" || i.type === "FULL") && i.status !== "PAID" && i.status !== "VOID"
    );
    if (unpaidBalance && unpaidBalance.stripePaymentLinkUrl) {
      return {
        title: "Final balance is ready",
        body: `Your final balance of ${fmtCurrencyCents(unpaidBalance.amountCents)} is due.`,
        ctaLabel: "Pay Balance",
        href: unpaidBalance.stripePaymentLinkUrl,
        external: true,
      };
    }
    if (gallery && gallery.totalCount > 0) {
      return {
        title: "Your gallery is ready",
        body: `${gallery.totalCount} photo${gallery.totalCount === 1 ? "" : "s"} are waiting for you.`,
        ctaLabel: "View Gallery",
        href: `/gallery/${gallery.eventId}`,
      };
    }
    return null;
  }, [contract, invoices, questionnaires, gallery]);

  const countdown = useMemo(() => daysUntil(project.shootDate), [project.shootDate]);

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      {/* Next best action */}
      {nextBestAction ? (
        <div
          style={{
            ...CARD,
            background: "var(--olive-dim)",
            borderColor: "var(--olive)",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <div>
            <p style={EYEBROW}>Next step</p>
            <h2 style={{ ...SECTION_HEAD, margin: "0.5rem 0 0.5rem 0" }}>
              {nextBestAction.title}
            </h2>
            <p
              style={{
                fontFamily: "'Jost', sans-serif",
                fontSize: "0.95rem",
                color: "var(--charcoal-light)",
                margin: 0,
                lineHeight: 1.6,
              }}
            >
              {nextBestAction.body}
            </p>
          </div>
          <div>
            {nextBestAction.external ? (
              <a
                href={nextBestAction.href}
                target="_blank"
                rel="noreferrer"
                style={BTN_PRIMARY}
              >
                {nextBestAction.ctaLabel}
              </a>
            ) : (
              <Link href={nextBestAction.href} style={BTN_PRIMARY}>
                {nextBestAction.ctaLabel}
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div style={CARD}>
          <p style={EYEBROW}>Where we stand</p>
          <h2 style={{ ...SECTION_HEAD, margin: "0.5rem 0 0.5rem 0" }}>
            You&apos;re all set.
          </h2>
          <p
            style={{
              fontFamily: "'Jost', sans-serif",
              fontSize: "0.9rem",
              color: "var(--charcoal-light)",
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            Nothing on your plate right now — I&apos;ll reach out when there&apos;s
            something new to share.
          </p>
        </div>
      )}

      {/* Milestones strip */}
      <div style={CARD}>
        <p style={EYEBROW}>Your journey</p>
        <div style={{ marginTop: "1rem" }}>
          <MilestonesStrip project={project} contract={contract} invoices={invoices} gallery={gallery} />
        </div>
      </div>

      {/* Shoot countdown + package summary */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "1.5rem",
        }}
      >
        {project.shootDate && (
          <div style={CARD}>
            <p style={EYEBROW}>Shoot date</p>
            <p
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontWeight: 300,
                fontSize: "1.6rem",
                margin: "0.4rem 0 0.25rem 0",
                color: "var(--charcoal)",
              }}
            >
              {fmtDate(project.shootDate)}
            </p>
            {project.shootLocationLabel && (
              <p
                style={{
                  fontFamily: "'Jost', sans-serif",
                  fontSize: "0.8rem",
                  color: "var(--charcoal-muted)",
                  margin: 0,
                  letterSpacing: "0.02em",
                }}
              >
                {project.shootLocationLabel}
              </p>
            )}
            {countdown !== null && countdown > 0 && (
              <p
                style={{
                  fontFamily: "'Jost', sans-serif",
                  fontSize: "0.75rem",
                  color: "var(--olive)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  marginTop: "0.6rem",
                  marginBottom: 0,
                }}
              >
                {countdown} day{countdown === 1 ? "" : "s"} to go
              </p>
            )}
            {countdown !== null && countdown <= 0 && project.deliveredAt === null && (
              <p
                style={{
                  fontFamily: "'Jost', sans-serif",
                  fontSize: "0.75rem",
                  color: "var(--olive)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  marginTop: "0.6rem",
                  marginBottom: 0,
                }}
              >
                In editing
              </p>
            )}
          </div>
        )}
        {(project.packageName || project.packagePriceUsd) && (
          <div style={CARD}>
            <p style={EYEBROW}>Your package</p>
            <p
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontWeight: 300,
                fontSize: "1.6rem",
                margin: "0.4rem 0 0.25rem 0",
                color: "var(--charcoal)",
              }}
            >
              {project.packageName ?? "Custom session"}
            </p>
            {typeof project.packagePriceUsd === "number" && (
              <p
                style={{
                  fontFamily: "'Jost', sans-serif",
                  fontSize: "0.85rem",
                  color: "var(--charcoal-muted)",
                  margin: 0,
                  letterSpacing: "0.02em",
                }}
              >
                Investment: ${project.packagePriceUsd.toLocaleString()}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MilestonesStrip({
  project,
  contract,
  invoices,
  gallery,
}: {
  project: PortalProject;
  contract: PortalContract | null;
  invoices: PortalInvoice[];
  gallery: PortalGallery | null;
}) {
  const depositPaid = invoices.some((i) => i.type === "DEPOSIT" && i.status === "PAID") || !!project.depositPaidAt;
  const contractSigned = contract?.status === "SIGNED" || !!project.contractSignedAt;
  const shootDone = useMemo(
    () => (project.shootDate ? new Date(project.shootDate).getTime() < Date.now() : false),
    [project.shootDate]
  );
  const galleryReady = !!gallery && gallery.totalCount > 0;
  const delivered = !!project.deliveredAt;

  const steps: { label: string; done: boolean }[] = [
    { label: "Inquiry", done: true },
    { label: "Contract", done: contractSigned },
    { label: "Deposit", done: depositPaid },
    { label: "Shoot", done: shootDone },
    { label: "Gallery", done: galleryReady },
    { label: "Delivered", done: delivered },
  ];

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "0.5rem",
        rowGap: "0.75rem",
      }}
    >
      {steps.map((s, i) => (
        <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: s.done ? "var(--olive)" : "transparent",
                border: `0.5px solid ${s.done ? "var(--olive)" : "var(--border-strong)"}`,
                display: "inline-block",
              }}
            />
            <span
              style={{
                fontFamily: "'Jost', sans-serif",
                fontSize: "0.7rem",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: s.done ? "var(--charcoal)" : "var(--charcoal-muted)",
              }}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <span
              style={{
                width: "20px",
                height: "0.5px",
                background: "var(--border)",
                display: "inline-block",
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Documents ───────────────────────────────────────────────────────────────

function DocumentsTab({
  contract,
  questionnaires,
  welcomePacket,
}: {
  projectId: string;
  contract: PortalContract | null;
  questionnaires: PortalQuestionnaire[];
  welcomePacket: PortalWelcomePacket | null;
}) {
  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <h2 style={SECTION_HEAD}>Documents</h2>

      {/* Contract */}
      <div style={CARD}>
        <p style={EYEBROW}>Contract</p>
        {!contract ? (
          <p style={mutedP}>Your contract will appear here once it&apos;s ready.</p>
        ) : contract.status === "SIGNED" ? (
          <>
            <p style={bodyP}>
              Signed on <strong>{fmtDate(contract.signedAt)}</strong>.
            </p>
            <Link href={`/sign-contract/${contract.id}`} style={BTN_GHOST}>
              View signed copy
            </Link>
          </>
        ) : contract.status === "SENT" && contract.signingToken ? (
          <>
            <p style={bodyP}>Your contract is waiting for your signature.</p>
            <Link
              href={`/sign-contract/${contract.id}?t=${contract.signingToken}`}
              style={BTN_PRIMARY}
            >
              Review &amp; Sign
            </Link>
          </>
        ) : contract.status === "VOIDED" ? (
          <p style={mutedP}>This contract has been voided.</p>
        ) : (
          <p style={mutedP}>Your contract is being prepared.</p>
        )}
      </div>

      {/* Welcome packet */}
      <div style={CARD}>
        <p style={EYEBROW}>Welcome packet</p>
        {welcomePacket ? (
          <>
            <p style={bodyP}>
              Your welcome packet outlines what to expect from our session.
              {welcomePacket.generatedAt && (
                <>
                  {" "}
                  <span style={{ color: "var(--charcoal-muted)" }}>
                    Prepared on {fmtDate(welcomePacket.generatedAt)}.
                  </span>
                </>
              )}
            </p>
            <a href={welcomePacket.url} target="_blank" rel="noreferrer" style={BTN_GHOST}>
              Open packet
            </a>
          </>
        ) : (
          <p style={mutedP}>
            Your welcome packet will be available here closer to your shoot date.
          </p>
        )}
      </div>

      {/* Questionnaire */}
      <div style={CARD}>
        <p style={EYEBROW}>Questionnaire</p>
        {questionnaires.length === 0 ? (
          <p style={mutedP}>
            A short questionnaire will appear here once your booking is confirmed.
          </p>
        ) : (
          questionnaires.map((q) => (
            <div
              key={q.id}
              style={{
                paddingTop: "0.75rem",
                marginTop: "0.75rem",
                borderTop: questionnaires[0].id === q.id ? "none" : "0.5px solid var(--border)",
              }}
            >
              {q.status === "COMPLETED" ? (
                <p style={bodyP}>
                  Completed on <strong>{fmtDate(q.completedAt)}</strong>. Thank you.
                </p>
              ) : (
                <>
                  <p style={bodyP}>
                    Please answer a few questions about your session — it helps
                    me prepare.
                  </p>
                  <Link href={`/questionnaire/${q.id}`} style={BTN_PRIMARY}>
                    Open Questionnaire
                  </Link>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Invoices ────────────────────────────────────────────────────────────────

function InvoicesTab({ invoices }: { invoices: PortalInvoice[] }) {
  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <h2 style={SECTION_HEAD}>Invoices</h2>
      {invoices.length === 0 ? (
        <div style={CARD}>
          <p style={mutedP}>You have no invoices yet.</p>
        </div>
      ) : (
        invoices.map((inv) => {
          const paid = inv.status === "PAID";
          const voided = inv.status === "VOID";
          const overdue = inv.status === "OVERDUE";
          const pillBg = paid
            ? "var(--olive-dim)"
            : overdue
              ? "#FBE4D6"
              : voided
                ? "transparent"
                : "transparent";
          const pillColor = paid
            ? "var(--olive)"
            : overdue
              ? "#A14D2D"
              : "var(--charcoal-light)";
          const pillBorder = paid
            ? "var(--olive)"
            : overdue
              ? "#A14D2D"
              : "var(--border-strong)";
          return (
            <div key={inv.id} style={CARD}>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: "1rem",
                  flexWrap: "wrap",
                  marginBottom: "0.75rem",
                }}
              >
                <div>
                  <p style={EYEBROW}>{inv.type}</p>
                  <p
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontWeight: 300,
                      fontSize: "1.8rem",
                      margin: "0.3rem 0 0 0",
                      color: "var(--charcoal)",
                    }}
                  >
                    {fmtCurrencyCents(inv.amountCents)}
                  </p>
                </div>
                <span
                  style={{
                    ...PILL_BASE,
                    background: pillBg,
                    color: pillColor,
                    borderColor: pillBorder,
                  }}
                >
                  {inv.status}
                </span>
              </div>
              <p
                style={{
                  fontFamily: "'Jost', sans-serif",
                  fontSize: "0.8rem",
                  color: "var(--charcoal-muted)",
                  margin: "0 0 1rem 0",
                  letterSpacing: "0.02em",
                }}
              >
                {paid && inv.paidAt
                  ? `Paid on ${fmtDate(inv.paidAt)}`
                  : inv.dueDate
                    ? `Due ${fmtDate(inv.dueDate)}`
                    : "Pending"}
              </p>
              {!paid && !voided && inv.stripePaymentLinkUrl && (
                <a
                  href={inv.stripePaymentLinkUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={BTN_PRIMARY}
                >
                  Pay now
                </a>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── Timeline ────────────────────────────────────────────────────────────────

function TimelineTab({ timeline }: { timeline: PortalTimelineEntry[] }) {
  if (timeline.length === 0) {
    return (
      <div style={{ display: "grid", gap: "1.5rem" }}>
        <h2 style={SECTION_HEAD}>Day-of Timeline</h2>
        <div style={CARD}>
          <p style={mutedP}>
            Your day-of timeline will appear here once Korrin finalises it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <h2 style={SECTION_HEAD}>Day-of Timeline</h2>
      <div style={CARD}>
        <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {timeline.map((entry, idx) => (
            <li
              key={entry.id}
              style={{
                display: "flex",
                gap: "1.25rem",
                padding: "1rem 0",
                borderTop: idx === 0 ? "none" : "0.5px solid var(--border)",
              }}
            >
              <div style={{ minWidth: "90px" }}>
                <p
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: "1.1rem",
                    fontWeight: 300,
                    margin: 0,
                    color: "var(--olive)",
                  }}
                >
                  {fmtTime(entry.startTime)}
                </p>
                {entry.endTime && (
                  <p
                    style={{
                      fontFamily: "'Jost', sans-serif",
                      fontSize: "0.7rem",
                      color: "var(--charcoal-muted)",
                      margin: 0,
                      letterSpacing: "0.04em",
                    }}
                  >
                    – {fmtTime(entry.endTime)}
                  </p>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <p
                  style={{
                    fontFamily: "'Jost', sans-serif",
                    fontSize: "0.95rem",
                    fontWeight: 500,
                    margin: 0,
                    color: "var(--charcoal)",
                  }}
                >
                  {entry.title}
                </p>
                {entry.location && (
                  <p
                    style={{
                      fontFamily: "'Jost', sans-serif",
                      fontSize: "0.8rem",
                      color: "var(--charcoal-muted)",
                      margin: "0.2rem 0 0 0",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {entry.location}
                  </p>
                )}
                {entry.description && (
                  <p
                    style={{
                      fontFamily: "'Jost', sans-serif",
                      fontSize: "0.85rem",
                      color: "var(--charcoal-light)",
                      margin: "0.4rem 0 0 0",
                      lineHeight: 1.55,
                    }}
                  >
                    {entry.description}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// ─── Gallery ─────────────────────────────────────────────────────────────────

function GalleryTab({ gallery }: { gallery: PortalGallery | null }) {
  if (!gallery || gallery.totalCount === 0) {
    return (
      <div style={{ display: "grid", gap: "1.5rem" }}>
        <h2 style={SECTION_HEAD}>Gallery</h2>
        <div style={CARD}>
          <p style={mutedP}>
            Your gallery will appear here once your photos are delivered.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <h2 style={SECTION_HEAD}>{gallery.eventTitle}</h2>
      <div style={CARD}>
        <p
          style={{
            fontFamily: "'Jost', sans-serif",
            fontSize: "0.85rem",
            color: "var(--charcoal-light)",
            margin: "0 0 1.5rem 0",
            lineHeight: 1.6,
          }}
        >
          A preview of your {gallery.totalCount} photo
          {gallery.totalCount === 1 ? "" : "s"}. Open the full gallery to favourite,
          download, and share.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: "0.5rem",
            marginBottom: "1.5rem",
          }}
        >
          {gallery.photos.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={p.id}
              src={p.thumbnailSrc}
              alt={p.label ?? ""}
              onContextMenu={(e) => e.preventDefault()}
              draggable={false}
              style={{
                width: "100%",
                aspectRatio: "1 / 1",
                objectFit: "cover",
                display: "block",
              }}
            />
          ))}
        </div>
        <Link href={`/gallery/${gallery.eventId}`} style={BTN_PRIMARY}>
          View Full Gallery
        </Link>
      </div>
    </div>
  );
}

// ─── Inspiration ─────────────────────────────────────────────────────────────

function InspirationTab({ journal: _journal }: { journal: PortalJournal | null }) {
  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <h2 style={SECTION_HEAD}>Inspiration</h2>
      <div style={CARD}>
        <p style={mutedP}>Your journal post will appear here after delivery.</p>
      </div>
    </div>
  );
}

// ─── Contact ─────────────────────────────────────────────────────────────────

function ContactTab({
  projectId,
  messages,
}: {
  projectId: string;
  messages: PortalMessage[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  // Show OUTBOUND (from Korrin) + the client's own INBOUND messages. We
  // already filtered server-side; render newest-first for readability.
  const visible = useMemo(() => {
    return [...messages].sort((a, b) => {
      const at = a.sentAt ?? "";
      const bt = b.sentAt ?? "";
      return bt.localeCompare(at);
    });
  }, [messages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) {
      toast("Please write a message first.");
      return;
    }
    startTransition(async () => {
      const res = await sendPortalMessage(projectId, trimmed);
      if (res.success) {
        toast("Message sent.");
        setBody("");
        router.refresh();
      } else {
        toast(res.error ?? "Failed to send message.");
      }
    });
  }

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <h2 style={SECTION_HEAD}>Contact</h2>

      <form onSubmit={handleSubmit} style={CARD}>
        <p style={EYEBROW}>Send a message</p>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write to Korrin…"
          rows={5}
          disabled={isPending}
          style={{
            width: "100%",
            marginTop: "0.75rem",
            padding: "0.85rem 1rem",
            fontFamily: "'Jost', sans-serif",
            fontSize: "0.9rem",
            background: "var(--white)",
            border: "0.5px solid var(--border-strong)",
            color: "var(--charcoal)",
            borderRadius: 0,
            resize: "vertical",
            lineHeight: 1.6,
          }}
        />
        <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            disabled={isPending || !body.trim()}
            style={{
              ...BTN_PRIMARY,
              opacity: isPending || !body.trim() ? 0.5 : 1,
              cursor: isPending || !body.trim() ? "not-allowed" : "pointer",
            }}
          >
            {isPending ? "Sending…" : "Send"}
          </button>
        </div>
      </form>

      <div style={CARD}>
        <p style={EYEBROW}>Conversation</p>
        {visible.length === 0 ? (
          <p style={{ ...mutedP, marginTop: "1rem" }}>
            No messages yet — say hello above.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: "1rem 0 0 0" }}>
            {visible.map((m, idx) => (
              <li
                key={m.id}
                style={{
                  padding: "1rem 0",
                  borderTop: idx === 0 ? "none" : "0.5px solid var(--border)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: "0.75rem",
                    marginBottom: "0.4rem",
                  }}
                >
                  <span
                    style={{
                      ...PILL_BASE,
                      background:
                        m.direction === "OUTBOUND" ? "var(--olive-dim)" : "transparent",
                      color:
                        m.direction === "OUTBOUND" ? "var(--olive)" : "var(--charcoal-light)",
                      borderColor:
                        m.direction === "OUTBOUND" ? "var(--olive)" : "var(--border-strong)",
                    }}
                  >
                    {m.direction === "OUTBOUND" ? "From Korrin" : "From you"}
                  </span>
                  <span
                    style={{
                      fontFamily: "'Jost', sans-serif",
                      fontSize: "0.7rem",
                      color: "var(--charcoal-muted)",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {fmtDate(m.sentAt, { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
                {m.subject && (
                  <p
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontWeight: 300,
                      fontSize: "1.1rem",
                      margin: "0 0 0.4rem 0",
                      color: "var(--charcoal)",
                    }}
                  >
                    {m.subject}
                  </p>
                )}
                <p
                  style={{
                    fontFamily: "'Jost', sans-serif",
                    fontSize: "0.9rem",
                    color: "var(--charcoal-light)",
                    margin: 0,
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {m.body}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Inline shared paragraph styles ──────────────────────────────────────────

const bodyP: React.CSSProperties = {
  fontFamily: "'Jost', sans-serif",
  fontSize: "0.9rem",
  color: "var(--charcoal-light)",
  margin: "0.75rem 0 1rem 0",
  lineHeight: 1.6,
};

const mutedP: React.CSSProperties = {
  fontFamily: "'Jost', sans-serif",
  fontSize: "0.9rem",
  color: "var(--charcoal-muted)",
  margin: "0.75rem 0 0 0",
  lineHeight: 1.6,
};
