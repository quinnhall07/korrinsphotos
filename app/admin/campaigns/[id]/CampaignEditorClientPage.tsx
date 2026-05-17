"use client";

// app/admin/campaigns/[id]/CampaignEditorClientPage.tsx
// Full editor for a single campaign. Fields:
//   - heroTitle / heroSubtitle / heroPhotoCloudflareId
//   - bodyHtml (free-form HTML, big textarea)
//   - ctaText / ctaHref
//   - galleryCategory (optional category filter for the public strip)
//   - defaultUtm.{source,medium,campaign}
//   - inquiryPrefill.{sessionType,packageSlug}
//   - status (DRAFT|ACTIVE|ARCHIVED)
//
// Slug is shown read-only — immutable post-create.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "@/components/ui/Toaster";
import {
  deleteCampaignAction,
  setCampaignStatusAction,
  updateCampaignAction,
  type CampaignStatus,
} from "../actions";
import type {
  CampaignDefaultUtm,
  CampaignInquiryPrefill,
} from "@/lib/db/campaigns";

export interface SerializedCampaign {
  id: string;
  slug: string;
  status: CampaignStatus;
  title: string;
  heroTitle: string;
  heroSubtitle: string | null;
  heroPhotoCloudflareId: string | null;
  bodyHtml: string;
  ctaText: string;
  ctaHref: string | null;
  galleryCategory: string | null;
  defaultUtm: CampaignDefaultUtm;
  inquiryPrefill: CampaignInquiryPrefill | null;
  visitCount: number;
  inquiryCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Style primitives ──────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.65rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--charcoal-muted)",
  marginBottom: "0.4rem",
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

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: "vertical",
  minHeight: "10rem",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: "0.82rem",
  lineHeight: 1.6,
};

const ctaButton: React.CSSProperties = {
  display: "inline-block",
  padding: "0.75rem 1.6rem",
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

const ghostButton: React.CSSProperties = {
  padding: "0.65rem 1.2rem",
  border: "0.5px solid var(--border-strong)",
  background: "transparent",
  fontSize: "0.7rem",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  fontFamily: "'Jost', sans-serif",
  cursor: "pointer",
  color: "var(--charcoal)",
};

const sectionStyle: React.CSSProperties = {
  border: "0.5px solid var(--border)",
  padding: "1.75rem 1.75rem",
  marginBottom: "1.25rem",
  background: "var(--white)",
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: "0.62rem",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "var(--olive)",
  marginBottom: "0.5rem",
};

const STATUS_OPTIONS: CampaignStatus[] = ["DRAFT", "ACTIVE", "ARCHIVED"];

const SESSION_TYPE_OPTIONS = [
  "",
  "Wedding",
  "Portrait",
  "Editorial",
  "Family",
  "Engagement",
  "Commercial",
];

const PACKAGE_OPTIONS = ["", "mini", "story", "day"];

// ─── Component ─────────────────────────────────────────────────────────────

export function CampaignEditorClientPage({
  campaign,
}: {
  campaign: SerializedCampaign;
}) {
  const router = useRouter();
  const [isSaving, startSave] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [isPublishing, startPublish] = useTransition();

  const [title, setTitle] = useState(campaign.title);
  const [heroTitle, setHeroTitle] = useState(campaign.heroTitle);
  const [heroSubtitle, setHeroSubtitle] = useState(campaign.heroSubtitle ?? "");
  const [heroPhotoCloudflareId, setHeroPhotoCloudflareId] = useState(
    campaign.heroPhotoCloudflareId ?? ""
  );
  const [bodyHtml, setBodyHtml] = useState(campaign.bodyHtml);
  const [ctaText, setCtaText] = useState(campaign.ctaText);
  const [ctaHref, setCtaHref] = useState(campaign.ctaHref ?? "");
  const [galleryCategory, setGalleryCategory] = useState(
    campaign.galleryCategory ?? ""
  );
  const [utmSource, setUtmSource] = useState(campaign.defaultUtm.source);
  const [utmMedium, setUtmMedium] = useState(campaign.defaultUtm.medium);
  const [utmCampaign, setUtmCampaign] = useState(campaign.defaultUtm.campaign);
  const [prefillSessionType, setPrefillSessionType] = useState(
    campaign.inquiryPrefill?.sessionType ?? ""
  );
  const [prefillPackageSlug, setPrefillPackageSlug] = useState(
    campaign.inquiryPrefill?.packageSlug ?? ""
  );

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const inquiryPrefill: CampaignInquiryPrefill | null =
      prefillSessionType || prefillPackageSlug
        ? {
            sessionType: prefillSessionType || undefined,
            packageSlug: prefillPackageSlug || undefined,
          }
        : null;

    startSave(async () => {
      const result = await updateCampaignAction(campaign.id, {
        title,
        heroTitle,
        heroSubtitle: heroSubtitle || null,
        heroPhotoCloudflareId: heroPhotoCloudflareId || null,
        bodyHtml,
        ctaText,
        ctaHref: ctaHref || null,
        galleryCategory: galleryCategory || null,
        defaultUtm: {
          source: utmSource,
          medium: utmMedium,
          campaign: utmCampaign,
        },
        inquiryPrefill,
      });
      if (result.success) {
        toast("Campaign saved");
        router.refresh();
      } else {
        toast(result.error ?? "Failed to save campaign");
      }
    });
  }

  function handleStatus(next: CampaignStatus) {
    if (next === campaign.status) return;
    startPublish(async () => {
      const result = await setCampaignStatusAction(campaign.id, next);
      if (result.success) {
        toast(`Status updated to ${next}`);
        router.refresh();
      } else {
        toast(result.error ?? "Failed to update status");
      }
    });
  }

  function handleDelete() {
    if (
      !confirm(
        `Permanently delete "${campaign.title}"?\n\nThis removes the campaign record and 404s the public /c/${campaign.slug} URL. This cannot be undone.`
      )
    )
      return;
    startDelete(async () => {
      const result = await deleteCampaignAction(campaign.id);
      if (result.success) {
        toast("Campaign deleted");
        router.push("/admin/campaigns");
      } else {
        toast(result.error ?? "Failed to delete campaign");
      }
    });
  }

  const publicUrl = `/c/${campaign.slug}`;
  const conversionRate =
    campaign.visitCount > 0
      ? `${((campaign.inquiryCount / campaign.visitCount) * 100).toFixed(1)}%`
      : "—";

  return (
    <form onSubmit={handleSave} style={{ maxWidth: "60rem" }}>
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ flex: 1 }}>
          <p style={eyebrowStyle}>
            /c/{campaign.slug} · {campaign.status}
          </p>
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "2.2rem",
              fontWeight: 300,
              lineHeight: 1.1,
              color: "var(--charcoal)",
            }}
          >
            {campaign.title}
          </h1>
          <div
            style={{
              display: "flex",
              gap: "2rem",
              marginTop: "0.85rem",
              fontSize: "0.78rem",
              color: "var(--charcoal-muted)",
            }}
          >
            <span>Visits: <strong style={{ color: "var(--charcoal)" }}>{campaign.visitCount.toLocaleString()}</strong></span>
            <span>Inquiries: <strong style={{ color: "var(--charcoal)" }}>{campaign.inquiryCount.toLocaleString()}</strong></span>
            <span>Conversion: <strong style={{ color: "var(--charcoal)" }}>{conversionRate}</strong></span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem" }}>
          <Link
            href={publicUrl}
            target="_blank"
            style={{
              fontSize: "0.7rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--olive)",
              textDecoration: "none",
            }}
          >
            View public page ↗
          </Link>
        </div>
      </div>

      {/* ── Status row ─────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <p style={eyebrowStyle}>Status</p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={isPublishing || s === campaign.status}
              onClick={() => handleStatus(s)}
              style={{
                padding: "0.5rem 1.1rem",
                border: "0.5px solid var(--border-strong)",
                background: s === campaign.status ? "var(--olive)" : "transparent",
                color: s === campaign.status ? "var(--white)" : "var(--charcoal)",
                fontSize: "0.65rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                fontFamily: "'Jost', sans-serif",
                cursor: s === campaign.status ? "default" : "pointer",
                opacity: isPublishing && s !== campaign.status ? 0.5 : 1,
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <p
          style={{
            fontSize: "0.7rem",
            color: "var(--charcoal-muted)",
            marginTop: "0.75rem",
            lineHeight: 1.55,
          }}
        >
          Only <strong>ACTIVE</strong> campaigns render publicly. DRAFT and ARCHIVED return
          404 on <code>/c/{campaign.slug}</code>.
        </p>
      </div>

      {/* ── Internal ────────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <p style={eyebrowStyle}>Internal</p>
        <div style={{ display: "grid", gap: "1rem" }}>
          <Field label="Internal title">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={inputStyle}
              required
            />
          </Field>
          <Field label="Slug (immutable)">
            <input
              type="text"
              value={campaign.slug}
              readOnly
              style={{ ...inputStyle, color: "var(--charcoal-muted)", background: "rgba(42,42,40,0.03)" }}
            />
          </Field>
        </div>
      </div>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <p style={eyebrowStyle}>Hero</p>
        <div style={{ display: "grid", gap: "1rem" }}>
          <Field label="Hero headline">
            <input
              type="text"
              value={heroTitle}
              onChange={(e) => setHeroTitle(e.target.value)}
              style={inputStyle}
              required
            />
          </Field>
          <Field label="Hero subtitle">
            <input
              type="text"
              value={heroSubtitle}
              onChange={(e) => setHeroSubtitle(e.target.value)}
              style={inputStyle}
              placeholder="Optional — appears under the headline"
            />
          </Field>
          <Field label="Hero photo (Cloudflare Images ID)">
            <input
              type="text"
              value={heroPhotoCloudflareId}
              onChange={(e) => setHeroPhotoCloudflareId(e.target.value)}
              style={inputStyle}
              placeholder="Optional — pull from any uploaded photo's metadata"
            />
          </Field>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <p style={eyebrowStyle}>Body copy (HTML)</p>
        <Field label="Body HTML">
          <textarea
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            style={textareaStyle}
            placeholder="<p>Free-form HTML. Will be rendered into the public page as-is.</p>"
          />
        </Field>
        <p
          style={{
            fontSize: "0.7rem",
            color: "var(--charcoal-muted)",
            marginTop: "0.5rem",
          }}
        >
          Content is rendered as-is via <code>dangerouslySetInnerHTML</code>. Admin-authored
          only — don&apos;t expose this surface to untrusted input.
        </p>
      </div>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <p style={eyebrowStyle}>Call-to-action</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <Field label="Button text">
            <input
              type="text"
              value={ctaText}
              onChange={(e) => setCtaText(e.target.value)}
              style={inputStyle}
              required
            />
          </Field>
          <Field label="Custom CTA URL (optional)">
            <input
              type="text"
              value={ctaHref}
              onChange={(e) => setCtaHref(e.target.value)}
              style={inputStyle}
              placeholder={`Default: /booking?campaign=${campaign.slug}`}
            />
          </Field>
        </div>
      </div>

      {/* ── Gallery ────────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <p style={eyebrowStyle}>Public gallery strip (optional)</p>
        <Field label="Filter by category">
          <input
            type="text"
            value={galleryCategory}
            onChange={(e) => setGalleryCategory(e.target.value)}
            style={inputStyle}
            placeholder="e.g. wedding, portrait, editorial — leave blank to skip"
          />
        </Field>
        <p
          style={{
            fontSize: "0.7rem",
            color: "var(--charcoal-muted)",
            marginTop: "0.5rem",
          }}
        >
          When set, the public page renders a 6-photo strip from the portfolio matching
          this category.
        </p>
      </div>

      {/* ── Default UTM ────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <p style={eyebrowStyle}>Default UTM (attribution)</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
          <Field label="Source">
            <input
              type="text"
              value={utmSource}
              onChange={(e) => setUtmSource(e.target.value)}
              style={inputStyle}
              required
              placeholder="google"
            />
          </Field>
          <Field label="Medium">
            <input
              type="text"
              value={utmMedium}
              onChange={(e) => setUtmMedium(e.target.value)}
              style={inputStyle}
              required
              placeholder="cpc"
            />
          </Field>
          <Field label="Campaign">
            <input
              type="text"
              value={utmCampaign}
              onChange={(e) => setUtmCampaign(e.target.value)}
              style={inputStyle}
              required
              placeholder="wedding-2026-q1"
            />
          </Field>
        </div>
        <p
          style={{
            fontSize: "0.7rem",
            color: "var(--charcoal-muted)",
            marginTop: "0.5rem",
            lineHeight: 1.55,
          }}
        >
          When a visitor arrives via <code>/c/{campaign.slug}</code> and then submits the
          booking form, these values OVERWRITE the generic <code>__origin</code> UTM cookie
          on the new client&apos;s <code>firstTouch*</code> fields. Campaign attribution
          always wins.
        </p>
      </div>

      {/* ── Inquiry prefill ────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <p style={eyebrowStyle}>Inquiry-form prefill (optional)</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <Field label="Session type">
            <select
              value={prefillSessionType}
              onChange={(e) => setPrefillSessionType(e.target.value)}
              style={inputStyle}
            >
              {SESSION_TYPE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s || "(none)"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Package slug">
            <select
              value={prefillPackageSlug}
              onChange={(e) => setPrefillPackageSlug(e.target.value)}
              style={inputStyle}
            >
              {PACKAGE_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p || "(none)"}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p
          style={{
            fontSize: "0.7rem",
            color: "var(--charcoal-muted)",
            marginTop: "0.5rem",
          }}
        >
          When set, the CTA threads these into the booking URL so the visitor lands with
          the correct tile pre-selected.
        </p>
      </div>

      {/* ── Action row ─────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          alignItems: "center",
          paddingTop: "0.5rem",
        }}
      >
        <button type="submit" disabled={isSaving} style={ctaButton}>
          {isSaving ? "Saving…" : "Save changes"}
        </button>
        <Link href="/admin/campaigns" style={ghostButton}>
          Cancel
        </Link>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          style={{
            ...ghostButton,
            borderColor: "#FCA5A5",
            color: "#991B1B",
          }}
        >
          {isDeleting ? "Deleting…" : "Delete campaign"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}
