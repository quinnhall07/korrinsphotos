"use client";

// app/admin/journal/[id]/JournalEditorClient.tsx
// Full journal-post editor. Plain <input>/<textarea> fields — no rich text
// editor. Korrin types HTML directly into `bodyHtml`. Server Actions handle
// every mutation; the form posts the full patch on save.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toaster";
import { buildCdnUrl } from "@/lib/cloudflare";
import type { JournalPostStatus } from "@/lib/db/journal-posts";
import type { VendorCategory } from "@/lib/db/vendors";
import {
  deleteJournalPostAction,
  publishJournalPostAction,
  redraftJournalPostFromProjectAction,
  unpublishJournalPostAction,
  updateJournalPostAction,
} from "../actions";

export interface ProjectPhotoOption {
  cloudflareImageId: string;
  label: string | null;
}

export interface VendorOption {
  id: string;
  name: string;
  category: VendorCategory;
}

export interface SerializedJournalPost {
  id: string;
  slug: string;
  status: JournalPostStatus;
  projectId: string;
  clientId: string;
  title: string;
  subtitle: string;
  heroPhotoCloudflareId: string | null;
  photoCloudflareIds: string[];
  vendorIds: string[];
  locationName: string;
  city: string;
  bodyHtml: string;
  seoTitle: string;
  seoDescription: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  post: SerializedJournalPost;
  photoOptions: ProjectPhotoOption[];
  vendorOptions: VendorOption[];
}

export function JournalEditorClient({ post, photoOptions, vendorOptions }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(post.title);
  const [subtitle, setSubtitle] = useState(post.subtitle);
  const [slug, setSlug] = useState(post.slug);
  const [heroPhotoCloudflareId, setHeroId] = useState<string>(
    post.heroPhotoCloudflareId ?? ""
  );
  const [heroInput, setHeroInput] = useState<string>("");
  const [photos, setPhotos] = useState<string[]>([...post.photoCloudflareIds]);
  const [vendorIds, setVendorIds] = useState<string[]>([...post.vendorIds]);
  const [locationName, setLocationName] = useState(post.locationName);
  const [city, setCity] = useState(post.city);
  const [bodyHtml, setBodyHtml] = useState(post.bodyHtml);
  const [seoTitle, setSeoTitle] = useState(post.seoTitle);
  const [seoDescription, setSeoDescription] = useState(post.seoDescription);

  const slugLocked = post.status === "PUBLISHED";

  const runAction = (
    fn: () => Promise<{ success: boolean; error?: string }>,
    okMessage: string
  ) => {
    startTransition(async () => {
      const res = await fn();
      if (res.success) {
        toast(okMessage);
        router.refresh();
      } else {
        toast(res.error ?? "Action failed.");
      }
    });
  };

  const onSave = () => {
    startTransition(async () => {
      const res = await updateJournalPostAction(post.id, {
        title,
        subtitle: subtitle.trim().length > 0 ? subtitle : null,
        slug: slugLocked ? undefined : slug,
        heroPhotoCloudflareId:
          heroPhotoCloudflareId.trim().length > 0
            ? heroPhotoCloudflareId.trim()
            : null,
        photoCloudflareIds: photos,
        bodyHtml,
        seoTitle: seoTitle.trim().length > 0 ? seoTitle : null,
        seoDescription: seoDescription.trim().length > 0 ? seoDescription : null,
        locationName: locationName.trim().length > 0 ? locationName : null,
        city: city.trim().length > 0 ? city : null,
        vendorIds,
      });
      if (res.success) {
        toast("Saved.");
        if (res.slug && res.slug !== slug) setSlug(res.slug);
        router.refresh();
      } else {
        toast(res.error ?? "Save failed.");
      }
    });
  };

  // ─── Photo controls ─────────────────────────────────────────────────────────

  const removePhotoAt = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const movePhoto = (idx: number, dir: -1 | 1) => {
    setPhotos((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const addPhotoFromHero = () => {
    if (!heroInput.trim()) return;
    if (photos.includes(heroInput.trim())) {
      toast("Already in the post.");
      return;
    }
    setPhotos((prev) => [...prev, heroInput.trim()]);
    setHeroInput("");
  };

  const toggleVendor = (id: string) => {
    setVendorIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  return (
    <div style={{ maxWidth: "960px" }}>
      {/* Header + status row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "2rem",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p
            style={{
              fontSize: "0.65rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--olive)",
              marginBottom: "0.3rem",
            }}
          >
            Editor · {post.status}
          </p>
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "1.8rem",
              fontWeight: 300,
            }}
          >
            {title || "Untitled"}
          </h2>
          <p style={{ fontSize: "0.7rem", color: "var(--charcoal-muted)", marginTop: "0.3rem" }}>
            Created {post.createdAt} · Updated {post.updatedAt}
            {post.publishedAt ? ` · Published ${post.publishedAt}` : ""}
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button type="button" disabled={isPending} onClick={onSave} style={btnPrimary}>
            Save changes
          </button>
          {post.status === "PUBLISHED" ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                runAction(
                  () => unpublishJournalPostAction(post.id),
                  "Moved back to draft."
                )
              }
              style={btnSecondary}
            >
              Unpublish
            </button>
          ) : (
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                runAction(
                  () => publishJournalPostAction(post.id),
                  "Published."
                )
              }
              style={btnSecondary}
            >
              Publish
            </button>
          )}
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              if (
                !confirm(
                  "Redraft auto-fields from the source project? This refreshes photos, vendors, location, city, and SEO meta. Your title, subtitle, body, slug, and status will NOT be touched."
                )
              ) {
                return;
              }
              runAction(
                () => redraftJournalPostFromProjectAction(post.id),
                "Auto-fields refreshed."
              );
            }}
            style={btnSecondary}
          >
            Redraft from project
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              if (
                !confirm(`Delete this post permanently? This cannot be undone.`)
              ) {
                return;
              }
              startTransition(async () => {
                const res = await deleteJournalPostAction(post.id);
                if (res.success) {
                  toast("Deleted.");
                  router.push("/admin/journal");
                } else {
                  toast(res.error ?? "Delete failed.");
                }
              });
            }}
            style={btnDanger}
          >
            Delete
          </button>
        </div>
      </div>

      {/* Core fields */}
      <Section label="Title">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={fieldStyle}
        />
      </Section>

      <Section label="Subtitle">
        <input
          type="text"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          style={fieldStyle}
          placeholder="Optional — italic kicker beneath the title."
        />
      </Section>

      <Section label={`Slug ${slugLocked ? "(locked — post is published)" : ""}`}>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          disabled={slugLocked}
          style={{ ...fieldStyle, opacity: slugLocked ? 0.6 : 1 }}
        />
        <p style={helperText}>Public URL: /journal/{slug}</p>
      </Section>

      <Section label="Location & city">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <input
            type="text"
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            placeholder="Venue / location name"
            style={fieldStyle}
          />
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City"
            style={fieldStyle}
          />
        </div>
      </Section>

      {/* Hero photo */}
      <Section label="Hero photo">
        {heroPhotoCloudflareId ? (
          <div style={{ marginBottom: "0.75rem" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={buildCdnUrl(heroPhotoCloudflareId, "thumbnail")}
              alt="Hero preview"
              style={{
                width: "180px",
                height: "180px",
                objectFit: "cover",
                border: "0.5px solid var(--border)",
              }}
            />
          </div>
        ) : (
          <p style={helperText}>No hero image set — the first photo in the stack will be used.</p>
        )}
        <input
          type="text"
          value={heroPhotoCloudflareId}
          onChange={(e) => setHeroId(e.target.value)}
          placeholder="Paste a Cloudflare image id"
          style={fieldStyle}
        />
        {photoOptions.length > 0 ? (
          <div style={{ marginTop: "0.5rem" }}>
            <label style={helperText}>Or pick from this project&apos;s gallery</label>
            <select
              value={heroPhotoCloudflareId}
              onChange={(e) => setHeroId(e.target.value)}
              style={fieldStyle}
            >
              <option value="">— select —</option>
              {photoOptions.map((p) => (
                <option key={p.cloudflareImageId} value={p.cloudflareImageId}>
                  {p.label ?? p.cloudflareImageId.slice(0, 12)}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </Section>

      {/* Photo stack */}
      <Section label={`Photos (${photos.length})`}>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <input
            type="text"
            value={heroInput}
            onChange={(e) => setHeroInput(e.target.value)}
            placeholder="Add by Cloudflare image id"
            style={fieldStyle}
          />
          <button type="button" onClick={addPhotoFromHero} style={btnSecondary}>
            Add
          </button>
        </div>
        {photoOptions.length > 0 ? (
          <select
            value=""
            onChange={(e) => {
              const id = e.target.value;
              if (!id) return;
              if (photos.includes(id)) {
                toast("Already in the post.");
                return;
              }
              setPhotos((prev) => [...prev, id]);
            }}
            style={{ ...fieldStyle, marginBottom: "0.75rem" }}
          >
            <option value="">+ add from project gallery…</option>
            {photoOptions.map((p) => (
              <option key={p.cloudflareImageId} value={p.cloudflareImageId}>
                {p.label ?? p.cloudflareImageId.slice(0, 12)}
              </option>
            ))}
          </select>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: "0.75rem",
          }}
        >
          {photos.map((id, idx) => (
            <div
              key={`${id}-${idx}`}
              style={{ border: "0.5px solid var(--border)", padding: "0.5rem" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={buildCdnUrl(id, "thumbnail")}
                alt={`Photo ${idx + 1}`}
                style={{
                  width: "100%",
                  height: "120px",
                  objectFit: "cover",
                  display: "block",
                }}
              />
              <p
                style={{
                  fontSize: "0.65rem",
                  color: "var(--charcoal-muted)",
                  marginTop: "0.4rem",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {idx + 1}. {id.slice(0, 10)}…
              </p>
              <div style={{ display: "flex", gap: "0.25rem", marginTop: "0.4rem" }}>
                <button
                  type="button"
                  onClick={() => movePhoto(idx, -1)}
                  disabled={idx === 0}
                  style={tinyBtn}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => movePhoto(idx, 1)}
                  disabled={idx === photos.length - 1}
                  style={tinyBtn}
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removePhotoAt(idx)}
                  style={{ ...tinyBtn, color: "#991B1B" }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Vendors */}
      <Section label={`Vendors (${vendorIds.length}/${vendorOptions.length})`}>
        {vendorOptions.length === 0 ? (
          <p style={helperText}>No vendors in the network yet.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "0.5rem",
            }}
          >
            {vendorOptions.map((v) => {
              const checked = vendorIds.includes(v.id);
              return (
                <label
                  key={v.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.4rem 0.6rem",
                    border: "0.5px solid var(--border)",
                    background: checked ? "rgba(107,120,69,0.06)" : "var(--white)",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleVendor(v.id)}
                  />
                  <span>
                    {v.name}
                    <span style={{ color: "var(--charcoal-muted)", marginLeft: "0.4rem" }}>
                      ({v.category.toLowerCase()})
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </Section>

      {/* Body HTML */}
      <Section label="Body (HTML)">
        <textarea
          value={bodyHtml}
          onChange={(e) => setBodyHtml(e.target.value)}
          rows={20}
          style={{
            ...fieldStyle,
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: "0.82rem",
            lineHeight: 1.6,
          }}
          placeholder="<p>Write the long-form story here. HTML allowed.</p>"
        />
        <p style={helperText}>
          You can paste raw HTML. The public page renders this with
          dangerouslySetInnerHTML — keep tags clean.
        </p>
      </Section>

      {/* SEO */}
      <Section label="SEO meta">
        <input
          type="text"
          value={seoTitle}
          onChange={(e) => setSeoTitle(e.target.value)}
          placeholder="<title> tag"
          style={fieldStyle}
        />
        <textarea
          value={seoDescription}
          onChange={(e) => setSeoDescription(e.target.value)}
          rows={3}
          placeholder="<meta name='description'> content"
          style={{ ...fieldStyle, marginTop: "0.5rem" }}
        />
      </Section>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: "2rem" }}>
      <p
        style={{
          fontSize: "0.62rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--charcoal-muted)",
          marginBottom: "0.5rem",
        }}
      >
        {label}
      </p>
      {children}
    </section>
  );
}

const fieldStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "0.7rem 0.9rem",
  fontSize: "0.88rem",
  fontFamily: "'Jost', sans-serif",
  background: "var(--white)",
  border: "0.5px solid var(--border-strong)",
  color: "var(--charcoal)",
};

const helperText: React.CSSProperties = {
  fontSize: "0.7rem",
  color: "var(--charcoal-muted)",
  marginTop: "0.35rem",
};

const btnPrimary: React.CSSProperties = {
  padding: "0.7rem 1.6rem",
  fontSize: "0.7rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  background: "var(--olive)",
  color: "var(--white)",
  border: "0.5px solid var(--olive)",
  cursor: "pointer",
  fontFamily: "'Jost', sans-serif",
};

const btnSecondary: React.CSSProperties = {
  padding: "0.7rem 1.4rem",
  fontSize: "0.7rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  background: "var(--white)",
  color: "var(--charcoal)",
  border: "0.5px solid var(--border-strong)",
  cursor: "pointer",
  fontFamily: "'Jost', sans-serif",
};

const btnDanger: React.CSSProperties = {
  ...btnSecondary,
  color: "#991B1B",
  border: "0.5px solid #FCA5A5",
};

const tinyBtn: React.CSSProperties = {
  flex: 1,
  padding: "0.25rem 0.3rem",
  fontSize: "0.7rem",
  background: "var(--white)",
  border: "0.5px solid var(--border)",
  cursor: "pointer",
  fontFamily: "'Jost', sans-serif",
};
