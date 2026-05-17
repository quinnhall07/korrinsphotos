// app/admin/settings/automations/page.tsx
// Phase 1.9 — Automation recipes settings.
//
// Server Component. Reads the effective config (admin overrides merged
// with catalog defaults) and renders a list of recipe cards. The form
// posts to `saveAutomationConfig` in `actions.ts`.

import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import {
  AUTOMATION_RECIPES,
  getEffectiveAutomationConfig,
} from "@/lib/automations/recipes";
import { AutomationsForm } from "./AutomationsForm";

export const metadata: Metadata = { title: "Automations | Admin" };
export const dynamic = "force-dynamic";

export default async function AutomationsSettingsPage() {
  await requireAdmin();

  const resolved = await getEffectiveAutomationConfig();

  return (
    <div className="page-fade-in" style={{ maxWidth: 880 }}>
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
          Settings · Automations
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
          Automation <em>recipes</em>
        </h1>
        <p
          style={{
            fontSize: "0.88rem",
            lineHeight: 1.65,
            color: "var(--charcoal-light)",
            maxWidth: 620,
          }}
        >
          Toggle the lifecycle automations on or off, and tune their delays.
          Changes apply to every new project transition immediately —
          previously-scheduled tasks are not retroactively rescheduled.
        </p>
      </header>

      <AutomationsForm recipes={AUTOMATION_RECIPES} resolved={resolved} />
    </div>
  );
}
