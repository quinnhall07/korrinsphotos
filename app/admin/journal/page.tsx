// app/admin/journal/page.tsx
// Admin journal index. Lists every journal post, grouped by status.
// Server Component fetches via `listJournalPosts`, serialises Timestamps,
// hands off to the client component for the action buttons.

import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import {
  listJournalPosts,
  type JournalPostDoc,
  type JournalPostStatus,
} from "@/lib/db/journal-posts";
import { JournalListClientPage, type SerializedJournalRow } from "./JournalListClientPage";

export const metadata: Metadata = { title: "Journal | Admin" };
export const dynamic = "force-dynamic";

function serialiseRow(doc: JournalPostDoc): SerializedJournalRow {
  return {
    id:           doc.id,
    slug:         doc.slug,
    title:        doc.title,
    status:       doc.status,
    projectId:    doc.projectId,
    city:         doc.city ?? null,
    locationName: doc.locationName ?? null,
    heroPhotoCloudflareId: doc.heroPhotoCloudflareId ?? null,
    photoCount:   doc.photoCloudflareIds?.length ?? 0,
    publishedAt:  doc.publishedAt ? doc.publishedAt.toDate().toISOString() : null,
    createdAt:    doc.createdAt.toDate().toISOString(),
    updatedAt:    doc.updatedAt.toDate().toISOString(),
  };
}

export default async function AdminJournalPage() {
  await requireAdmin();

  let posts: SerializedJournalRow[] = [];
  let error: string | null = null;
  try {
    const docs = await listJournalPosts();
    posts = docs.map(serialiseRow);
  } catch (err) {
    console.error("[admin/journal] load failed", err);
    error = err instanceof Error ? err.message : "Failed to load journal posts.";
  }

  // Pre-bucket by status so the client component doesn't reshuffle on every
  // render.
  const byStatus: Record<JournalPostStatus, SerializedJournalRow[]> = {
    DRAFT:     [],
    PUBLISHED: [],
    ARCHIVED:  [],
  };
  for (const p of posts) byStatus[p.status].push(p);

  return <JournalListClientPage byStatus={byStatus} error={error} />;
}
