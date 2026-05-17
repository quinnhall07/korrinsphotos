"use client";

// app/admin/lead-magnets/LeadMagnetsListClientPage.tsx
// Lead-magnet admin list with a "+ New magnet" modal that issues a presigned
// R2 PUT URL on submit and uploads the file directly to R2 from the browser.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/components/ui/Toaster";
import { createLeadMagnetAction } from "./actions";
import type { LeadMagnetStatus } from "@/lib/db/lead-magnets";

export interface SerializedLeadMagnetRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: LeadMagnetStatus;
  downloadCount: number;
  followUpSequenceId: string | null;
  downloadFileName: string;
  createdAt: string;
  updatedAt: string;
}

export interface SequenceOption {
  id: string;
  name: string;
  active: boolean;
}

interface Props {
  rows: SerializedLeadMagnetRow[];
  sequenceOptions: SequenceOption[];
}

function statusColor(s: LeadMagnetStatus): { bg: string; fg: string } {
  switch (s) {
    case "ACTIVE":
      return { bg: "var(--olive-dim)", fg: "var(--olive)" };
    case "DRAFT":
      return { bg: "rgba(42,42,40,0.06)", fg: "var(--charcoal-light)" };
    case "ARCHIVED":
      return { bg: "rgba(42,42,40,0.04)", fg: "var(--charcoal-muted)" };
  }
}

export function LeadMagnetsListClientPage({ rows, sequenceOptions }: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [downloadFileName, setDownloadFileName] = useState("");
  const [status, setStatus] = useState<LeadMagnetStatus>("DRAFT");
  const [followUpSequenceId, setFollowUpSequenceId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setSlug("");
    setTitle("");
    setDescription("");
    setDownloadFileName("");
    setStatus("DRAFT");
    setFollowUpSequenceId("");
    setFile(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const fileName = downloadFileName.trim() || file?.name || "guide.pdf";
      const res = await createLeadMagnetAction({
        slug,
        title,
        description,
        downloadFileName: fileName,
        status,
        followUpSequenceId: followUpSequenceId.trim() || null,
        contentType: file?.type || "application/pdf",
      });

      if (!res.success) {
        toast(res.error);
        setSubmitting(false);
        return;
      }

      // Upload the file directly to R2 if provided. We do not block on success
      // — admin can replace the file later from the detail page.
      if (file) {
        try {
          const put = await fetch(res.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": file.type || "application/pdf" },
            body: file,
          });
          if (!put.ok) {
            toast(`Magnet created, but upload failed (${put.status}).`);
          } else {
            toast("Magnet created and file uploaded.");
          }
        } catch {
          toast("Magnet created, but upload failed.");
        }
      } else {
        toast("Magnet created. Upload a file from the detail page.");
      }

      resetForm();
      setCreating(false);
      router.push(`/admin/lead-magnets/${res.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to create magnet.");
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
            Content / Acquisition
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
            Lead magnets
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
            Gated downloads that trade for an email + first-touch attribution and
            auto-enroll the visitor into a follow-up sequence.
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
          + New magnet
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
          No lead magnets yet. Create one to start capturing emails behind a
          gated download.
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
              {["Title", "Slug", "Status", "Downloads", "Sequence", ""].map((h) => (
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
              const seq = sequenceOptions.find((s) => s.id === r.followUpSequenceId);
              return (
                <tr
                  key={r.id}
                  style={{ borderBottom: "0.5px solid var(--border)" }}
                >
                  <td style={{ padding: "1rem 0.75rem" }}>
                    <Link
                      href={`/admin/lead-magnets/${r.id}`}
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
                      {r.description}
                    </div>
                  </td>
                  <td
                    style={{
                      padding: "1rem 0.75rem",
                      color: "var(--charcoal-light)",
                      fontFamily: "'Jost', monospace",
                      fontSize: "0.8rem",
                    }}
                  >
                    /magnet/{r.slug}
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
                    {r.downloadCount}
                  </td>
                  <td
                    style={{
                      padding: "1rem 0.75rem",
                      color: "var(--charcoal-light)",
                    }}
                  >
                    {seq ? (
                      <Link
                        href={`/admin/sequences/${seq.id}`}
                        style={{ color: "var(--olive)", textDecoration: "none" }}
                      >
                        {seq.name}
                      </Link>
                    ) : (
                      <span style={{ color: "var(--charcoal-muted)" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "1rem 0.75rem", textAlign: "right" }}>
                    <Link
                      href={`/magnet/${r.slug}`}
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
              New lead magnet
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
            </p>

            <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
              <Field
                label="Slug (URL)"
                value={slug}
                onChange={setSlug}
                required
                placeholder="pricing-guide"
                hint={`Will publish at /magnet/${slug || "your-slug"}`}
              />
              <Field
                label="Title"
                value={title}
                onChange={setTitle}
                required
                placeholder="Korrin's Pricing Guide"
              />
              <Field
                label="Description"
                value={description}
                onChange={setDescription}
                required
                placeholder="Packages, pricing, what's included."
                multiline
              />
              <Field
                label="Download file name"
                value={downloadFileName}
                onChange={setDownloadFileName}
                required
                placeholder="Korrins-Pricing-Guide-2026.pdf"
                hint="Shown to the user when the file lands."
              />

              <div style={{ display: "grid", gap: "0.4rem" }}>
                <label
                  style={{
                    fontSize: "0.65rem",
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    color: "var(--charcoal-muted)",
                  }}
                >
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as LeadMagnetStatus)}
                  style={inputStyle}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>

              <div style={{ display: "grid", gap: "0.4rem" }}>
                <label
                  style={{
                    fontSize: "0.65rem",
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    color: "var(--charcoal-muted)",
                  }}
                >
                  Follow-up sequence (optional)
                </label>
                <select
                  value={followUpSequenceId}
                  onChange={(e) => setFollowUpSequenceId(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">— None —</option>
                  {sequenceOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.active ? "" : "(inactive)"}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gap: "0.4rem" }}>
                <label
                  style={{
                    fontSize: "0.65rem",
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    color: "var(--charcoal-muted)",
                  }}
                >
                  File (optional — can upload later)
                </label>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
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
                  {submitting ? "Creating…" : "Create magnet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

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
      <label
        style={{
          fontSize: "0.65rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--charcoal-muted)",
        }}
      >
        {label}
      </label>
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
