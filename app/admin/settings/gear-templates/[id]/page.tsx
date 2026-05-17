// app/admin/settings/gear-templates/[id]/page.tsx
// Server Component for the "edit gear kit" route. Fetches the doc,
// serialises it, and hands off to the shared GearTemplateEditor.

import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { getGearTemplate } from "@/lib/db/gear-templates";
import {
  GearTemplateEditor,
  type SerializedGearTemplateDetail,
} from "../GearTemplateEditor";

export const metadata: Metadata = { title: "Edit Gear Kit | Admin" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditGearTemplatePage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  const doc = await getGearTemplate(id);
  if (!doc) notFound();

  const template: SerializedGearTemplateDetail = {
    id: doc.id,
    name: doc.name,
    sessionType: doc.sessionType as string,
    isDefault: !!doc.isDefault,
    items: (doc.items ?? []).map((it) => ({
      id: it.id,
      name: it.name,
      category: it.category,
      required: !!it.required,
      notes: it.notes ?? "",
    })),
    createdAt: doc.createdAt.toDate().toISOString(),
    updatedAt: doc.updatedAt.toDate().toISOString(),
  };

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
      <GearTemplateEditor template={template} />
    </div>
  );
}
