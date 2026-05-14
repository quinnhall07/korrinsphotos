// app/admin/settings/reply-templates/page.tsx
// Wave 12 — Admin's saved reply templates editor. Server Component shell
// that loads the current admin's stored templates and hands them to the
// client editor. The templates surface in the project workspace
// MessagesTab as a quick-insert popover.

import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import {
  getReplyTemplates,
  REPLY_TEMPLATE_MAX_BODY,
  REPLY_TEMPLATE_MAX_LABEL,
  REPLY_TEMPLATE_SOFT_CAP,
  type ReplyTemplate,
} from "@/lib/db/admin-settings";
import {
  ReplyTemplatesClient,
  type ReplyTemplateView,
} from "./ReplyTemplatesClient";

export const metadata: Metadata = { title: "Reply templates | Admin" };
export const dynamic = "force-dynamic";

function toView(t: ReplyTemplate): ReplyTemplateView {
  return {
    id: t.id,
    label: t.label,
    body: t.body,
    createdAtIso: t.createdAt
      ? t.createdAt.toDate().toISOString()
      : new Date().toISOString(),
  };
}

export default async function ReplyTemplatesSettingsPage() {
  const session = await requireAdmin();
  const templates = await getReplyTemplates(session.uid);

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
          Settings · Reply templates
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
          Reply <em>templates</em>
        </h1>
        <p
          style={{
            fontSize: "0.88rem",
            lineHeight: 1.65,
            color: "var(--charcoal-light)",
            maxWidth: 620,
          }}
        >
          Save the replies you find yourself typing again and again. They show
          up in the project workspace under a Templates dropdown and insert
          straight into the reply box. Recommended cap is around{" "}
          {REPLY_TEMPLATE_SOFT_CAP} so the dropdown stays scannable.
        </p>
      </header>

      <ReplyTemplatesClient
        initial={templates.map(toView)}
        limits={{
          maxLabel: REPLY_TEMPLATE_MAX_LABEL,
          maxBody: REPLY_TEMPLATE_MAX_BODY,
          softCap: REPLY_TEMPLATE_SOFT_CAP,
        }}
      />
    </div>
  );
}
