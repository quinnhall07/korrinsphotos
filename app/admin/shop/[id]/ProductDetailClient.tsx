"use client";

// app/admin/shop/[id]/ProductDetailClient.tsx
// Edit form for a single product. Slug is locked. Publishing flips status to
// PUBLISHED and (if missing) mints a Stripe Payment Link via the Server Action.

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { toast } from "@/components/ui/Toaster";
import type { ProductStatus, ProductType } from "@/lib/db/products";
import {
  updateProductAction,
  publishProductAction,
  archiveProductAction,
  deleteProductAction,
  getR2PutUrlForProductFile,
} from "../actions";

export interface SerializedProduct {
  id: string;
  slug: string;
  title: string;
  type: ProductType;
  status: ProductStatus;
  shortDescription: string;
  longDescriptionHtml: string;
  priceCents: number;
  heroImageUrl: string;
  galleryImageUrls: string[];
  fileR2Key: string;
  fileSizeBytes: number | null;
  stripePaymentLinkUrl: string | null;
  stripePaymentLinkId: string | null;
  stripePriceId: string | null;
  purchaseCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  product: SerializedProduct;
}

export function ProductDetailClient({ product }: Props) {
  const router = useRouter();

  // Edit form state.
  const [title, setTitle] = useState(product.title);
  const [type, setType] = useState<ProductType>(product.type);
  const [shortDescription, setShortDescription] = useState(
    product.shortDescription
  );
  const [longDescriptionHtml, setLongDescriptionHtml] = useState(
    product.longDescriptionHtml
  );
  const [priceDollars, setPriceDollars] = useState(
    (product.priceCents / 100).toFixed(2)
  );
  const [heroImageUrl, setHeroImageUrl] = useState(product.heroImageUrl);
  const [galleryUrlsText, setGalleryUrlsText] = useState(
    product.galleryImageUrls.join("\n")
  );
  const [saving, setSaving] = useState(false);

  // File-replace state.
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Publish / archive / delete state.
  const [publishing, setPublishing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const priceCents = Math.round(parseFloat(priceDollars || "0") * 100);
    const galleryImageUrls = galleryUrlsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const res = await updateProductAction(product.id, {
      title,
      type,
      shortDescription,
      longDescriptionHtml,
      priceCents,
      heroImageUrl: heroImageUrl.trim() || null,
      galleryImageUrls,
    });
    setSaving(false);
    if (res.success) {
      toast("Product updated.");
      router.refresh();
    } else {
      toast(res.error ?? "Update failed.");
    }
  }

  async function handlePublish() {
    setPublishing(true);
    const res = await publishProductAction(product.id);
    setPublishing(false);
    if (res.success) {
      toast("Product published. Stripe payment link is live.");
      router.refresh();
    } else {
      toast(res.error ?? "Publish failed.");
    }
  }

  async function handleArchive() {
    if (!window.confirm(`Archive "${product.title}"?`)) return;
    setArchiving(true);
    const res = await archiveProductAction(product.id);
    setArchiving(false);
    if (res.success) {
      toast("Product archived.");
      router.refresh();
    } else {
      toast(res.error ?? "Archive failed.");
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${product.title}"? This cannot be undone.`))
      return;
    setDeleting(true);
    const res = await deleteProductAction(product.id);
    if (res.success) {
      toast("Product deleted.");
      router.push("/admin/shop");
    } else {
      toast(res.error ?? "Delete failed.");
      setDeleting(false);
    }
  }

  async function handleReplaceFile() {
    if (!replaceFile) {
      toast("Select a file first.");
      return;
    }
    setUploading(true);
    try {
      const res = await getR2PutUrlForProductFile(
        product.id,
        replaceFile.type || "application/zip",
        replaceFile.name
      );
      if (!res.success) {
        toast(res.error ?? "Could not issue upload URL.");
        setUploading(false);
        return;
      }
      const put = await fetch(res.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": replaceFile.type || "application/zip" },
        body: replaceFile,
      });
      if (!put.ok) {
        toast(`Upload failed (${put.status}).`);
      } else {
        toast("File replaced.");
        setReplaceFile(null);
        router.refresh();
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "3rem", maxWidth: "72rem" }}>
      {/* Header */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: "2rem",
          paddingBottom: "1.25rem",
          borderBottom: "0.5px solid var(--border)",
        }}
      >
        <div>
          <p
            style={{
              fontSize: "0.65rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--olive)",
              marginBottom: "0.5rem",
            }}
          >
            Product · {product.status}
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
            {product.title}
          </h1>
          <p
            style={{
              fontFamily: "'Jost', monospace",
              fontSize: "0.78rem",
              color: "var(--charcoal-muted)",
              marginTop: "0.4rem",
            }}
          >
            /shop/{product.slug}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
          <span
            style={{
              fontSize: "0.78rem",
              color: "var(--charcoal-light)",
              fontFamily: "'Jost', sans-serif",
            }}
          >
            {product.purchaseCount} sold
          </span>
          {product.status === "PUBLISHED" && (
            <Link
              href={`/shop/${product.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: "0.5rem 1rem",
                fontFamily: "'Jost', sans-serif",
                fontSize: "0.7rem",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--charcoal-light)",
                border: "0.5px solid var(--border-strong)",
                textDecoration: "none",
              }}
            >
              View public ↗
            </Link>
          )}
        </div>
      </header>

      {/* Publish / status controls */}
      <section
        style={{
          padding: "1.25rem",
          border: "0.5px solid var(--border)",
          background: "rgba(42,42,40,0.02)",
          display: "grid",
          gap: "0.75rem",
          maxWidth: "44rem",
        }}
      >
        <p style={{ fontSize: "0.85rem", color: "var(--charcoal-light)" }}>
          Status: <strong>{product.status}</strong>
          {product.stripePaymentLinkUrl ? (
            <>
              {" · "}
              <a
                href={product.stripePaymentLinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--olive)", textDecoration: "underline" }}
              >
                View Stripe payment link ↗
              </a>
            </>
          ) : null}
        </p>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          {product.status !== "PUBLISHED" && (
            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing}
              style={primaryButtonStyle(publishing)}
            >
              {publishing ? "Publishing…" : "Publish"}
            </button>
          )}
          {product.status !== "ARCHIVED" && (
            <button
              type="button"
              onClick={handleArchive}
              disabled={archiving}
              style={secondaryButtonStyle}
            >
              {archiving ? "Archiving…" : "Archive"}
            </button>
          )}
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            style={{
              ...secondaryButtonStyle,
              color: "#991B1B",
              borderColor: "#FCA5A5",
            }}
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </section>

      {/* Edit form */}
      <form
        onSubmit={handleSave}
        style={{ display: "grid", gap: "1rem", maxWidth: "44rem" }}
      >
        <h2
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "1.5rem",
            fontWeight: 300,
            color: "var(--charcoal)",
          }}
        >
          Edit details
        </h2>

        <Field label="Slug (immutable)" value={product.slug} disabled />
        <Field label="Title" value={title} onChange={setTitle} required />

        <div style={{ display: "grid", gap: "0.4rem" }}>
          <label style={labelStyle}>Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ProductType)}
            style={inputStyle}
          >
            <option value="PRESET_DESKTOP">Desktop preset</option>
            <option value="PRESET_MOBILE">Mobile preset</option>
            <option value="COURSE">Course</option>
            <option value="EBOOK">Ebook</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        <Field
          label="Short description (≤200 chars, shown on the card)"
          value={shortDescription}
          onChange={setShortDescription}
          required
          multiline
        />
        <Field
          label="Long description (HTML — shown on the product page)"
          value={longDescriptionHtml}
          onChange={setLongDescriptionHtml}
          multiline
          rows={8}
          hint="Plain HTML is fine: <p>, <ul>, <strong>, <em>, etc."
        />

        <Field
          label="Price (USD)"
          value={priceDollars}
          onChange={setPriceDollars}
          required
          hint="Whole or decimal — e.g. 29 or 29.99"
        />

        <Field
          label="Hero image URL (Cloudflare Images or external)"
          value={heroImageUrl}
          onChange={setHeroImageUrl}
          placeholder="https://imagedelivery.net/.../public"
        />

        <Field
          label="Gallery image URLs (one per line)"
          value={galleryUrlsText}
          onChange={setGalleryUrlsText}
          multiline
          rows={4}
          hint="Optional thumbnails shown beneath the hero."
        />

        <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
          <button type="submit" disabled={saving} style={primaryButtonStyle(saving)}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      {/* File replace */}
      <section style={{ display: "grid", gap: "1rem", maxWidth: "44rem" }}>
        <h2
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "1.5rem",
            fontWeight: 300,
            color: "var(--charcoal)",
          }}
        >
          Deliverable file
        </h2>
        <p style={{ fontSize: "0.85rem", color: "var(--charcoal-light)" }}>
          Current key:{" "}
          <code style={{ fontSize: "0.78rem" }}>{product.fileR2Key}</code>
        </p>
        <div
          style={{
            padding: "1.25rem",
            border: "0.5px dashed var(--border-strong)",
            display: "grid",
            gap: "0.75rem",
          }}
        >
          <input
            type="file"
            onChange={(e) => setReplaceFile(e.target.files?.[0] ?? null)}
            style={{
              fontFamily: "'Jost', sans-serif",
              fontSize: "0.85rem",
              color: "var(--charcoal-light)",
            }}
          />
          <button
            type="button"
            onClick={handleReplaceFile}
            disabled={uploading || !replaceFile}
            style={primaryButtonStyle(uploading || !replaceFile)}
          >
            {uploading ? "Uploading…" : "Upload new file"}
          </button>
        </div>
      </section>
    </div>
  );
}

// ─── Inline form primitives (shared style) ──────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: "0.65rem",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "var(--charcoal-muted)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.7rem 0.75rem",
  background: "var(--white)",
  border: "0.5px solid var(--border-strong)",
  fontFamily: "'Jost', sans-serif",
  fontSize: "0.92rem",
  color: "var(--charcoal)",
  outline: "none",
};

function primaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "0.7rem 1.4rem",
    background: "var(--charcoal)",
    color: "var(--white)",
    border: "none",
    fontFamily: "'Jost', sans-serif",
    fontSize: "0.72rem",
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
  };
}

const secondaryButtonStyle: React.CSSProperties = {
  padding: "0.7rem 1.4rem",
  background: "transparent",
  color: "var(--charcoal-light)",
  border: "0.5px solid var(--border-strong)",
  fontFamily: "'Jost', sans-serif",
  fontSize: "0.72rem",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  cursor: "pointer",
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  required,
  multiline,
  disabled,
  rows,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  multiline?: boolean;
  disabled?: boolean;
  rows?: number;
}) {
  return (
    <div style={{ display: "grid", gap: "0.4rem" }}>
      <label style={labelStyle}>{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          required={required}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows ?? 3}
          style={{
            ...inputStyle,
            resize: "vertical",
            background: disabled ? "rgba(42,42,40,0.04)" : inputStyle.background,
          }}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          required={required}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            ...inputStyle,
            background: disabled ? "rgba(42,42,40,0.04)" : inputStyle.background,
          }}
        />
      )}
      {hint && (
        <p
          style={{
            fontSize: "0.72rem",
            color: "var(--charcoal-muted)",
            fontFamily: "'Jost', sans-serif",
          }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
