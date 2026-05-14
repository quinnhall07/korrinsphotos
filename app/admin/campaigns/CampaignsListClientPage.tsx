"use client";

// app/admin/campaigns/CampaignsListClientPage.tsx
// Renders the campaigns list, the "+ New campaign" modal, and per-row links
// into the editor. Pure UI — server actions are called via the imported
// functions from `./actions`.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "@/components/ui/Toaster";
import { createCampaignRedirectAction } from "./actions";
import type {
  CampaignDefaultUtm,
} from "@/lib/db/campaigns";
import type { CampaignStatus } from "./actions";

export interface SerializedCampaignRow {
  id: string;
  slug: string;
  title: string;
  status: CampaignStatus;
  visitCount: number;
  inquiryCount: number;
  defaultUtm: CampaignDefaultUtm;
  createdAt: string;
  updatedAt: string;
  /**
   * Phase 13.18 — lifetime ROAS chip. `null` when no ad-spend has been
   * logged for this campaign. Optional so page renders fail-soft when the
   * ROAS module is unavailable.
   */
  lifetimeRoas?: number | null;
}

// ─── Style primitives ──────────────────────────────────────────────────────

const eyebrowStyle: React.CSSProperties = {
  fontSize: "0.65rem",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "var(--olive)",
  fontWeight: 400,
};

const ctaButton: React.CSSProperties = {
  display: "inline-block",
  padding: "0.7rem 1.4rem",
  background: "var(--olive)",
  color: "var(--white)",
  border: "none",
  fontSize: "0.7rem",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  textDecoration: "none",
  fontFamily: "'Jost', sans-serif",
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "0.5px solid var(--border-strong)",
  background: "transparent",
  padding: "0.7rem 0.9rem",
  fontFamily: "'Jost', sans-serif",
  fontSize: "0.88rem",
  color: "var(--charcoal)",
  outline: "none",
  borderRadius: 0,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.65rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--charcoal-muted)",
  marginBottom: "0.4rem",
};

// ─── Status pill ───────────────────────────────────────────────────────────

function statusColors(status: CampaignStatus): { bg: string; fg: string } {
  switch (status) {
    case "ACTIVE":
      return { bg: "rgba(107,120,69,0.12)", fg: "var(--olive)" };
    case "DRAFT":
      return { bg: "rgba(42,42,40,0.06)", fg: "var(--charcoal-muted)" };
    case "ARCHIVED":
      return { bg: "rgba(42,42,40,0.04)", fg: "var(--charcoal-muted)" };
  }
}

function StatusPill({ status }: { status: CampaignStatus }) {
  const { bg, fg } = statusColors(status);
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.18rem 0.6rem",
        background: bg,
        color: fg,
        fontSize: "0.6rem",
        letterSpacing: "0.18em",
        textTransform: "uppercase",
      }}
    >
      {status}
    </span>
  );
}

function formatConversionRate(visits: number, inquiries: number): string {
  if (!visits) return "—";
  const rate = (inquiries / visits) * 100;
  if (rate === 0) return "0%";
  if (rate >= 10) return `${rate.toFixed(0)}%`;
  return `${rate.toFixed(1)}%`;
}

// ─── Main component ───────────────────────────────────────────────────────

export function CampaignsListClientPage({ rows }: { rows: SerializedCampaignRow[] }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="page-fade-in" style={{ padding: "2.5rem 3rem" }}>
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: "2.5rem",
          gap: "1.5rem",
        }}
      >
        <div>
          <p style={{ ...eyebrowStyle, marginBottom: "0.5rem" }}>Marketing</p>
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "2.4rem",
              fontWeight: 300,
              lineHeight: 1.1,
              letterSpacing: "-0.01em",
              color: "var(--charcoal)",
            }}
          >
            Campaign Landing Pages
          </h1>
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--charcoal-muted)",
              marginTop: "0.4rem",
              lineHeight: 1.6,
              maxWidth: "44rem",
            }}
          >
            Each campaign powers a focused landing page at <code>/c/&lt;slug&gt;</code> with
            its own hero, copy, default UTM, and inquiry-form prefills.
          </p>
        </div>
        <button onClick={() => setShowModal(true)} style={ctaButton}>
          + New campaign
        </button>
      </div>

      {/* ── List ─────────────────────────────────────────────────────── */}
      {rows.length === 0 ? (
        <div
          style={{
            border: "0.5px dashed var(--border-strong)",
            padding: "3rem 2rem",
            textAlign: "center",
            color: "var(--charcoal-muted)",
            fontSize: "0.92rem",
          }}
        >
          No campaigns yet. Click <strong>+ New campaign</strong> to publish the first
          landing page.
        </div>
      ) : (
        <div
          style={{
            border: "0.5px solid var(--border)",
            borderBottom: "none",
          }}
        >
          {rows.map((row) => (
            <CampaignRow key={row.id} row={row} />
          ))}
        </div>
      )}

      {/* ── Create modal ─────────────────────────────────────────────── */}
      {showModal && <NewCampaignModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

// ─── Row ───────────────────────────────────────────────────────────────────

function roasChipTone(roas: number): { bg: string; fg: string } {
  if (roas >= 3) return { bg: "rgba(34,134,58,0.10)", fg: "#22863A" };
  if (roas >= 1.5) return { bg: "rgba(107,120,69,0.12)", fg: "var(--olive)" };
  if (roas >= 0.5) return { bg: "rgba(180,83,9,0.10)", fg: "#B45309" };
  return { bg: "rgba(220,38,38,0.10)", fg: "#DC2626" };
}

function RoasChip({ roas }: { roas: number | null | undefined }) {
  if (roas === null || roas === undefined || !Number.isFinite(roas)) return null;
  const tone = roasChipTone(roas);
  return (
    <span
      title="Lifetime ROAS — revenue ÷ ad spend (Phase 13.18)"
      style={{
        display: "inline-block",
        padding: "0.12rem 0.45rem",
        background: tone.bg,
        color: tone.fg,
        fontSize: "0.6rem",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        marginLeft: "0.5rem",
        verticalAlign: "middle",
      }}
    >
      ROAS {roas.toFixed(2)}×
    </span>
  );
}

function CampaignRow({ row }: { row: SerializedCampaignRow }) {
  const conv = formatConversionRate(row.visitCount, row.inquiryCount);
  return (
    <Link
      href={`/admin/campaigns/${row.id}`}
      style={{
        display: "grid",
        gridTemplateColumns: "1.6fr 0.8fr 0.6fr 0.6fr 0.6fr 1fr",
        gap: "1rem",
        alignItems: "center",
        padding: "1.1rem 1.25rem",
        borderBottom: "0.5px solid var(--border)",
        textDecoration: "none",
        color: "inherit",
        transition: "background 0.15s",
      }}
    >
      <div>
        <div
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "1.25rem",
            fontWeight: 400,
            color: "var(--charcoal)",
            marginBottom: "0.2rem",
          }}
        >
          {row.title}
          <RoasChip roas={row.lifetimeRoas} />
        </div>
        <div
          style={{
            fontSize: "0.72rem",
            color: "var(--charcoal-muted)",
            letterSpacing: "0.04em",
          }}
        >
          /c/{row.slug}
        </div>
      </div>
      <div>
        <StatusPill status={row.status} />
      </div>
      <Stat label="Visits" value={row.visitCount.toLocaleString()} />
      <Stat label="Inquiries" value={row.inquiryCount.toLocaleString()} />
      <Stat label="Conversion" value={conv} />
      <div
        style={{
          fontSize: "0.7rem",
          color: "var(--charcoal-muted)",
          letterSpacing: "0.04em",
        }}
      >
        {row.defaultUtm.source} / {row.defaultUtm.medium}
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: "0.58rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--charcoal-muted)",
          marginBottom: "0.15rem",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "1.15rem",
          fontWeight: 400,
          color: "var(--charcoal)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ─── Create modal ─────────────────────────────────────────────────────────

function NewCampaignModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [heroTitle, setHeroTitle] = useState("");
  const [utmSource, setUtmSource] = useState("");
  const [utmMedium, setUtmMedium] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");

  const slugValid = /^[a-z0-9-]+$/.test(slug);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!slug.trim()) return setError("Slug is required.");
    if (!slugValid)
      return setError(
        "Slug must contain only lowercase letters, numbers, and hyphens."
      );
    if (!title.trim()) return setError("Title is required.");
    if (!heroTitle.trim()) return setError("Hero title is required.");
    if (!utmSource.trim() || !utmMedium.trim() || !utmCampaign.trim())
      return setError("Default UTM source, medium, and campaign are required.");

    startTransition(async () => {
      try {
        await createCampaignRedirectAction({
          slug: slug.trim().toLowerCase(),
          title: title.trim(),
          heroTitle: heroTitle.trim(),
          bodyHtml: "",
          ctaText: "Inquire",
          defaultUtm: {
            source: utmSource.trim(),
            medium: utmMedium.trim(),
            campaign: utmCampaign.trim(),
          },
          status: "DRAFT",
        });
        // On success the action redirects; we won't reach here.
      } catch (err) {
        // `redirect()` throws an internal NEXT_REDIRECT — re-throw lets Next
        // handle the navigation. Anything else is a real failure.
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("NEXT_REDIRECT")) {
          router.refresh();
          return;
        }
        setError(message || "Failed to create campaign.");
        toast("Failed to create campaign");
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(42,42,40,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "2rem",
      }}
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        style={{
          background: "var(--white)",
          border: "0.5px solid var(--border-strong)",
          padding: "2.25rem 2rem",
          maxWidth: "32rem",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "1.2rem",
        }}
      >
        <div>
          <p style={{ ...eyebrowStyle, marginBottom: "0.4rem" }}>New campaign</p>
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "1.65rem",
              fontWeight: 300,
              lineHeight: 1.2,
            }}
          >
            Publish a focused landing page
          </h2>
        </div>

        <div>
          <label style={labelStyle}>Slug *</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            placeholder="wedding-bradford-spring-2026"
            style={inputStyle}
            required
            autoFocus
          />
          <p
            style={{
              fontSize: "0.68rem",
              color: "var(--charcoal-muted)",
              marginTop: "0.35rem",
            }}
          >
            Will live at <code>/c/{slug || "<slug>"}</code>. Immutable once created.
          </p>
        </div>

        <div>
          <label style={labelStyle}>Internal title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Bradford Estate — Spring 2026 partnership"
            style={inputStyle}
            required
          />
        </div>

        <div>
          <label style={labelStyle}>Hero headline *</label>
          <input
            type="text"
            value={heroTitle}
            onChange={(e) => setHeroTitle(e.target.value)}
            placeholder="A weekend at Bradford Estate"
            style={inputStyle}
            required
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
          <div>
            <label style={labelStyle}>UTM source *</label>
            <input
              type="text"
              value={utmSource}
              onChange={(e) => setUtmSource(e.target.value)}
              placeholder="google"
              style={inputStyle}
              required
            />
          </div>
          <div>
            <label style={labelStyle}>UTM medium *</label>
            <input
              type="text"
              value={utmMedium}
              onChange={(e) => setUtmMedium(e.target.value)}
              placeholder="cpc"
              style={inputStyle}
              required
            />
          </div>
          <div>
            <label style={labelStyle}>UTM campaign *</label>
            <input
              type="text"
              value={utmCampaign}
              onChange={(e) => setUtmCampaign(e.target.value)}
              placeholder="wedding-2026-q1"
              style={inputStyle}
              required
            />
          </div>
        </div>

        {error && (
          <div
            style={{
              border: "0.5px solid #FCA5A5",
              background: "#FEF2F2",
              color: "#991B1B",
              padding: "0.75rem 0.9rem",
              fontSize: "0.82rem",
              lineHeight: 1.55,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            style={{
              padding: "0.7rem 1.4rem",
              border: "0.5px solid var(--border-strong)",
              background: "transparent",
              fontSize: "0.7rem",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              fontFamily: "'Jost', sans-serif",
              cursor: "pointer",
              color: "var(--charcoal)",
            }}
          >
            Cancel
          </button>
          <button type="submit" disabled={isPending} style={ctaButton}>
            {isPending ? "Creating…" : "Create campaign"}
          </button>
        </div>
      </form>
    </div>
  );
}
