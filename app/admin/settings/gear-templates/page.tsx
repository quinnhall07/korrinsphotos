// app/admin/settings/gear-templates/page.tsx
// Lists every gear template (Phase 3.7). Server Component fetches docs,
// serialises Timestamps, and hands off to a small client filter view.

import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { listGearTemplates } from "@/lib/db/gear-templates";
import { GearTemplateList } from "./GearTemplateList";

export const metadata: Metadata = { title: "Gear Templates | Admin" };
export const dynamic = "force-dynamic";

export default async function GearTemplatesPage() {
  await requireAdmin();

  let templates: Array<{
    id: string;
    name: string;
    sessionType: string;
    itemCount: number;
    requiredCount: number;
    isDefault: boolean;
    updatedAt: string | null;
  }> = [];
  let error: string | null = null;

  try {
    const docs = await listGearTemplates();
    templates = docs.map((d) => ({
      id: d.id,
      name: d.name,
      sessionType: d.sessionType as string,
      itemCount: Array.isArray(d.items) ? d.items.length : 0,
      requiredCount: Array.isArray(d.items)
        ? d.items.filter((it) => it.required).length
        : 0,
      isDefault: !!d.isDefault,
      updatedAt: d.updatedAt?.toDate().toISOString() ?? null,
    }));
  } catch (err) {
    console.error("Failed to list gear templates:", err);
    error = err instanceof Error ? err.message : "Failed to load templates.";
  }

  if (error) {
    return (
      <div className="page-fade-in">
        <div
          style={{
            padding: "2rem",
            border: "0.5px solid #FCA5A5",
            background: "#FEF2F2",
            color: "#991B1B",
            fontSize: "0.88rem",
            lineHeight: 1.7,
          }}
        >
          <strong>Error loading templates</strong>
          <br />
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="page-fade-in">
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
          <p style={eyebrow}>Gear Templates</p>
          <h2 style={pageTitle}>Kits</h2>
          <p
            style={{
              fontSize: "0.78rem",
              color: "var(--charcoal-muted)",
              marginTop: "0.4rem",
              letterSpacing: "0.04em",
            }}
          >
            {templates.length} template{templates.length === 1 ? "" : "s"}
            {" · "}
            Per-shoot-type packing checklists. Surfaced on each project&apos;s Gear
            tab and consumed by the shoot brief.
          </p>
        </div>

        <Link href="/admin/settings/gear-templates/new" style={btnOlive}>
          + New kit
        </Link>
      </div>

      <GearTemplateList templates={templates} />
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const eyebrow: React.CSSProperties = {
  fontSize: "0.65rem",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "var(--olive)",
  marginBottom: "0.3rem",
};

const pageTitle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: "2rem",
  fontWeight: 300,
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
  textDecoration: "none",
  display: "inline-block",
};
