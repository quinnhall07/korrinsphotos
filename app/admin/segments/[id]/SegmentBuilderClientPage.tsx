"use client";

// app/admin/segments/[id]/SegmentBuilderClientPage.tsx
// Predicate builder UI for a single saved segment. Compiles its form state
// into a SegmentPredicate JSON object on save / preview.
//
// Server-only modules are NEVER imported here — types are re-declared
// locally (per CLAUDE.md client/server boundary rules).

import { useMemo, useState, useTransition } from "react";
import { toast } from "@/components/ui/Toaster";
import { saveSegment } from "../actions";

// ─── Local types (re-declared to keep the server boundary clean) ─────────────

const PROJECT_STATUSES = [
  "SITE_VISIT",
  "INQUIRY",
  "QUALIFYING",
  "PROPOSAL_SENT",
  "NEGOTIATING",
  "CONTRACT_SENT",
  "DEPOSIT_PENDING",
  "BOOKED",
  "SHOOT_READY",
  "IN_EDITING",
  "GALLERY_DELIVERED",
  "REFERRAL_SENT",
  "COMPLETED",
  "LOST",
  "ARCHIVED",
] as const;
type ProjectStatusLiteral = (typeof PROJECT_STATUSES)[number];

const SESSION_TYPES = [
  "Wedding",
  "Engagement",
  "Portrait",
  "Family",
  "Editorial",
  "Commercial",
] as const;

const LEAD_SOURCES = [
  "WEBSITE",
  "INSTAGRAM",
  "GOOGLE",
  "REFERRAL",
  "DIRECT",
  "OTHER",
] as const;

export interface LocalSegmentPredicate {
  projectStatus?: ProjectStatusLiteral[];
  sessionType?: string[];
  tagsInclude?: string[];
  tagsExclude?: string[];
  leadScoreMin?: number;
  leadScoreMax?: number;
  leadSource?: string[];
  totalSessionsBookedMin?: number;
  firstTouchSource?: string[];
  deliveredAfter?: string;
  deliveredBefore?: string;
  hasReferred?: boolean;
}

export interface SerializedSegmentDetail {
  id: string;
  name: string;
  description: string | null;
  predicate: LocalSegmentPredicate;
  lastResolvedCount: number | null;
  lastResolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  segment: SerializedSegmentDetail;
  initialCount: number | null;
  initialCapped?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SegmentBuilderClientPage({
  segment,
  initialCount,
  initialCapped,
}: Props) {
  const [isSaving, startSave] = useTransition();
  const [isPreviewing, setIsPreviewing] = useState(false);

  const [name, setName] = useState(segment.name);
  const [description, setDescription] = useState(segment.description ?? "");

  // Form state mirrors the predicate shape; serialise() converts back to JSON.
  const [projectStatus, setProjectStatus] = useState<ProjectStatusLiteral[]>(
    segment.predicate.projectStatus ?? []
  );
  const [sessionType, setSessionType] = useState<string[]>(
    segment.predicate.sessionType ?? []
  );
  const [tagsIncludeStr, setTagsIncludeStr] = useState(
    (segment.predicate.tagsInclude ?? []).join(", ")
  );
  const [tagsExcludeStr, setTagsExcludeStr] = useState(
    (segment.predicate.tagsExclude ?? []).join(", ")
  );
  const [leadScoreMinStr, setLeadScoreMinStr] = useState(
    typeof segment.predicate.leadScoreMin === "number"
      ? String(segment.predicate.leadScoreMin)
      : ""
  );
  const [leadScoreMaxStr, setLeadScoreMaxStr] = useState(
    typeof segment.predicate.leadScoreMax === "number"
      ? String(segment.predicate.leadScoreMax)
      : ""
  );
  const [leadSource, setLeadSource] = useState<string[]>(
    segment.predicate.leadSource ?? []
  );
  const [totalSessionsMinStr, setTotalSessionsMinStr] = useState(
    typeof segment.predicate.totalSessionsBookedMin === "number"
      ? String(segment.predicate.totalSessionsBookedMin)
      : ""
  );
  const [firstTouchSource, setFirstTouchSource] = useState<string[]>(
    segment.predicate.firstTouchSource ?? []
  );
  const [deliveredAfter, setDeliveredAfter] = useState(
    segment.predicate.deliveredAfter ?? ""
  );
  const [deliveredBefore, setDeliveredBefore] = useState(
    segment.predicate.deliveredBefore ?? ""
  );
  const [hasReferred, setHasReferred] = useState<"" | "yes" | "no">(
    segment.predicate.hasReferred === true
      ? "yes"
      : segment.predicate.hasReferred === false
        ? "no"
        : ""
  );

  const [liveCount, setLiveCount] = useState<number | null>(initialCount);
  const [liveCapped, setLiveCapped] = useState<boolean>(!!initialCapped);

  // ─── Compile form state → predicate JSON ───────────────────────────────────
  const compiledPredicate: LocalSegmentPredicate = useMemo(() => {
    const tagsInclude = parseCsv(tagsIncludeStr);
    const tagsExclude = parseCsv(tagsExcludeStr);
    const leadScoreMin = parseIntOrNull(leadScoreMinStr);
    const leadScoreMax = parseIntOrNull(leadScoreMaxStr);
    const totalSessionsBookedMin = parseIntOrNull(totalSessionsMinStr);

    const out: LocalSegmentPredicate = {};
    if (projectStatus.length) out.projectStatus = projectStatus;
    if (sessionType.length) out.sessionType = sessionType;
    if (tagsInclude.length) out.tagsInclude = tagsInclude;
    if (tagsExclude.length) out.tagsExclude = tagsExclude;
    if (typeof leadScoreMin === "number") out.leadScoreMin = leadScoreMin;
    if (typeof leadScoreMax === "number") out.leadScoreMax = leadScoreMax;
    if (leadSource.length) out.leadSource = leadSource;
    if (typeof totalSessionsBookedMin === "number") {
      out.totalSessionsBookedMin = totalSessionsBookedMin;
    }
    if (firstTouchSource.length) out.firstTouchSource = firstTouchSource;
    if (deliveredAfter) out.deliveredAfter = deliveredAfter;
    if (deliveredBefore) out.deliveredBefore = deliveredBefore;
    if (hasReferred === "yes") out.hasReferred = true;
    if (hasReferred === "no") out.hasReferred = false;
    return out;
  }, [
    projectStatus,
    sessionType,
    tagsIncludeStr,
    tagsExcludeStr,
    leadScoreMinStr,
    leadScoreMaxStr,
    leadSource,
    totalSessionsMinStr,
    firstTouchSource,
    deliveredAfter,
    deliveredBefore,
    hasReferred,
  ]);

  // ─── Live preview ──────────────────────────────────────────────────────────
  async function handlePreview() {
    setIsPreviewing(true);
    try {
      const res = await fetch("/api/segments/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ predicate: compiledPredicate }),
      });
      if (!res.ok) {
        toast("Preview failed");
        return;
      }
      const data: { count: number; capped?: boolean } = await res.json();
      setLiveCount(data.count);
      setLiveCapped(!!data.capped);
      toast(
        data.capped
          ? `Capped at ${data.count} — try narrowing the predicate`
          : `Matches ${data.count} ${data.count === 1 ? "record" : "records"}`
      );
    } catch (err) {
      console.error(err);
      toast("Preview failed");
    } finally {
      setIsPreviewing(false);
    }
  }

  // ─── Save ──────────────────────────────────────────────────────────────────
  function handleSave() {
    startSave(async () => {
      const result = await saveSegment(
        segment.id,
        compiledPredicate,
        name,
        description
      );
      if (result.success) {
        setLiveCount(result.data.count);
        toast("Segment saved");
      } else {
        toast(result.error);
      }
    });
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "1.5rem",
          marginBottom: "2rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: "16rem" }}>
          <p style={eyebrow}>Audience Engine</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={titleInput}
            placeholder="Segment name"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{
              ...inputStyle,
              fontSize: "0.85rem",
              border: "none",
              borderBottom: "0.5px solid var(--border)",
              padding: "0.4rem 0",
              marginTop: "0.4rem",
              color: "var(--charcoal-muted)",
            }}
            placeholder="Short description (optional)"
          />
        </div>

        <div
          style={{
            border: "0.5px solid var(--border-strong)",
            padding: "1rem 1.4rem",
            minWidth: "12rem",
            background: "var(--white)",
            textAlign: "center",
          }}
        >
          <p style={{ ...eyebrow, marginBottom: "0.3rem" }}>
            {liveCapped ? "Capped at" : "Live count"}
          </p>
          <p
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "2.6rem",
              fontWeight: 300,
              lineHeight: 1,
              color: liveCapped ? "#92400E" : "var(--charcoal)",
            }}
          >
            {liveCount ?? "—"}
          </p>
          <button
            type="button"
            onClick={handlePreview}
            disabled={isPreviewing}
            style={{ ...btnOutlineSm, marginTop: "0.75rem" }}
          >
            {isPreviewing ? "Resolving…" : "Re-resolve"}
          </button>
        </div>
      </div>

      {/* Predicate sections */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(20rem, 1fr))",
          gap: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        <Section title="Project status">
          <ChipMulti
            options={PROJECT_STATUSES as unknown as readonly string[]}
            selected={projectStatus}
            onToggle={(v) =>
              setProjectStatus((prev) => toggleArray(prev, v as ProjectStatusLiteral))
            }
          />
        </Section>

        <Section title="Session type">
          <ChipMulti
            options={SESSION_TYPES as unknown as readonly string[]}
            selected={sessionType}
            onToggle={(v) => setSessionType((prev) => toggleArray(prev, v))}
          />
        </Section>

        <Section title="Lead source">
          <ChipMulti
            options={LEAD_SOURCES as unknown as readonly string[]}
            selected={leadSource}
            onToggle={(v) => setLeadSource((prev) => toggleArray(prev, v))}
          />
        </Section>

        <Section title="First-touch source">
          <ChipMulti
            options={LEAD_SOURCES as unknown as readonly string[]}
            selected={firstTouchSource}
            onToggle={(v) => setFirstTouchSource((prev) => toggleArray(prev, v))}
          />
        </Section>

        <Section title="Tags include (AND)">
          <input
            value={tagsIncludeStr}
            onChange={(e) => setTagsIncludeStr(e.target.value)}
            placeholder="hot-lead, summer-2026"
            style={inputStyle}
          />
          <p style={hintText}>Comma-separated. All listed tags must be present.</p>
        </Section>

        <Section title="Tags exclude (NONE)">
          <input
            value={tagsExcludeStr}
            onChange={(e) => setTagsExcludeStr(e.target.value)}
            placeholder="do-not-contact, archived"
            style={inputStyle}
          />
          <p style={hintText}>Comma-separated. None of these may be present.</p>
        </Section>

        <Section title="Lead score">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
            <div>
              <p style={miniLabel}>Min</p>
              <input
                inputMode="numeric"
                value={leadScoreMinStr}
                onChange={(e) => setLeadScoreMinStr(e.target.value)}
                placeholder="0"
                style={inputStyle}
              />
            </div>
            <div>
              <p style={miniLabel}>Max</p>
              <input
                inputMode="numeric"
                value={leadScoreMaxStr}
                onChange={(e) => setLeadScoreMaxStr(e.target.value)}
                placeholder="100"
                style={inputStyle}
              />
            </div>
          </div>
        </Section>

        <Section title="Total sessions booked">
          <p style={miniLabel}>Minimum</p>
          <input
            inputMode="numeric"
            value={totalSessionsMinStr}
            onChange={(e) => setTotalSessionsMinStr(e.target.value)}
            placeholder="e.g. 2"
            style={inputStyle}
          />
        </Section>

        <Section title="Delivered window">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
            <div>
              <p style={miniLabel}>After</p>
              <input
                type="date"
                value={deliveredAfter}
                onChange={(e) => setDeliveredAfter(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <p style={miniLabel}>Before</p>
              <input
                type="date"
                value={deliveredBefore}
                onChange={(e) => setDeliveredBefore(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        </Section>

        <Section title="Referral activity">
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {(
              [
                { value: "", label: "Any" },
                { value: "yes", label: "Has referred" },
                { value: "no", label: "Has not referred" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value || "any"}
                type="button"
                onClick={() => setHasReferred(opt.value)}
                style={hasReferred === opt.value ? chipActive : chipBase}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Section>
      </div>

      {/* Action bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "0.75rem",
          marginTop: "2rem",
          paddingTop: "1.25rem",
          borderTop: "0.5px solid var(--border)",
        }}
      >
        <button
          type="button"
          onClick={handlePreview}
          disabled={isPreviewing || isSaving}
          style={btnOutline}
        >
          {isPreviewing ? "Resolving…" : "Live preview"}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || isPreviewing}
          style={btnOlive}
        >
          {isSaving ? "Saving…" : "Save segment"}
        </button>
      </div>
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: "0.5px solid var(--border)",
        background: "var(--white)",
        padding: "1.2rem",
      }}
    >
      <p style={{ ...eyebrow, marginBottom: "0.8rem" }}>{title}</p>
      {children}
    </div>
  );
}

function ChipMulti({
  options,
  selected,
  onToggle,
}: {
  options: readonly string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            style={active ? chipActive : chipBase}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ─── Pure helpers ────────────────────────────────────────────────────────────

function parseCsv(input: string): string[] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseIntOrNull(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function toggleArray<T>(prev: T[], v: T): T[] {
  return prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v];
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const eyebrow: React.CSSProperties = {
  fontSize: "0.65rem",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "var(--olive)",
  marginBottom: "0.3rem",
};

const titleInput: React.CSSProperties = {
  display: "block",
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: "2rem",
  fontWeight: 300,
  border: "none",
  background: "transparent",
  outline: "none",
  width: "100%",
  padding: "0.1rem 0",
  color: "var(--charcoal)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.65rem 0.85rem",
  fontSize: "0.85rem",
  border: "0.5px solid var(--border)",
  background: "var(--white)",
  color: "var(--charcoal)",
  fontFamily: "'Jost', sans-serif",
  outline: "none",
};

const hintText: React.CSSProperties = {
  fontSize: "0.7rem",
  color: "var(--charcoal-muted)",
  marginTop: "0.45rem",
  letterSpacing: "0.04em",
};

const miniLabel: React.CSSProperties = {
  fontSize: "0.6rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--charcoal-muted)",
  marginBottom: "0.3rem",
};

const chipBase: React.CSSProperties = {
  padding: "0.45rem 0.75rem",
  fontSize: "0.7rem",
  letterSpacing: "0.06em",
  background: "var(--white)",
  color: "var(--charcoal)",
  border: "0.5px solid var(--border-strong)",
  cursor: "pointer",
  fontFamily: "'Jost', sans-serif",
};

const chipActive: React.CSSProperties = {
  ...chipBase,
  background: "var(--olive)",
  color: "var(--white)",
  borderColor: "var(--olive)",
};

const btnOlive: React.CSSProperties = {
  padding: "0.85rem 2.2rem",
  fontSize: "0.72rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  background: "var(--olive)",
  color: "var(--white)",
  border: "none",
  cursor: "pointer",
  fontFamily: "'Jost', sans-serif",
};

const btnOutline: React.CSSProperties = {
  padding: "0.85rem 1.6rem",
  fontSize: "0.72rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  background: "none",
  color: "var(--charcoal)",
  border: "0.5px solid var(--border-strong)",
  cursor: "pointer",
  fontFamily: "'Jost', sans-serif",
};

const btnOutlineSm: React.CSSProperties = {
  padding: "0.5rem 1rem",
  fontSize: "0.66rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  background: "none",
  color: "var(--charcoal)",
  border: "0.5px solid var(--border-strong)",
  cursor: "pointer",
  fontFamily: "'Jost', sans-serif",
};
