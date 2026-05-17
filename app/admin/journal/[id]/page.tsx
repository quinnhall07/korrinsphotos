// app/admin/journal/[id]/page.tsx
// Admin journal editor. Server Component hydrates the post + the source
// project's photo subcollection (so the hero-picker dropdown has real
// options) + the linked vendor list. The editor itself is the client child.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/session";
import { adminDb } from "@/lib/firebase-admin";
import { getJournalPost } from "@/lib/db/journal-posts";
import { listVendors, type VendorDoc } from "@/lib/db/vendors";
import { formatDateTime } from "@/lib/date";
import { JournalEditorClient, type SerializedJournalPost, type ProjectPhotoOption, type VendorOption } from "./JournalEditorClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = await getJournalPost(id).catch(() => null);
  return { title: post ? `${post.title} | Journal` : "Journal | Admin" };
}

/**
 * Look up the source-project's gallery-ready photos so the editor's hero
 * picker can show options. Returns a flat list of `{ cloudflareImageId,
 * label? }`; empty when no event is linked or no photos are ready.
 */
async function loadProjectPhotoOptions(
  projectId: string
): Promise<ProjectPhotoOption[]> {
  try {
    const eventSnap = await adminDb
      .collection("events")
      .where("projectId", "==", projectId)
      .limit(1)
      .get();
    if (eventSnap.empty) return [];
    const eventId = eventSnap.docs[0].id;

    const photosSnap = await adminDb
      .collection("events")
      .doc(eventId)
      .collection("photos")
      .where("galleryReady", "==", true)
      .orderBy("uploadedAt", "asc")
      .limit(200)
      .get();

    return photosSnap.docs
      .map((d) => {
        const data = d.data();
        const id = data.cloudflareImageId as string | undefined;
        if (!id) return null;
        return {
          cloudflareImageId: id,
          label: (data.label as string | undefined) ?? null,
        } as ProjectPhotoOption;
      })
      .filter((o): o is ProjectPhotoOption => o !== null);
  } catch (err) {
    console.error("[admin/journal] photo options load failed", { projectId, err });
    return [];
  }
}

export default async function AdminJournalEditorPage({ params }: Props) {
  const { id } = await params;
  await requireAdmin();

  const post = await getJournalPost(id);
  if (!post) notFound();

  const [photoOptions, allVendors] = await Promise.all([
    loadProjectPhotoOptions(post.projectId),
    listVendors().catch((err) => {
      console.error("[admin/journal] vendor load failed", err);
      return [] as VendorDoc[];
    }),
  ]);

  const vendorOptions: VendorOption[] = allVendors.map((v) => ({
    id:       v.id,
    name:     v.name,
    category: v.category,
  }));

  const serialized: SerializedJournalPost = {
    id:                    post.id,
    slug:                  post.slug,
    status:                post.status,
    projectId:             post.projectId,
    clientId:              post.clientId,
    title:                 post.title,
    subtitle:              post.subtitle ?? "",
    heroPhotoCloudflareId: post.heroPhotoCloudflareId ?? null,
    photoCloudflareIds:    post.photoCloudflareIds ?? [],
    vendorIds:             post.vendorIds ?? [],
    locationName:          post.locationName ?? "",
    city:                  post.city ?? "",
    bodyHtml:              post.bodyHtml ?? "",
    seoTitle:              post.seoTitle ?? "",
    seoDescription:        post.seoDescription ?? "",
    publishedAt:           post.publishedAt ? formatDateTime(post.publishedAt) : null,
    createdAt:             formatDateTime(post.createdAt) ?? "—",
    updatedAt:             formatDateTime(post.updatedAt) ?? "—",
  };

  return (
    <div className="page-fade-in">
      {/* Breadcrumb */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          fontSize: "0.78rem",
          color: "var(--charcoal-muted)",
          marginBottom: "1.25rem",
        }}
      >
        <Link
          href="/admin/journal"
          style={{ color: "var(--charcoal-muted)", textDecoration: "none" }}
        >
          Journal
        </Link>
        <span>/</span>
        <span style={{ color: "var(--charcoal)" }}>{post.title}</span>
      </div>

      <JournalEditorClient
        post={serialized}
        photoOptions={photoOptions}
        vendorOptions={vendorOptions}
      />
    </div>
  );
}
