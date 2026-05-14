// app/admin/settings/brand-voice/page.tsx
// Phase 13.13 — Brand voice calibration. Server Component shell that loads
// the current admin's stored writing samples and hands them to the client
// editor. The samples are voice anchors for the Phase 5 AI assists; this
// page only persists + lists them — no AI integration here.

import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import {
  getBrandVoiceSamples,
  BRAND_VOICE_MAX_BODY,
  BRAND_VOICE_MAX_SAMPLES,
  BRAND_VOICE_MIN_BODY,
  type BrandVoiceSample,
} from "@/lib/db/admin-settings";
import { BrandVoiceClient, type BrandVoiceSampleView } from "./BrandVoiceClient";

export const metadata: Metadata = { title: "Brand voice | Admin" };
export const dynamic = "force-dynamic";

function toView(s: BrandVoiceSample): BrandVoiceSampleView {
  return {
    id: s.id,
    label: s.label,
    body: s.body,
    context: s.context ?? null,
    createdAtIso: s.createdAt ? s.createdAt.toDate().toISOString() : new Date().toISOString(),
  };
}

export default async function BrandVoiceSettingsPage() {
  const session = await requireAdmin();
  const samples = await getBrandVoiceSamples(session.uid);

  return (
    <div className="page-fade-in" style={{ maxWidth: 880, padding: "2rem 2.5rem" }}>
      <header style={{ marginBottom: "2rem" }}>
        <p
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--olive)",
            marginBottom: "0.5rem",
          }}
        >
          Settings · Brand voice
        </p>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontWeight: 300,
            fontSize: "2.4rem",
            lineHeight: 1.1,
            color: "var(--charcoal)",
            marginBottom: "0.75rem",
          }}
        >
          Brand voice <em>samples</em>
        </h1>
        <p
          style={{
            fontSize: "0.88rem",
            lineHeight: 1.65,
            color: "var(--charcoal-light)",
            maxWidth: 620,
          }}
        >
          Paste up to {BRAND_VOICE_MAX_SAMPLES} short passages that sound like
          you — replies you&apos;ve actually sent, paragraphs from your blog,
          captions from your favourite posts. The AI assistants use these as
          voice anchors when drafting on your behalf, so the more honest the
          better.
        </p>
      </header>

      <BrandVoiceClient
        initial={samples.map(toView)}
        limits={{
          maxSamples: BRAND_VOICE_MAX_SAMPLES,
          minBody: BRAND_VOICE_MIN_BODY,
          maxBody: BRAND_VOICE_MAX_BODY,
        }}
      />
    </div>
  );
}
