"use client";

// app/admin/shop/ShopListClientPage.tsx
// Admin list of digital products with a "+ New product" modal that issues a
// presigned R2 PUT URL on submit and uploads the deliverable directly to R2.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/components/ui/Toaster";
import { createProductAction } from "./actions";
import type { ProductStatus, ProductType } from "@/lib/db/products";

export interface SerializedProductRow {
  id: string;
  slug: string;
  title: string;
  type: ProductType;
  status: ProductStatus;
  priceCents: number;
  purchaseCount: number;
  shortDescription: string;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  rows: SerializedProductRow[];
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function statusColor(s: ProductStatus): { bg: string; fg: string } {
  switch (s) {
    case "PUBLISHED":
      return { bg: "var(--olive-dim)", fg: "var(--olive)" };
    case "DRAFT":
      return { bg: "rgba(42,42,40,0.06)", fg: "var(--charcoal-light)" };
    case "ARCHIVED":
      return { bg: "rgba(42,42,40,0.04)", fg: "var(--charcoal-muted)" };
  }
}

const TYPE_LABEL: Record<ProductType, string> = {
  PRESET_DESKTOP: "Desktop preset",
  PRESET_MOBILE: "Mobile preset",
  COURSE: "Course",
  EBOOK: "Ebook",
  OTHER: "Other",
};

export function ShopListClientPage({ rows }: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ProductType>("PRESET_DESKTOP");
  const [shortDescription, setShortDescription] = useState("");
  const [priceDollars, setPriceDollars] = useState("29");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setSlug("");
    setTitle("");
    setType("PRESET_DESKTOP");
    setShortDescription("");
    setPriceDollars("29");
    setFile(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const priceCents = Math.round(parseFloat(priceDollars || "0") * 100);
      const res = await createProductAction({
        slug,
        title,
        type,
        shortDescription,
        longDescriptionHtml: "",
        priceCents,
        fileFileName: file?.name,
        contentType: file?.type || "application/zip",
      });

      if (!res.success) {
        toast(res.error);
        setSubmitting(false);
        return;
      }

      if (file) {
        try {
          const put = await fetch(res.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": file.type || "application/zip" },
            body: file,
          });
          if (!put.ok) {
            toast(`Product created, but upload failed (${put.status}).`);
          } else {
            toast("Product created and file uploaded.");
          }
        } catch {
          toast("Product created, but upload failed.");
        }
      } else {
        toast("Product created. Upload a file from the detail page.");
      }

      resetForm();
      setCreating(false);
      router.push(`/admin/shop/${res.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to create product.");
      setSubmitting(false);
    }
  }

  return (
    <div className="page-fade-in" style={{ padding: "2rem 2rem 6rem" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: "2.5rem",
          gap: "2rem",
        }}
      >
        <div>
          <p
            style={{
              fontSize: "0.65rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--olive)",
              marginBottom: "0.6rem",
            }}
          >
            Content / Store
          </p>
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "2.4rem",
              fontWeight: 300,
              lineHeight: 1.1,
              color: "var(--charcoal)",
            }}
          >
            Shop
          </h1>
          <p
            style={{
              fontFamily: "'Jost', sans-serif",
              fontSize: "0.92rem",
              color: "var(--charcoal-light)",
              marginTop: "0.5rem",
              maxWidth: "40rem",
            }}
          >
            Lightroom presets, mobile presets, and short courses delivered as a
            presigned download link after Stripe checkout.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          style={{
            padding: "0.7rem 1.4rem",
            background: "var(--charcoal)",
            color: "var(--white)",
            border: "none",
            fontFamily: "'Jost', sans-serif",
            fontSize: "0.72rem",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          + New product
        </button>
      </div>

      {/* Empty state */}
      {rows.length === 0 ? (
        <div
          style={{
            padding: "3rem 2rem",
            border: "0.5px dashed var(--border-strong)",
            textAlign: "center",
            color: "var(--charcoal-muted)",
            fontFamily: "'Jost', sans-serif",
            fontSize: "0.92rem",
          }}
        >
          No products yet. Create one to start selling presets, courses, and
          digital deliverables.
        </div>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: "'Jost', sans-serif",
            fontSize: "0.88rem",
          }}
        >
          <thead>
            <tr style={{ borderBottom: "0.5px solid var(--border-strong)" }}>
              {["Title", "Type", "Status", "Price", "Sold", ""].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: "0.85rem 0.75rem",
                    fontSize: "0.65rem",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--charcoal-muted)",
                    fontWeight: 500,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const colors = statusColor(r.status);
              return (
                <tr
                  key={r.id}
                  style={{ borderBottom: "0.5px solid var(--border)" }}
                >
                  <td style={{ padding: "1rem 0.75rem" }}>
                    <Link
                      href={`/admin/shop/${r.id}`}
                      style={{
                        color: "var(--charcoal)",
                        textDecoration: "none",
                        fontWeight: 500,
                      }}
                    >
                      {r.title}
                    </Link>
                    <div
                      style={{
                        color: "var(--charcoal-muted)",
                        fontSize: "0.78rem",
                        marginTop: "0.2rem",
                        maxWidth: "32rem",
                      }}
                    >
                      {r.shortDescription}
                    </div>
                  </td>
                  <td
                    style={{
                      padding: "1rem 0.75rem",
                      color: "var(--charcoal-light)",
                    }}
                  >
                    {TYPE_LABEL[r.type]}
                  </td>
                  <td style={{ padding: "1rem 0.75rem" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "0.25rem 0.7rem",
                        background: colors.bg,
                        color: colors.fg,
                        fontSize: "0.7rem",
                        letterSpacing: "0.1em",
                      }}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "1rem 0.75rem",
                      color: "var(--charcoal)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatPrice(r.priceCents)}
                  </td>
                  <td
                    style={{
                      padding: "1rem 0.75rem",
                      color: "var(--charcoal)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {r.purchaseCount}
                  </td>
                  <td style={{ padding: "1rem 0.75rem", textAlign: "right" }}>
                    {r.status === "PUBLISHED" ? (
                      <Link
                        href={`/shop/${r.slug}`}
                        style={{
                          fontSize: "0.72rem",
                          color: "var(--charcoal-muted)",
                          letterSpacing: "0.1em",
                          textDecoration: "none",
                        }}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View ↗
                      </Link>
                    ) : (
                      <span
                        style={{
                          fontSize: "0.72rem",
                          color: "var(--charcoal-muted)",
                          letterSpacing: "0.1em",
                        }}
                      >
                        —
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Create modal */}
      {creating && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(42,42,40,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 500,
            padding: "2rem",
          }}
          onClick={() => !submitting && setCreating(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "40rem",
              background: "var(--white)",
              border: "0.5px solid var(--border-strong)",
              padding: "2rem",
              maxHeight: "92vh",
              overflowY: "auto",
            }}
          >
            <h2
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "1.8rem",
                fontWeight: 300,
                marginBottom: "0.4rem",
                color: "var(--charcoal)",
              }}
            >
              New product
            </h2>
            <p
              style={{
                fontFamily: "'Jost', sans-serif",
                fontSize: "0.85rem",
                color: "var(--charcoal-muted)",
                marginBottom: "1.5rem",
              }}
            >
              The slug becomes the public URL and cannot change after create.
              The product starts as DRAFT — publish it from the detail page to
              mint a Stripe Payment Link.
            </p>

            <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
              <Field
                label="Slug (URL)"
                value={slug}
                onChange={setSlug}
                required
                placeholder="moody-warm-presets"
                hint={`Will publish at /shop/${slug || "your-slug"}`}
              />
              <Field
                label="Title"
                value={title}
                onChange={setTitle}
                required
                placeholder="Moody Warm Lightroom Presets"
              />

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
                label="Short description (≤200 chars)"
                value={shortDescription}
                onChange={setShortDescription}
                required
                placeholder="A 12-preset pack for warm, editorial weddings."
                multiline
              />

              <Field
                label="Price (USD)"
                value={priceDollars}
                onChange={setPriceDollars}
                required
                placeholder="29"
                hint="Whole or decimal — e.g. 29 or 29.99"
              />

              <div style={{ display: "grid", gap: "0.4rem" }}>
                <label style={labelStyle}>
                  Deliverable file (optional — can upload later)
                </label>
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  style={{
                    padding: "0.6rem 0",
                    fontFamily: "'Jost', sans-serif",
                    fontSize: "0.85rem",
                    color: "var(--charcoal-light)",
                  }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "0.75rem",
                  justifyContent: "flex-end",
                  marginTop: "1rem",
                }}
              >
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  disabled={submitting}
                  style={{
                    padding: "0.7rem 1.4rem",
                    background: "transparent",
                    color: "var(--charcoal-light)",
                    border: "0.5px solid var(--border-strong)",
                    fontFamily: "'Jost', sans-serif",
                    fontSize: "0.72rem",
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: "0.7rem 1.4rem",
                    background: "var(--charcoal)",
                    color: "var(--white)",
                    border: "none",
                    fontFamily: "'Jost', sans-serif",
                    fontSize: "0.72rem",
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    cursor: submitting ? "wait" : "pointer",
                    opacity: submitting ? 0.5 : 1,
                  }}
                >
                  {submitting ? "Creating…" : "Create product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

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

function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  required,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  multiline?: boolean;
}) {
  return (
    <div style={{ display: "grid", gap: "0.4rem" }}>
      <label style={labelStyle}>{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          placeholder={placeholder}
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          placeholder={placeholder}
          style={inputStyle}
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
