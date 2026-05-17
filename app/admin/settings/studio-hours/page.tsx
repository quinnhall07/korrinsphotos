// app/admin/settings/studio-hours/page.tsx
// Phase 13.2 — Studio Hours settings page.
//
// Server Component. Reads the admin's current studio hours from
// `users/{uid}.studioHours` (falling back to DEFAULT_STUDIO_HOURS),
// computes a live "currently {open|closed because X}" preview, and
// hands both to the client form.

import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import {
  getStudioHoursOrDefault,
  type StudioHours,
} from "@/lib/db/admin-settings";
import { isStudioOpen, describeClosedReason } from "@/lib/studio-hours";
import { StudioHoursForm } from "./StudioHoursForm";

export const metadata: Metadata = { title: "Studio Hours | Admin" };
export const dynamic = "force-dynamic";

function buildPreviewLabel(hours: StudioHours): string {
  const status = isStudioOpen(hours, new Date());
  if (status.isOpen) {
    return `We are currently open. Closes after today's window.`;
  }
  const reason = describeClosedReason(status.reason, hours);
  if (status.nextOpenLabel) {
    return `We are currently closed (${reason}). Next open: ${status.nextOpenLabel}.`;
  }
  return `We are currently closed (${reason}). No upcoming open window in the next 14 days.`;
}

export default async function StudioHoursSettingsPage() {
  const session = await requireAdmin();
  const hours = await getStudioHoursOrDefault(session.uid);
  const previewLabel = buildPreviewLabel(hours);

  return (
    <div className="page-fade-in" style={{ maxWidth: 720 }}>
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
          Settings · Studio Hours
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
          Studio <em>hours</em>
        </h1>
        <p
          style={{
            fontSize: "0.88rem",
            lineHeight: 1.65,
            color: "var(--charcoal-light)",
            maxWidth: 620,
          }}
        >
          Booking inquiries received outside these hours trigger a courteous
          &ldquo;we received your inquiry — we&apos;ll be in touch by [next
          open time]&rdquo; auto-response in addition to the standard
          confirmation. Holidays and vacations supersede the weekly schedule.
        </p>
      </header>

      <StudioHoursForm hours={hours} previewLabel={previewLabel} />
    </div>
  );
}
