// app/admin/settings/gear-templates/new/page.tsx
// Server Component for the "new gear kit" route. Renders the shared
// GearTemplateEditor with `template={null}` so it knows to use the create
// action.

import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { GearTemplateEditor } from "../GearTemplateEditor";

export const metadata: Metadata = { title: "New Gear Kit | Admin" };
export const dynamic = "force-dynamic";

export default async function NewGearTemplatePage() {
  await requireAdmin();

  return (
    <div className="page-fade-in">
      <div style={{ marginBottom: "1.25rem" }}>
        <Link
          href="/admin/settings/gear-templates"
          style={{
            fontSize: "0.7rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--charcoal-muted)",
            textDecoration: "none",
          }}
        >
          ← All kits
        </Link>
      </div>
      <GearTemplateEditor template={null} />
    </div>
  );
}
