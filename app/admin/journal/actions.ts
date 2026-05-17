// app/admin/journal/actions.ts
// Server Actions for the admin journal editor. Every action begins with
// `await requireAdmin()` and revalidates the admin index + the public
// `/journal/[slug]` route (when applicable) on success.

"use server";

import { revalidatePath } from "next/cache";
import { Timestamp } from "firebase-admin/firestore";

import { requireAdmin } from "@/lib/session";
import { logActivity } from "@/lib/db/activity";
import {
  deleteJournalPost,
  getJournalPost,
  updateJournalPost,
  type JournalPostStatus,
} from "@/lib/db/journal-posts";
import {
  draftJournalPostForProject,
  redraftAutoFieldsForPost,
} from "@/lib/domain/journal-drafter";

// ─── Editor patch ─────────────────────────────────────────────────────────────

export interface JournalEditorPatch {
  title?: string;
  subtitle?: string | null;
  slug?: string;
  heroPhotoCloudflareId?: string | null;
  photoCloudflareIds?: string[];
  bodyHtml?: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  locationName?: string | null;
  city?: string | null;
  vendorIds?: string[];
}

/**
 * Generic editor patch. Once a post is published, `slug` becomes readonly —
 * the action drops slug changes silently on PUBLISHED rows to avoid breaking
 * external links. Everything else (title, body, hero, photos, vendors, SEO)
 * stays editable.
 */
export async function updateJournalPostAction(
  postId: string,
  patch: JournalEditorPatch
): Promise<{ success: boolean; error?: string; slug?: string }> {
  await requireAdmin();
  if (!postId) return { success: false, error: "Missing post id." };

  try {
    const existing = await getJournalPost(postId);
    if (!existing) return { success: false, error: "Post not found." };

    const cleanPatch: JournalEditorPatch = { ...patch };
    // Slug is immutable once published.
    if (existing.status === "PUBLISHED" && "slug" in cleanPatch) {
      delete cleanPatch.slug;
    }
    // Normalise slug if provided.
    if (typeof cleanPatch.slug === "string") {
      const trimmed = cleanPatch.slug.trim();
      if (trimmed.length === 0) {
        delete cleanPatch.slug;
      } else {
        cleanPatch.slug = trimmed
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
      }
    }

    await updateJournalPost(postId, cleanPatch);

    revalidatePath("/admin/journal");
    revalidatePath(`/admin/journal/${postId}`);
    const slugForRevalidate = cleanPatch.slug ?? existing.slug;
    revalidatePath(`/journal/${slugForRevalidate}`);
    revalidatePath("/journal");
    return { success: true, slug: slugForRevalidate };
  } catch (err) {
    console.error("[updateJournalPostAction]", { postId, err });
    return { success: false, error: "Failed to save changes." };
  }
}

/** Publish a journal post — stamps `publishedAt` if it isn't already set. */
export async function publishJournalPostAction(
  postId: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  if (!postId) return { success: false, error: "Missing post id." };
  try {
    const existing = await getJournalPost(postId);
    if (!existing) return { success: false, error: "Post not found." };

    const patch: Partial<{
      status: JournalPostStatus;
      publishedAt: Timestamp;
    }> = { status: "PUBLISHED" };
    if (!existing.publishedAt) patch.publishedAt = Timestamp.now();

    await updateJournalPost(postId, patch);

    await logActivity(
      "NOTE_ADDED",
      `Published journal post "${existing.title}"`,
      { postId, slug: existing.slug }
    ).catch(() => {});

    revalidatePath("/admin/journal");
    revalidatePath(`/admin/journal/${postId}`);
    revalidatePath(`/journal/${existing.slug}`);
    revalidatePath("/journal");
    return { success: true };
  } catch (err) {
    console.error("[publishJournalPostAction]", { postId, err });
    return { success: false, error: "Failed to publish." };
  }
}

/** Unpublish — moves back to DRAFT but keeps `publishedAt` for history. */
export async function unpublishJournalPostAction(
  postId: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  if (!postId) return { success: false, error: "Missing post id." };
  try {
    const existing = await getJournalPost(postId);
    if (!existing) return { success: false, error: "Post not found." };

    await updateJournalPost(postId, { status: "DRAFT" });

    revalidatePath("/admin/journal");
    revalidatePath(`/admin/journal/${postId}`);
    revalidatePath(`/journal/${existing.slug}`);
    revalidatePath("/journal");
    return { success: true };
  } catch (err) {
    console.error("[unpublishJournalPostAction]", { postId, err });
    return { success: false, error: "Failed to unpublish." };
  }
}

export async function deleteJournalPostAction(
  postId: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  if (!postId) return { success: false, error: "Missing post id." };
  try {
    const existing = await getJournalPost(postId);
    if (!existing) return { success: false, error: "Post not found." };

    await deleteJournalPost(postId);
    await logActivity(
      "NOTE_ADDED",
      `Deleted journal post "${existing.title}"`,
      { postId, slug: existing.slug }
    ).catch(() => {});

    revalidatePath("/admin/journal");
    revalidatePath(`/journal/${existing.slug}`);
    revalidatePath("/journal");
    return { success: true };
  } catch (err) {
    console.error("[deleteJournalPostAction]", { postId, err });
    return { success: false, error: "Failed to delete." };
  }
}

/**
 * Force re-draft of auto-only fields from the source project. Korrin-owned
 * fields (`bodyHtml`, `title`, `subtitle`, `slug`, `status`) are preserved.
 *
 * Destructive on the auto fields — confirm before calling. The original
 * project must still exist; missing source projects return a soft error.
 */
export async function redraftJournalPostFromProjectAction(
  postId: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  if (!postId) return { success: false, error: "Missing post id." };
  try {
    const existing = await getJournalPost(postId);
    if (!existing) return { success: false, error: "Post not found." };

    const res = await redraftAutoFieldsForPost(postId, existing.projectId);
    if (!res.success) return res;

    revalidatePath("/admin/journal");
    revalidatePath(`/admin/journal/${postId}`);
    revalidatePath(`/journal/${existing.slug}`);
    revalidatePath("/journal");
    return { success: true };
  } catch (err) {
    console.error("[redraftJournalPostFromProjectAction]", { postId, err });
    return { success: false, error: "Failed to redraft from project." };
  }
}

/**
 * Manually trigger the auto-drafter for a specific project. Used when Korrin
 * wants to create a draft for a delivered project that pre-dates Phase 4.8
 * (idempotent — no-op if a draft already exists for the project).
 */
export async function draftJournalPostForProjectAction(
  projectId: string
): Promise<{ success: boolean; error?: string; postId?: string }> {
  await requireAdmin();
  if (!projectId) return { success: false, error: "Missing project id." };
  try {
    const post = await draftJournalPostForProject(projectId);
    if (!post) return { success: false, error: "Could not draft from project." };
    revalidatePath("/admin/journal");
    return { success: true, postId: post.id };
  } catch (err) {
    console.error("[draftJournalPostForProjectAction]", { projectId, err });
    return { success: false, error: "Failed to draft from project." };
  }
}
