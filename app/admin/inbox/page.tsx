// app/admin/inbox/page.tsx
// Server Component shell for the unified admin inbox.
// Fetches open + snoozed items in parallel and passes serializable props to the
// client component for keyboard-first triage.

import { requireAdmin } from "@/lib/session";
import { listInboxItems, type InboxItemDoc } from "@/lib/db/inbox";
import { getBrandVoiceSamples, type BrandVoiceSample } from "@/lib/db/admin-settings";
import {
  InboxClientPage,
  type InboxItemView,
  type BrandVoiceAnchor,
} from "./InboxClientPage";

export const dynamic = "force-dynamic";

function toView(item: InboxItemDoc): InboxItemView {
  return {
    id: item.id,
    type: item.type,
    projectId: item.projectId ?? null,
    clientId: item.clientId ?? null,
    title: item.title,
    body: item.body ?? null,
    link: item.link ?? null,
    read: item.read,
    snoozedUntilIso: item.snoozedUntil ? item.snoozedUntil.toDate().toISOString() : null,
    createdAtIso: item.createdAt ? item.createdAt.toDate().toISOString() : new Date().toISOString(),
  };
}

function toAnchor(s: BrandVoiceSample): BrandVoiceAnchor {
  return {
    id: s.id,
    label: s.label,
    body: s.body,
    context: s.context ?? null,
  };
}

export default async function AdminInboxPage() {
  const session = await requireAdmin();

  const [openItems, allItems, archivedItems, voiceSamples] = await Promise.all([
    listInboxItems({ includeRead: false, includeSnoozed: false }),
    listInboxItems({ includeRead: false, includeSnoozed: true }),
    listInboxItems({ archivedOnly: true, includeRead: true, includeSnoozed: true }),
    getBrandVoiceSamples(session.uid),
  ]);

  const openIds = new Set(openItems.map((i) => i.id));
  const snoozedItems = allItems.filter((i) => !openIds.has(i.id));

  return (
    <InboxClientPage
      openItems={openItems.map(toView)}
      snoozedItems={snoozedItems.map(toView)}
      archivedItems={archivedItems.map(toView)}
      voiceAnchors={voiceSamples.map(toAnchor)}
    />
  );
}
