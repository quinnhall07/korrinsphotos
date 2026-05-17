"use client";

// app/admin/lead-magnets/[id]/LeadMagnetDetailClient.tsx
// Edit form + download log for a single lead magnet.

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { toast } from "@/components/ui/Toaster";
import type { LeadMagnetStatus } from "@/lib/db/lead-magnets";
import {
  updateLeadMagnetAction,
  deleteLeadMagnetAction,
  replaceLeadMagnetFileAction,
} from "../actions";

export interface SerializedLeadMagnet {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: LeadMagnetStatus;
  downloadCount: number;
  followUpSequenceId: string | null;
  coverImageId: string | null;
  downloadFileName: string;
  r2Key: string;
  createdAt: string;
  updatedAt: string;
}

export interface SerializedDownloadRow {
  id: string;
  email: string;
  firstName: string | null;
  firstTouchSource: string | null;
  firstTouchMedium: string | null;
  firstTouchCampaign: string | null;
  createdAt: string;
}

export interface SequenceOption {
  id: string;
  name: string;
  active: boolean;
}

interface Props {
  magnet: SerializedLeadMagnet;
  downloads: SerializedDownloadRow[];
  sequenceOptions: SequenceOption[];
}

export function LeadMagnetDetailClient({
  magnet,
  downloads,
  sequenceOptions,
}: Props) {
  const router = useRouter();

  // Edit form state (initialised from server-rendered doc).
  const [title, setTitle] = useState(magnet.title);
  const [description, setDescription] = useState(magnet.description);
  const [downloadFileName, setDownloadFileName] = useState(magnet.downloadFileName);
  const [status, setStatus] = useState<LeadMagnetStatus>(magnet.status);
  const [followUpSequenceId, setFollowUpSequenceId] = useState<string>(
    magnet.followUpSequenceId ?? ""
  );
  const [coverImageId, setCoverImageId] = useState<string>(magnet.coverImageId ?? "");
  const [saving, setSaving] = useState(false);

  // File-replace state.
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await updateLeadMagnetAction(magnet.id, {
      title,
      description,
      downloadFileName,
      status,
      followUpSequenceId: followUpSequenceId.trim() || null,
      coverImageId: coverImageId.trim() || null,
    });
    setSaving(false);
    if (res.success) {
      toast("Lead magnet updated.");
      router.refresh();
    } else {
      toast(res.error ?? "Update failed.");
    }
  }

  async function handleReplaceFile() {
    if (!replaceFile) {
      toast("Select a file first.");
      return;
    }
    setUploading(true);
    try {
      const res = await replaceLeadMagnetFileAction({
        id: magnet.id,
        fileName: replaceFile.name,
        contentType: replaceFile.type || "application/pdf",
        keepKey: false,
      });
      if (!res.success) {
        toast(res.error ?? "Could not issue upload URL.");
        setUploading(false);
        return;
      }
      const put = await fetch(res.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": replaceFile.type || "application/pdf" },
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

  async function handleDelete() {
    if (!window.confirm(`Delete "${magnet.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    const res = await deleteLeadMagnetAction(magnet.id);
    if (res.success) {
      toast("Lead magnet deleted.");
      router.push("/admin/lead-magnets");
    } else {
      toast(res.error ?? "Delete failed.");
      setDeleting(false);
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
            Lead Magnet
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
            {magnet.title}
          </h1>
          <p
            style={{
              fontFamily: "'Jost', monospace",
              fontSize: "0.78rem",
              color: "var(--charcoal-muted)",
              marginTop: "0.4rem",
            }}
          >
            /magnet/{magnet.slug}
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
            {magnet.downloadCount} downloads
          </span>
          <Link
            href={`/magnet/${magnet.slug}`}
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
            View ↗
          </Link>
        </div>
      </header>

      {/* Edit form */}
      <form onSubmit={handleSave} style={{ display: "grid", gap: "1rem", maxWidth: "44rem" }}>
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

        <Field label="Slug (immutable)" value={magnet.slug} disabled />
        <Field label="Title" value={title} onChange={setTitle} required />
        <Field
          label="Description"
          value={description}
          onChange={setDescription}
          required
          multiline
        />
        <Field
          label="Download file name"
          value={downloadFileName}
          onChange={setDownloadFileName}
          required
        />

        <div style={{ display: "grid", gap: "0.4rem" }}>
          <label style={labelStyle}>Status</label>
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
          <label style={labelStyle}>Follow-up sequence</label>
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

        <Field
          label="Cover image (Cloudflare Images ID, optional)"
          value={coverImageId}
          onChange={setCoverImageId}
          placeholder="abc123-xyz"
          hint="The bare image ID — the page uses buildCdnUrl()."
        />

        <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
          <button
            type="submit"
            disabled={saving}
            style={primaryButtonStyle(saving)}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
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
          Replace file
        </h2>
        <p style={{ fontSize: "0.85rem", color: "var(--charcoal-light)" }}>
          Current key: <code style={{ fontSize: "0.78rem" }}>{magnet.r2Key}</code>
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
            accept="application/pdf,.pdf"
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

      {/* Download log */}
      <section>
        <h2
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "1.5rem",
            fontWeight: 300,
            color: "var(--charcoal)",
            marginBottom: "1rem",
          }}
        >
          Recent downloads
          <span
            style={{
              fontSize: "0.72rem",
              color: "var(--charcoal-muted)",
              marginLeft: "0.75rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            ({downloads.length} most recent)
          </span>
        </h2>
        {downloads.length === 0 ? (
          <p
            style={{
              padding: "1.5rem",
              border: "0.5px dashed var(--border-strong)",
              color: "var(--charcoal-muted)",
              fontFamily: "'Jost', sans-serif",
              fontSize: "0.88rem",
            }}
          >
            No downloads yet.
          </p>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontFamily: "'Jost', sans-serif",
              fontSize: "0.85rem",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "0.5px solid var(--border-strong)" }}>
                {["When", "Email", "Name", "Source", "Medium", "Campaign"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "0.75rem 0.5rem",
                      fontSize: "0.62rem",
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
              {downloads.map((d) => (
                <tr
                  key={d.id}
                  style={{ borderBottom: "0.5px solid var(--border)" }}
                >
                  <td
                    style={{
                      padding: "0.7rem 0.5rem",
                      color: "var(--charcoal-light)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {d.createdAt}
                  </td>
                  <td style={{ padding: "0.7rem 0.5rem", color: "var(--charcoal)" }}>
                    {d.email}
                  </td>
                  <td
                    style={{
                      padding: "0.7rem 0.5rem",
                      color: "var(--charcoal-light)",
                    }}
                  >
                    {d.firstName ?? "—"}
                  </td>
                  <td style={{ padding: "0.7rem 0.5rem", color: "var(--charcoal-light)" }}>
                    {d.firstTouchSource ?? "—"}
                  </td>
                  <td style={{ padding: "0.7rem 0.5rem", color: "var(--charcoal-light)" }}>
                    {d.firstTouchMedium ?? "—"}
                  </td>
                  <td style={{ padding: "0.7rem 0.5rem", color: "var(--charcoal-light)" }}>
                    {d.firstTouchCampaign ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  multiline?: boolean;
  disabled?: boolean;
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
          rows={3}
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
