// app/admin/questionnaires/templates/[id]/page.tsx
// Server Component for the "edit template" route. Fetches the doc,
// serialises it, and hands off to the shared TemplateEditor.

import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { getTemplate } from "@/lib/db/questionnaires";
import {
  TemplateEditor,
  type SerializedTemplateDetail,
} from "../TemplateEditor";

export const metadata: Metadata = { title: "Edit Template | Admin" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditTemplatePage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  const doc = await getTemplate(id);
  if (!doc) notFound();

  const template: SerializedTemplateDetail = {
    id: doc.id,
    name: doc.name,
    sessionType: doc.sessionType as string,
    questions: (doc.questions ?? []).map((q) => ({
      id: q.id,
      type: q.type,
      label: q.label,
      options: q.options ?? [],
      required: !!q.required,
      helpText: q.helpText ?? "",
    })),
    createdAt: doc.createdAt.toDate().toISOString(),
    updatedAt: doc.updatedAt.toDate().toISOString(),
  };

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
      <TemplateEditor template={template} />
    </div>
  );
}
