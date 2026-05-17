// app/admin/settings/page.tsx
// Settings hub — UX J.P0. Renders a 2-column tile grid grouped by
// Automations / Voice / Business, linking to every existing leaf
// settings page. Server Component; the parent admin layout already
// enforces `requireAdmin()` so we repeat the call here per the
// app/admin/CLAUDE.md convention ("every child page MUST repeat it").

import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Settings | Admin" };

type Tile = {
  href: string;
  title: string;
  description: string;
};

type Group = {
  eyebrow: string;
  heading: string;
  tiles: Tile[];
};

const GROUPS: Group[] = [
  {
    eyebrow: "Automations",
    heading: "Lifecycle & messaging",
    tiles: [
      {
        href: "/admin/settings/automations",
        title: "Automation recipes",
        description:
          "Toggle lifecycle automations on or off and tune their delays.",
      },
      {
        href: "/admin/sequences",
        title: "Drip sequences",
        description:
          "Multi-step email cadences triggered by project status or date.",
      },
      {
        href: "/admin/settings/reply-templates",
        title: "Reply templates",
        description:
          "Saved replies you can quick-insert into the project workspace.",
      },
    ],
  },
  {
    eyebrow: "Voice",
    heading: "How the AI sounds like you",
    tiles: [
      {
        href: "/admin/settings/brand-voice",
        title: "Brand voice samples",
        description:
          "Short passages the AI uses as voice anchors when drafting replies.",
      },
    ],
  },
  {
    eyebrow: "Business",
    heading: "Operations & finance",
    tiles: [
      {
        href: "/admin/settings/insurer",
        title: "Insurer contact",
        description:
          "Destination for COI requests and default additional-insured language.",
      },
      {
        href: "/admin/settings/tax",
        title: "Sales tax",
        description:
          "Master switch plus per-state rate, digital, and prints overrides.",
      },
      {
        href: "/admin/settings/studio-hours",
        title: "Studio hours",
        description:
          "Weekly schedule and vacations that drive after-hours auto-responses.",
      },
      {
        href: "/admin/settings/gear-templates",
        title: "Gear templates",
        description:
          "Per-shoot-type packing kits surfaced on each project's Gear tab.",
      },
    ],
  },
];

export default async function SettingsHubPage() {
  await requireAdmin();

  return (
    <div className="page-fade-in" style={pageWrap}>
      <header style={{ marginBottom: "2.5rem" }}>
        <p style={pageEyebrow}>Admin</p>
        <h1 style={pageTitle}>
          Settings <em>hub</em>
        </h1>
        <p style={pageLede}>
          Every studio knob lives here. Pick a section to tune lifecycle
          automations, the voice the AI writes in, or the business rules that
          drive contracts, tax, and gear.
        </p>
      </header>

      {GROUPS.map((group) => (
        <section key={group.eyebrow} style={{ marginBottom: "2.75rem" }}>
          <div style={{ marginBottom: "1rem" }}>
            <p style={groupEyebrow}>{group.eyebrow}</p>
            <h2 style={groupHeading}>{group.heading}</h2>
          </div>

          <div style={grid}>
            {group.tiles.map((tile) => (
              <Link key={tile.href} href={tile.href} style={tileStyle}>
                <div style={tileBody}>
                  <h3 style={tileTitle}>{tile.title}</h3>
                  <p style={tileDescription}>{tile.description}</p>
                </div>
                <span aria-hidden="true" style={tileChevron}>
                  &rsaquo;
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const pageWrap: CSSProperties = {
  maxWidth: 880,
  padding: "0.5rem 0",
};

const pageEyebrow: CSSProperties = {
  fontSize: "0.65rem",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "var(--olive)",
  marginBottom: "0.5rem",
};

const pageTitle: CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 300,
  fontSize: "2.4rem",
  lineHeight: 1.1,
  color: "var(--charcoal)",
  marginBottom: "0.75rem",
};

const pageLede: CSSProperties = {
  fontSize: "0.88rem",
  lineHeight: 1.65,
  color: "var(--charcoal-light)",
  maxWidth: 620,
};

const groupEyebrow: CSSProperties = {
  fontSize: "0.65rem",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "var(--olive)",
  marginBottom: "0.35rem",
};

const groupHeading: CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 300,
  fontSize: "1.45rem",
  lineHeight: 1.2,
  color: "var(--charcoal)",
};

const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  gap: "0.75rem",
};

const tileStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
  padding: "1.15rem 1.25rem",
  border: "0.5px solid var(--border)",
  background: "var(--white)",
  color: "var(--charcoal)",
  textDecoration: "none",
  transition: "border-color var(--transition), background var(--transition)",
};

const tileBody: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.3rem",
  minWidth: 0,
};

const tileTitle: CSSProperties = {
  fontFamily: "'Jost', sans-serif",
  fontWeight: 400,
  fontSize: "0.95rem",
  letterSpacing: "0.02em",
  color: "var(--charcoal)",
  margin: 0,
};

const tileDescription: CSSProperties = {
  fontSize: "0.8rem",
  lineHeight: 1.55,
  color: "var(--charcoal-muted)",
  margin: 0,
};

const tileChevron: CSSProperties = {
  fontFamily: "'Jost', sans-serif",
  fontSize: "1.4rem",
  lineHeight: 1,
  color: "var(--olive)",
  flexShrink: 0,
};
