// app/admin/questionnaires/templates/new/page.tsx
// Server Component for the "new template" route. Renders the shared
// TemplateEditor with `template={null}` so it knows to use the create action.

import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { TemplateEditor } from "../TemplateEditor";

export const metadata: Metadata = { title: "New Template | Admin" };
export const dynamic = "force-dynamic";

export default async function NewTemplatePage() {
  await requireAdmin();

  return (
    <div className="page-fade-in">
      <div style={{ marginBottom: "1.25rem" }}>
        <Link
          href="/admin/questionnaires/templates"
          style={{
            fontSize: "0.7rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--charcoal-muted)",
            textDecoration: "none",
          }}
        >
          ← All templates
        </Link>
      </div>
      <TemplateEditor template={null} />
    </div>
  );
}
