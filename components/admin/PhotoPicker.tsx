"use client";

// components/admin/PhotoPicker.tsx
// Modal picker for selecting an existing photo (project or site library) or uploading a new one.
// Returns a PhotoRef to the caller via onSelect.

import { useState } from "react";
import { buildCdnUrl } from "@/lib/cloudflare";
import { toast } from "@/components/ui/Toaster";
import type { PhotoRef } from "@/lib/site-content/types";

interface SiteAssetSummary {
  id: string;
  cloudflareImageId: string;
  label: string;
  altText: string;
}

interface ProjectPhotoSummary {
  photoId: string;
  eventId: string;
  cloudflareImageId: string;
  label: string | null;
  category: string | null;
}

interface PickerData {
  siteAssets: SiteAssetSummary[];
  projectPhotos: ProjectPhotoSummary[];
}

type Tab = "PROJECT" | "SITE" | "UPLOAD";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (ref: PhotoRef) => void;
  initialData: PickerData;
}

export function PhotoPicker({ open, onClose, onSelect, initialData }: Props) {
  const [tab, setTab] = useState<Tab>("PROJECT");
  const [data, setData] = useState<PickerData>(initialData);
  const [uploading, setUploading] = useState(false);
  const [label, setLabel] = useState("");
  const [altText, setAltText] = useState("");

  if (!open) return null;

  const handleUpload = async (file: File) => {
    if (!label.trim() || !altText.trim()) {
      toast("Label and alt text are required for site uploads.");
      return;
    }
    setUploading(true);
    try {
      const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic"];
      if (!allowed.includes(file.type)) {
        toast("Only JPEG, PNG, WebP, or HEIC are allowed.");
        return;
      }
      const presignRes = await fetch("/api/site-assets/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type }),
      });
      if (!presignRes.ok) throw new Error("Presign failed");
      const { presignedUrl, key } = await presignRes.json();

      const putRes = await fetch(presignedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!putRes.ok) throw new Error("R2 PUT failed");

      const confirmRes = await fetch("/api/site-assets/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, label: label.trim(), altText: altText.trim() }),
      });
      if (!confirmRes.ok) throw new Error("Confirm failed");
      const { asset } = await confirmRes.json();

      toast("Uploaded.");
      // Prepend the new asset to local state so reopening the Site tab shows it.
      setData((prev) => ({
        ...prev,
        siteAssets: [
          { id: asset.id, cloudflareImageId: asset.cloudflareImageId, label: asset.label, altText: asset.altText },
          ...prev.siteAssets,
        ],
      }));
      onSelect({
        source: "SITE",
        id: asset.id,
        cloudflareImageId: asset.cloudflareImageId,
        altText: asset.altText,
      });
      setLabel("");
      setAltText("");
    } catch (err) {
      console.error("[PhotoPicker] upload error", err);
      toast("Upload failed. Check console for details.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(42,42,40,0.6)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--white)",
          width: "min(960px, 100%)",
          maxHeight: "90vh",
          overflow: "auto",
          padding: "1.5rem",
          border: "0.5px solid var(--border-strong)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1rem" }}>
          <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.6rem", fontWeight: 300 }}>Choose a photo</h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "transparent", border: "none", fontSize: "0.75rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--charcoal-muted)", cursor: "pointer" }}
          >
            Close
          </button>
        </div>

        <div style={{ display: "flex", gap: "1.5rem", borderBottom: "0.5px solid var(--border)", marginBottom: "1rem" }}>
          {(["PROJECT", "SITE", "UPLOAD"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                background: "transparent",
                border: "none",
                padding: "0.5rem 0",
                borderBottom: tab === t ? "2px solid var(--olive)" : "2px solid transparent",
                fontSize: "0.72rem",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: tab === t ? "var(--charcoal)" : "var(--charcoal-muted)",
                cursor: "pointer",
              }}
            >
              {t === "PROJECT" ? "From projects" : t === "SITE" ? "Site library" : "Upload new"}
            </button>
          ))}
        </div>

        {tab === "PROJECT" && (
          <div>
            {data.projectPhotos.length === 0 ? (
              <EmptyState text="No project photos yet. Upload through an event gallery first." />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.5rem" }}>
                {data.projectPhotos.map((p) => (
                  <PickerThumb
                    key={p.photoId}
                    src={buildCdnUrl(p.cloudflareImageId, "thumbnail")}
                    label={p.label ?? p.category ?? "Photo"}
                    onClick={() =>
                      onSelect({
                        source: "PROJECT",
                        id: p.photoId,
                        cloudflareImageId: p.cloudflareImageId,
                        eventId: p.eventId,
                        altText: p.label ?? "",
                      })
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "SITE" && (
          <div>
            {data.siteAssets.length === 0 ? (
              <EmptyState text="No site assets yet. Upload one under the Upload tab." />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.5rem" }}>
                {data.siteAssets.map((a) => (
                  <PickerThumb
                    key={a.id}
                    src={buildCdnUrl(a.cloudflareImageId, "thumbnail")}
                    label={a.label}
                    onClick={() =>
                      onSelect({
                        source: "SITE",
                        id: a.id,
                        cloudflareImageId: a.cloudflareImageId,
                        altText: a.altText,
                      })
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "UPLOAD" && (
          <div style={{ maxWidth: "32rem" }}>
            <Field label="Label (admin reference)">
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                disabled={uploading}
                placeholder="Home hero — golden hour portrait"
                style={inputStyle}
              />
            </Field>
            <Field label="Alt text (visible to screen readers + SEO)">
              <input
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                disabled={uploading}
                placeholder="A bride and groom embracing in golden evening light."
                style={inputStyle}
              />
            </Field>
            <Field label="Image file (JPEG, PNG, WebP, HEIC)">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                disabled={uploading || !label.trim() || !altText.trim()}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUpload(f);
                }}
                style={{ fontSize: "0.85rem" }}
              />
            </Field>
            {uploading && (
              <p style={{ fontSize: "0.78rem", color: "var(--charcoal-muted)" }}>Uploading…</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PickerThumb({ src, label, onClick }: { src: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "transparent",
        border: "0.5px solid var(--border)",
        padding: 0,
        cursor: "pointer",
        display: "block",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={label} style={{ width: "100%", height: "120px", objectFit: "cover", display: "block" }} />
      <div style={{ padding: "0.4rem 0.5rem", fontSize: "0.72rem", color: "var(--charcoal-light)", textAlign: "left" }}>
        {label}
      </div>
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ padding: "2.5rem 1rem", textAlign: "center", color: "var(--charcoal-muted)", fontSize: "0.85rem" }}>
      {text}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: "1rem" }}>
      <span style={{ display: "block", fontSize: "0.65rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--charcoal-muted)", marginBottom: "0.4rem" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "0.5px solid var(--border)",
  background: "transparent",
  padding: "0.6rem 0.7rem",
  fontSize: "0.9rem",
  color: "var(--charcoal)",
  fontFamily: "inherit",
};
