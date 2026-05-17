// app/day-of-room/[projectId]/page.tsx
//
// Phase 13.11 — Public, token-gated, read-only multi-vendor view of a
// wedding/event day. Vendors open `${origin}/day-of-room/${projectId}?t=${token}`
// without logging in — the projectId + `?t=<token>` together form the
// credential. Constant-time string compare on the token avoids leaking via
// response-time side channels. Mirrors the auth model used by
// `/welcome-packet/[projectId]` and `/sign-contract/[id]`.
//
// HARD RULE — do NOT serialize any of the following onto this page:
//   project.notes, offTheRecordNotes, leadScore, estimatedValue,
//   packagePriceUsd, discountApplied, contracts, invoices, messages,
//   followUpDate, lastContactedAt, statusHistory, COI fields, weather, etc.
//
// Whitelist what we hand to the renderer below. If a field isn't on the
// `RoomData` shape, it doesn't ship. `dynamic = "force-dynamic"` so vendors
// always see the latest timeline.

import { timingSafeEqual } from "crypto";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { adminDb } from "@/lib/firebase-admin";
import { listDayOfTimeline } from "@/lib/db/day-of-timeline";
import { listVendors, type VendorCategory, type VendorDoc } from "@/lib/db/vendors";
import { formatDisplayDate } from "@/lib/date";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Day-of room",
  robots: { index: false, follow: false, nocache: true },
};

type Props = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ t?: string }>;
};

// ─── Constant-time token compare ────────────────────────────────────────────

function tokensMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

// ─── Whitelisted shape handed to the renderer ───────────────────────────────

type RoomTimelineBlock = {
  id: string;
  order: number;
  title: string;
  startTime: string;
  durationMinutes: number;
  location: string | null;
  blockType: string;
  notes: string | null;
};

type RoomVendor = {
  id: string;
  name: string;
  category: VendorCategory;
  phone: string | null;
  email: string | null;
};

type RoomData = {
  projectTitle: string;
  shootDateDisplay: string | null;
  venue: string | null;
  client: {
    firstName: string;
    /** Optional partner first name — engagements / weddings often have two. */
    partnerFirstName: string | null;
    phone: string | null;
    email: string | null;
  };
  blocks: RoomTimelineBlock[];
  vendorsByCategory: { category: VendorCategory; vendors: RoomVendor[] }[];
};

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function DayOfRoomPage({ params, searchParams }: Props) {
  const { projectId } = await params;
  const { t: rawToken } = await searchParams;

  if (!projectId || !rawToken) notFound();

  // Read project. Bail early on 404 / disabled / token mismatch.
  const projectSnap = await adminDb.collection("projects").doc(projectId).get();
  if (!projectSnap.exists) notFound();
  const projectData = projectSnap.data() ?? {};

  const stored: string | undefined =
    typeof projectData.dayOfRoomToken === "string" ? projectData.dayOfRoomToken : undefined;
  const enabled = projectData.dayOfRoomEnabled === true;

  if (!stored || !enabled || !tokensMatch(stored, rawToken)) {
    notFound();
  }

  // ── Whitelisted project fields ─────────────────────────────────────────────
  const projectTitle: string =
    typeof projectData.title === "string" ? projectData.title : "Day-of";
  const shootDateDisplay = formatDisplayDate(projectData.shootDate);
  const venue: string | null =
    projectData.shootLocation && typeof projectData.shootLocation === "object"
      ? (projectData.shootLocation as { label?: unknown }).label != null
        ? String((projectData.shootLocation as { label?: unknown }).label)
        : null
      : null;

  // ── Client (limited to first names + phone + email) ────────────────────────
  const clientId: string = typeof projectData.clientId === "string" ? projectData.clientId : "";
  let client: RoomData["client"] = {
    firstName: "",
    partnerFirstName: null,
    phone: null,
    email: null,
  };
  if (clientId) {
    try {
      const clientSnap = await adminDb.collection("clients").doc(clientId).get();
      if (clientSnap.exists) {
        const c = clientSnap.data() ?? {};
        client = {
          firstName: typeof c.firstName === "string" ? c.firstName : "",
          partnerFirstName:
            typeof c.partnerFirstName === "string" && c.partnerFirstName.trim()
              ? c.partnerFirstName
              : null,
          phone: typeof c.phone === "string" && c.phone.trim() ? c.phone : null,
          email: typeof c.email === "string" && c.email.trim() ? c.email : null,
        };
      }
    } catch (err) {
      console.error("[day-of-room] client read failed", { projectId, err });
    }
  }

  // ── Day-of timeline (visible-to-client only) ───────────────────────────────
  let blocks: RoomTimelineBlock[] = [];
  try {
    const all = await listDayOfTimeline(projectId);
    blocks = all
      .filter((b) => !!b.visibleToClient)
      .map((b) => ({
        id: b.id,
        order: b.order,
        title: b.title,
        startTime: b.startTime,
        durationMinutes: b.durationMinutes,
        location: b.location ?? null,
        blockType: b.blockType,
        notes: b.notes ?? null,
      }));
  } catch (err) {
    console.error("[day-of-room] timeline read failed", { projectId, err });
  }

  // ── Vendors (from `dayOfRoomVendorIds` ∪ `linkedProjectIds` array-contains) ──
  const allowList: string[] = Array.isArray(projectData.dayOfRoomVendorIds)
    ? projectData.dayOfRoomVendorIds.filter((id: unknown): id is string => typeof id === "string")
    : [];

  const vendorsByCategory: RoomData["vendorsByCategory"] = [];
  try {
    const allVendors: VendorDoc[] = await listVendors();
    const matched = allVendors.filter((v) => {
      if (allowList.includes(v.id)) return true;
      const ids = (v as unknown as { linkedProjectIds?: unknown }).linkedProjectIds;
      return Array.isArray(ids) && ids.includes(projectId);
    });

    const groups = new Map<VendorCategory, RoomVendor[]>();
    for (const v of matched) {
      const cat: VendorCategory = v.category ?? "OTHER";
      const room: RoomVendor = {
        id: v.id,
        name: v.name ?? "",
        category: cat,
        phone: typeof v.phone === "string" && v.phone.trim() ? v.phone : null,
        email: typeof v.email === "string" && v.email.trim() ? v.email : null,
      };
      const bucket = groups.get(cat) ?? [];
      bucket.push(room);
      groups.set(cat, bucket);
    }
    // Stable category ordering.
    const ORDER: VendorCategory[] = [
      "VENUE",
      "PLANNER",
      "FLORIST",
      "HMUA",
      "VIDEOGRAPHER",
      "DJ",
      "OFFICIANT",
      "RENTALS",
      "CATERER",
      "BAKER",
      "STATIONERY",
      "OTHER",
    ];
    for (const cat of ORDER) {
      const list = groups.get(cat);
      if (list && list.length > 0) {
        vendorsByCategory.push({
          category: cat,
          vendors: list.sort((a, b) => a.name.localeCompare(b.name)),
        });
      }
    }
  } catch (err) {
    console.error("[day-of-room] vendor read failed", { projectId, err });
  }

  const data: RoomData = {
    projectTitle,
    shootDateDisplay,
    venue,
    client,
    blocks,
    vendorsByCategory,
  };

  return <DayOfRoomView data={data} />;
}

// ─── Renderer ───────────────────────────────────────────────────────────────

const VENDOR_CATEGORY_LABEL: Record<VendorCategory, string> = {
  VENUE: "Venue",
  PLANNER: "Planner",
  FLORIST: "Florist",
  HMUA: "Hair & Makeup",
  VIDEOGRAPHER: "Videographer",
  DJ: "DJ / Music",
  OFFICIANT: "Officiant",
  RENTALS: "Rentals",
  CATERER: "Caterer",
  BAKER: "Baker",
  STATIONERY: "Stationery",
  OTHER: "Other",
};

const SHELL: React.CSSProperties = {
  background: "var(--white)",
  color: "var(--charcoal)",
  fontFamily: "'Jost', sans-serif",
  fontWeight: 300,
  minHeight: "100vh",
  padding: "3rem 1.25rem 5rem",
};

const WRAP: React.CSSProperties = {
  maxWidth: 880,
  margin: "0 auto",
  display: "grid",
  gap: "2.25rem",
};

const EYEBROW: React.CSSProperties = {
  fontSize: "0.65rem",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "var(--olive)",
  margin: 0,
};

const H1: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 300,
  fontSize: "2.6rem",
  lineHeight: 1.1,
  margin: "0.25rem 0 0.5rem",
  letterSpacing: "0.01em",
};

const H2: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 300,
  fontSize: "1.75rem",
  margin: "0 0 1rem",
  letterSpacing: "0.01em",
};

const SUBTLE: React.CSSProperties = {
  color: "var(--charcoal-muted)",
  fontSize: "0.85rem",
  lineHeight: 1.55,
};

const CARD: React.CSSProperties = {
  background: "var(--white)",
  border: "0.5px solid var(--border)",
  padding: "1.5rem 1.5rem",
};

const SECTION: React.CSSProperties = {
  display: "grid",
  gap: "0.75rem",
};

const PILL: React.CSSProperties = {
  display: "inline-block",
  fontSize: "0.6rem",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--olive)",
  background: "var(--olive-dim)",
  border: "0.5px solid var(--olive)",
  padding: "0.2rem 0.6rem",
};

function escapeVCardText(input: string): string {
  // RFC 6350 §3.4 — escape backslashes, commas, semicolons and newlines.
  return input.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

function buildVCardDataUrl(v: RoomVendor): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${escapeVCardText(v.name)};;;;`,
    `FN:${escapeVCardText(v.name)}`,
    `ORG:${escapeVCardText(VENDOR_CATEGORY_LABEL[v.category])}`,
  ];
  if (v.phone) lines.push(`TEL;TYPE=CELL,VOICE:${escapeVCardText(v.phone)}`);
  if (v.email) lines.push(`EMAIL;TYPE=INTERNET:${escapeVCardText(v.email)}`);
  lines.push("END:VCARD");
  const body = lines.join("\r\n");
  return `data:text/vcard;charset=utf-8,${encodeURIComponent(body)}`;
}

function vCardFileName(name: string): string {
  const slug = name.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "vendor";
  return `${slug}.vcf`;
}

function fmtBlockTime(startTime: string): string {
  // `HH:mm` 24h → "h:mm a" 12h.
  const m = /^(\d{1,2}):(\d{2})$/.exec(startTime);
  if (!m) return startTime;
  const hh = parseInt(m[1], 10);
  const mm = m[2];
  const period = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${mm} ${period}`;
}

function fmtDuration(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function DayOfRoomView({ data }: { data: RoomData }) {
  const coupleLine =
    data.client.firstName && data.client.partnerFirstName
      ? `${data.client.firstName} & ${data.client.partnerFirstName}`
      : data.client.firstName || "Client";

  return (
    <div style={SHELL}>
      <div style={WRAP}>
        {/* Header */}
        <header>
          <p style={EYEBROW}>Day-of room</p>
          <h1 style={H1}>{data.projectTitle}</h1>
          <p style={SUBTLE}>
            {data.shootDateDisplay ?? "Date TBD"}
            {data.venue ? ` · ${data.venue}` : ""}
          </p>
        </header>

        {/* Couple / client contact card */}
        <section style={CARD}>
          <p style={EYEBROW}>Couple</p>
          <h2 style={{ ...H2, marginTop: "0.4rem", fontSize: "1.5rem" }}>{coupleLine}</h2>
          <div style={{ display: "grid", gap: "0.4rem", fontSize: "0.95rem" }}>
            {data.client.phone ? (
              <div>
                <span style={SUBTLE}>Phone </span>
                <a
                  href={`tel:${data.client.phone.replace(/[^\d+]/g, "")}`}
                  style={{ color: "var(--olive)", textDecoration: "none" }}
                >
                  {data.client.phone}
                </a>
              </div>
            ) : null}
            {data.client.email ? (
              <div>
                <span style={SUBTLE}>Email </span>
                <a
                  href={`mailto:${data.client.email}`}
                  style={{ color: "var(--olive)", textDecoration: "none" }}
                >
                  {data.client.email}
                </a>
              </div>
            ) : null}
            {!data.client.phone && !data.client.email ? (
              <p style={SUBTLE}>No contact info on file.</p>
            ) : null}
          </div>
        </section>

        {/* Day-of timeline */}
        <section style={SECTION}>
          <p style={EYEBROW}>Timeline</p>
          <h2 style={H2}>
            <em>Day-of</em> schedule
          </h2>
          {data.blocks.length === 0 ? (
            <div style={CARD}>
              <p style={SUBTLE}>No timeline blocks have been published yet.</p>
            </div>
          ) : (
            <ol
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "grid",
                gap: "0.6rem",
              }}
            >
              {data.blocks
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((b) => (
                  <li
                    key={b.id}
                    style={{
                      ...CARD,
                      display: "grid",
                      gridTemplateColumns: "minmax(80px, auto) 1fr",
                      gap: "1.25rem",
                      alignItems: "start",
                    }}
                  >
                    <div>
                      <p
                        style={{
                          fontFamily: "'Cormorant Garamond', serif",
                          fontSize: "1.4rem",
                          margin: 0,
                          fontWeight: 300,
                        }}
                      >
                        {fmtBlockTime(b.startTime)}
                      </p>
                      <p
                        style={{
                          ...SUBTLE,
                          fontSize: "0.7rem",
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          marginTop: "0.15rem",
                        }}
                      >
                        {fmtDuration(b.durationMinutes)}
                      </p>
                    </div>
                    <div>
                      <p
                        style={{
                          fontSize: "1.05rem",
                          margin: 0,
                          fontWeight: 400,
                        }}
                      >
                        {b.title}
                      </p>
                      {b.location ? (
                        <p style={{ ...SUBTLE, margin: "0.2rem 0 0" }}>{b.location}</p>
                      ) : null}
                      {b.notes ? (
                        <p style={{ ...SUBTLE, margin: "0.4rem 0 0", whiteSpace: "pre-wrap" }}>
                          {b.notes}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
            </ol>
          )}
        </section>

        {/* Vendors */}
        <section style={SECTION}>
          <p style={EYEBROW}>Vendors</p>
          <h2 style={H2}>The <em>team</em></h2>
          {data.vendorsByCategory.length === 0 ? (
            <div style={CARD}>
              <p style={SUBTLE}>No vendors have been added to this day.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "1.5rem" }}>
              {data.vendorsByCategory.map((group) => (
                <div key={group.category}>
                  <p
                    style={{
                      ...EYEBROW,
                      color: "var(--charcoal-muted)",
                      marginBottom: "0.5rem",
                    }}
                  >
                    {VENDOR_CATEGORY_LABEL[group.category]}
                  </p>
                  <div style={{ display: "grid", gap: "0.6rem" }}>
                    {group.vendors.map((v) => {
                      const vcardHref = buildVCardDataUrl(v);
                      return (
                        <article
                          key={v.id}
                          style={{
                            ...CARD,
                            display: "grid",
                            gap: "0.5rem",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              gap: "0.75rem",
                              alignItems: "baseline",
                              flexWrap: "wrap",
                              justifyContent: "space-between",
                            }}
                          >
                            <h3
                              style={{
                                fontFamily: "'Cormorant Garamond', serif",
                                fontSize: "1.3rem",
                                fontWeight: 300,
                                margin: 0,
                              }}
                            >
                              {v.name}
                            </h3>
                            <span style={PILL}>{VENDOR_CATEGORY_LABEL[v.category]}</span>
                          </div>
                          <div
                            style={{
                              display: "grid",
                              gap: "0.25rem",
                              fontSize: "0.9rem",
                            }}
                          >
                            {v.phone ? (
                              <div>
                                <span style={SUBTLE}>Phone </span>
                                <a
                                  href={`tel:${v.phone.replace(/[^\d+]/g, "")}`}
                                  style={{ color: "var(--olive)", textDecoration: "none" }}
                                >
                                  {v.phone}
                                </a>
                              </div>
                            ) : null}
                            {v.email ? (
                              <div>
                                <span style={SUBTLE}>Email </span>
                                <a
                                  href={`mailto:${v.email}`}
                                  style={{ color: "var(--olive)", textDecoration: "none" }}
                                >
                                  {v.email}
                                </a>
                              </div>
                            ) : null}
                          </div>
                          <div>
                            <a
                              href={vcardHref}
                              download={vCardFileName(v.name)}
                              style={{
                                display: "inline-block",
                                marginTop: "0.35rem",
                                padding: "0.45rem 0.95rem",
                                border: "0.5px solid var(--border-strong)",
                                background: "transparent",
                                color: "var(--charcoal)",
                                fontSize: "0.7rem",
                                letterSpacing: "0.14em",
                                textTransform: "uppercase",
                                textDecoration: "none",
                              }}
                            >
                              Add to contacts
                            </a>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Footer disclaimer */}
        <footer
          style={{
            ...SUBTLE,
            paddingTop: "1.5rem",
            borderTop: "0.5px solid var(--border)",
            textAlign: "center",
          }}
        >
          Read-only view. For changes, contact Korrin.
        </footer>
      </div>
    </div>
  );
}
