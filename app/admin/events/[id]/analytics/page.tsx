// app/admin/events/[id]/analytics/page.tsx
// Phase 13.10 — Per-event client-gallery analytics.
//
// Server Component. Reads every photo in `events/{id}/photos` (no
// `galleryReady` filter — we want the full picture, including unpublished),
// computes the headline tiles, and renders a Pareto bar list, top-favorites,
// top-views, and download-conversion lists. Editorial styling matches
// `/admin/reports/finance` (Cormorant heading, generous whitespace, 0.5px
// borders, hand-rolled SVG/HTML — no chart library).

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { adminDb } from "@/lib/firebase-admin";
import { buildCdnUrl } from "@/lib/cloudflare";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const doc = await adminDb.collection("events").doc(id).get();
  const title = doc.exists ? (doc.data()!.title as string) : "Event";
  return { title: `Analytics — ${title} | Admin` };
}

interface PhotoStat {
  id: string;
  cloudflareImageId: string | null;
  label: string | null;
  viewCount: number;
  downloadCount: number;
  favoriteCount: number;
}

async function getEventStats(eventId: string): Promise<{
  eventTitle: string;
  photos: PhotoStat[];
} | null> {
  const eventDoc = await adminDb.collection("events").doc(eventId).get();
  if (!eventDoc.exists) return null;
  const eventTitle = (eventDoc.data()!.title as string) ?? "Event";

  const snap = await adminDb
    .collection("events")
    .doc(eventId)
    .collection("photos")
    .get();

  const photos: PhotoStat[] = snap.docs.map((d) => {
    const data = d.data();
    const favoritedBy = (data.favoritedBy as string[] | undefined) ?? [];
    return {
      id: d.id,
      cloudflareImageId: (data.cloudflareImageId as string | undefined) ?? null,
      label: (data.label as string | undefined) ?? null,
      viewCount: (data.viewCount as number | undefined) ?? 0,
      downloadCount: (data.downloadCount as number | undefined) ?? 0,
      favoriteCount: favoritedBy.length,
    };
  });

  return { eventTitle, photos };
}

export default async function EventAnalyticsPage({ params }: Props) {
  const { id } = await params;
  await requireAdmin();

  const data = await getEventStats(id);
  if (!data) notFound();

  const { eventTitle, photos } = data;

  // ---- Headline aggregates ------------------------------------------------
  const totalViews = photos.reduce((sum, p) => sum + p.viewCount, 0);
  const totalDownloads = photos.reduce((sum, p) => sum + p.downloadCount, 0);
  const totalFavorites = photos.reduce((sum, p) => sum + p.favoriteCount, 0);
  const photosWithViews = photos.filter((p) => p.viewCount > 0).length;
  const uniqueViewerPct =
    photos.length > 0 ? (photosWithViews / photos.length) * 100 : 0;

  // ---- Pareto: cumulative-view share by photo -----------------------------
  const sortedByViews = [...photos].sort((a, b) => b.viewCount - a.viewCount);
  const cumulative: Array<{
    photo: PhotoStat;
    cumulativePct: number;
    sharePct: number;
  }> = [];
  let runningViews = 0;
  for (const p of sortedByViews) {
    runningViews += p.viewCount;
    cumulative.push({
      photo: p,
      cumulativePct: totalViews > 0 ? (runningViews / totalViews) * 100 : 0,
      sharePct: totalViews > 0 ? (p.viewCount / totalViews) * 100 : 0,
    });
  }
  // "X% of photos drove Y% of views" headline — find the smallest prefix that
  // crosses 80%.
  let paretoPhotosPct = 0;
  let paretoViewsPct = 0;
  if (totalViews > 0 && cumulative.length > 0) {
    let i = 0;
    while (i < cumulative.length && cumulative[i].cumulativePct < 80) i++;
    const cutoff = Math.min(i + 1, cumulative.length);
    paretoPhotosPct = (cutoff / cumulative.length) * 100;
    paretoViewsPct = cumulative[cutoff - 1]?.cumulativePct ?? 0;
  }

  // ---- Top-N lists --------------------------------------------------------
  const topFavorites = [...photos]
    .filter((p) => p.favoriteCount > 0)
    .sort((a, b) => b.favoriteCount - a.favoriteCount)
    .slice(0, 10);
  const topViews = sortedByViews.filter((p) => p.viewCount > 0).slice(0, 10);
  const conversion = photos
    .filter((p) => p.viewCount >= 10)
    .map((p) => ({
      photo: p,
      ratio: p.downloadCount / p.viewCount,
    }))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 10);

  return (
    <div className="page-fade-in" style={{ padding: "2rem", maxWidth: 1400, margin: "0 auto" }}>
      {/* Breadcrumb + heading */}
      <div style={{ marginBottom: "2rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "0.78rem",
            color: "var(--charcoal-muted)",
            marginBottom: "0.75rem",
          }}
        >
          <Link href="/admin/events" style={{ color: "var(--charcoal-muted)", textDecoration: "none" }}>
            Events
          </Link>
          <span>/</span>
          <Link
            href={`/admin/events/${id}`}
            style={{ color: "var(--charcoal-muted)", textDecoration: "none" }}
          >
            {eventTitle}
          </Link>
          <span>/</span>
          <span style={{ color: "var(--charcoal)" }}>Analytics</span>
        </div>
        <p
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--olive)",
            marginBottom: "0.25rem",
          }}
        >
          Gallery Analytics
        </p>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontWeight: 300,
            fontSize: "2.4rem",
            margin: 0,
            color: "var(--charcoal)",
          }}
        >
          {eventTitle}
        </h1>
        <p
          style={{
            fontSize: "0.78rem",
            color: "var(--charcoal-muted)",
            marginTop: "0.5rem",
          }}
        >
          {photos.length} photo{photos.length === 1 ? "" : "s"} tracked. Views are a
          popularity proxy — small over-counts from re-mounts are expected.
        </p>
      </div>

      {/* Top-line tiles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1px",
          background: "var(--border)",
          border: "0.5px solid var(--border)",
          marginBottom: "2rem",
        }}
      >
        <KpiTile label="Total Views" value={totalViews.toLocaleString()} />
        <KpiTile label="Total Favorites" value={totalFavorites.toLocaleString()} />
        <KpiTile label="Total Downloads" value={totalDownloads.toLocaleString()} />
        <KpiTile
          label="Photos Viewed"
          value={`${uniqueViewerPct.toFixed(0)}%`}
          hint={`${photosWithViews} of ${photos.length} photos got at least one view`}
        />
      </div>

      {/* Pareto */}
      <Section
        eyebrow="Pareto"
        title="Concentration of attention"
        subtitle={
          totalViews === 0
            ? "No views recorded yet."
            : `${paretoPhotosPct.toFixed(0)}% of photos drove ${paretoViewsPct.toFixed(0)}% of views.`
        }
      >
        {cumulative.length === 0 ? (
          <EmptyHint text="Once viewers open this gallery, the distribution will appear here." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {cumulative.slice(0, 25).map((entry, i) => (
              <ParetoRow
                key={entry.photo.id}
                rank={i + 1}
                label={entry.photo.label ?? entry.photo.id.slice(0, 8)}
                viewCount={entry.photo.viewCount}
                sharePct={entry.sharePct}
                cumulativePct={entry.cumulativePct}
              />
            ))}
            {cumulative.length > 25 && (
              <p
                style={{
                  fontSize: "0.7rem",
                  color: "var(--charcoal-muted)",
                  margin: "0.5rem 0 0",
                }}
              >
                Showing top 25 of {cumulative.length}.
              </p>
            )}
          </div>
        )}
      </Section>

      {/* Two columns: top favorites + top views */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
          gap: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        <Section eyebrow="Most loved" title="Top 10 by favorites" embedded>
          {topFavorites.length === 0 ? (
            <EmptyHint text="No favorites recorded yet." />
          ) : (
            <PhotoStatList rows={topFavorites} primaryField="favoriteCount" />
          )}
        </Section>

        <Section eyebrow="Most viewed" title="Top 10 by views" embedded>
          {topViews.length === 0 ? (
            <EmptyHint text="No views recorded yet." />
          ) : (
            <PhotoStatList rows={topViews} primaryField="viewCount" />
          )}
        </Section>
      </div>

      {/* Download conversion */}
      <Section
        eyebrow="Conversion"
        title="Download rate (≥ 10 views)"
        subtitle="Percentage of viewers who downloaded each photo. Photos with fewer than 10 views are excluded."
      >
        {conversion.length === 0 ? (
          <EmptyHint text="No photos have crossed 10 views yet." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {conversion.map(({ photo, ratio }, i) => (
              <ConversionRow
                key={photo.id}
                rank={i + 1}
                photo={photo}
                ratio={ratio}
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ---------- Subcomponents ---------------------------------------------------

function KpiTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div
      style={{
        padding: "1rem 1.1rem",
        background: "var(--white)",
        display: "flex",
        flexDirection: "column",
        gap: "0.4rem",
        minHeight: 96,
      }}
    >
      <p
        style={{
          fontSize: "0.6rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--charcoal-muted)",
          margin: 0,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontWeight: 400,
          fontSize: "1.7rem",
          color: "var(--charcoal)",
          margin: 0,
          lineHeight: 1.1,
        }}
      >
        {value}
      </p>
      {hint && (
        <p style={{ fontSize: "0.65rem", color: "var(--charcoal-muted)", margin: 0, lineHeight: 1.3 }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function Section({
  eyebrow,
  title,
  subtitle,
  embedded,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  embedded?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        border: "0.5px solid var(--border)",
        background: "var(--white)",
        padding: "1.4rem 1.5rem",
        marginBottom: embedded ? 0 : "2rem",
      }}
    >
      <p
        style={{
          fontSize: "0.6rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--olive)",
          margin: 0,
        }}
      >
        {eyebrow}
      </p>
      <h2
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontWeight: 300,
          fontSize: "1.5rem",
          margin: "0.25rem 0 0.4rem",
          color: "var(--charcoal)",
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          style={{
            fontSize: "0.78rem",
            color: "var(--charcoal-muted)",
            marginBottom: "1rem",
          }}
        >
          {subtitle}
        </p>
      )}
      <div style={{ marginTop: subtitle ? 0 : "0.75rem" }}>{children}</div>
    </section>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <p
      style={{
        fontSize: "0.82rem",
        color: "var(--charcoal-muted)",
        fontStyle: "italic",
        margin: 0,
      }}
    >
      {text}
    </p>
  );
}

function ParetoRow({
  rank,
  label,
  viewCount,
  sharePct,
  cumulativePct,
}: {
  rank: number;
  label: string;
  viewCount: number;
  sharePct: number;
  cumulativePct: number;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 60px 90px", gap: "0.75rem", alignItems: "center" }}>
      <span style={{ fontSize: "0.7rem", color: "var(--charcoal-muted)" }}>
        #{rank}
      </span>
      <div>
        <p
          style={{
            fontSize: "0.8rem",
            color: "var(--charcoal)",
            margin: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </p>
        <div
          style={{
            position: "relative",
            height: "6px",
            background: "var(--border)",
            marginTop: "0.25rem",
          }}
        >
          {/* Cumulative line behind the bar (ghost). */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              width: `${cumulativePct}%`,
              background: "rgba(107,120,69,0.18)",
            }}
          />
          {/* This row's share. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              width: `${sharePct}%`,
              background: "var(--olive)",
            }}
          />
        </div>
      </div>
      <span style={{ fontSize: "0.78rem", color: "var(--charcoal)", textAlign: "right" }}>
        {viewCount.toLocaleString()}
      </span>
      <span style={{ fontSize: "0.7rem", color: "var(--charcoal-muted)", textAlign: "right" }}>
        {cumulativePct.toFixed(0)}% cum.
      </span>
    </div>
  );
}

function PhotoStatList({
  rows,
  primaryField,
}: {
  rows: PhotoStat[];
  primaryField: "favoriteCount" | "viewCount";
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      {rows.map((p, i) => (
        <PhotoStatRow key={p.id} rank={i + 1} photo={p} highlight={primaryField} />
      ))}
    </div>
  );
}

function PhotoStatRow({
  rank,
  photo,
  highlight,
}: {
  rank: number;
  photo: PhotoStat;
  highlight: "favoriteCount" | "viewCount";
}) {
  const thumb = photo.cloudflareImageId
    ? buildCdnUrl(photo.cloudflareImageId, "thumbnail")
    : null;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "32px 56px 1fr auto",
        gap: "0.75rem",
        alignItems: "center",
        padding: "0.4rem 0",
        borderBottom: "0.5px solid var(--border)",
      }}
    >
      <span style={{ fontSize: "0.7rem", color: "var(--charcoal-muted)" }}>
        #{rank}
      </span>
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumb}
          alt={photo.label ?? ""}
          width={56}
          height={56}
          style={{ width: 56, height: 56, objectFit: "cover", display: "block" }}
        />
      ) : (
        <div style={{ width: 56, height: 56, background: "var(--border)" }} />
      )}
      <div style={{ minWidth: 0 }}>
        <p
          style={{
            fontSize: "0.8rem",
            color: "var(--charcoal)",
            margin: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {photo.label ?? photo.id.slice(0, 8)}
        </p>
        <p
          style={{
            fontSize: "0.7rem",
            color: "var(--charcoal-muted)",
            margin: "0.15rem 0 0",
          }}
        >
          {photo.viewCount.toLocaleString()} view{photo.viewCount === 1 ? "" : "s"} ·{" "}
          {photo.favoriteCount.toLocaleString()} favorite
          {photo.favoriteCount === 1 ? "" : "s"} ·{" "}
          {photo.downloadCount.toLocaleString()} download
          {photo.downloadCount === 1 ? "" : "s"}
        </p>
      </div>
      <span
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "1.4rem",
          color: "var(--olive)",
          textAlign: "right",
        }}
      >
        {highlight === "favoriteCount"
          ? photo.favoriteCount.toLocaleString()
          : photo.viewCount.toLocaleString()}
      </span>
    </div>
  );
}

function ConversionRow({
  rank,
  photo,
  ratio,
}: {
  rank: number;
  photo: PhotoStat;
  ratio: number;
}) {
  const pct = ratio * 100;
  const thumb = photo.cloudflareImageId
    ? buildCdnUrl(photo.cloudflareImageId, "thumbnail")
    : null;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "32px 56px 1fr 80px",
        gap: "0.75rem",
        alignItems: "center",
        padding: "0.4rem 0",
        borderBottom: "0.5px solid var(--border)",
      }}
    >
      <span style={{ fontSize: "0.7rem", color: "var(--charcoal-muted)" }}>
        #{rank}
      </span>
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumb}
          alt={photo.label ?? ""}
          width={56}
          height={56}
          style={{ width: 56, height: 56, objectFit: "cover", display: "block" }}
        />
      ) : (
        <div style={{ width: 56, height: 56, background: "var(--border)" }} />
      )}
      <div style={{ minWidth: 0 }}>
        <p
          style={{
            fontSize: "0.8rem",
            color: "var(--charcoal)",
            margin: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {photo.label ?? photo.id.slice(0, 8)}
        </p>
        <div
          style={{
            position: "relative",
            height: "6px",
            background: "var(--border)",
            marginTop: "0.3rem",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              width: `${Math.min(pct, 100)}%`,
              background: "var(--olive)",
            }}
          />
        </div>
        <p
          style={{
            fontSize: "0.68rem",
            color: "var(--charcoal-muted)",
            margin: "0.2rem 0 0",
          }}
        >
          {photo.downloadCount.toLocaleString()} / {photo.viewCount.toLocaleString()} views
        </p>
      </div>
      <span
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "1.4rem",
          color: "var(--olive)",
          textAlign: "right",
        }}
      >
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}
