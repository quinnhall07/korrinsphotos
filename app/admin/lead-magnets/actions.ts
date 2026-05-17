"use server";

// app/admin/lead-magnets/actions.ts
// Server Actions for the lead-magnet admin CRUD. Every export starts with
// `await requireAdmin()` per `app/admin/CLAUDE.md`. File bytes never transit
// these actions — admin clients PUT directly to R2 via the presigned URL we
// hand back from `createLeadMagnetAction` / `replaceLeadMagnetFileAction`.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/session";
import { logActivity } from "@/lib/db/activity";
import {
  createLeadMagnet as dbCreateLeadMagnet,
  deleteLeadMagnet as dbDeleteLeadMagnet,
  getLeadMagnet,
  getLeadMagnetBySlug,
  leadMagnetsCol,
  type LeadMagnetDoc,
  type LeadMagnetStatus,
  LEAD_MAGNET_STATUSES,
} from "@/lib/db/lead-magnets";
import { generatePresignedUploadUrl } from "@/lib/storage/r2";

// ─── Helpers ───────────────────────────────────────────────────────────────

function normaliseSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) || /^[a-z0-9]+$/.test(slug);
}

// ─── Create ────────────────────────────────────────────────────────────────

export interface CreateLeadMagnetInput {
  slug: string;
  title: string;
  description: string;
  downloadFileName: string;
  status?: LeadMagnetStatus;
  followUpSequenceId?: string | null;
  coverImageId?: string | null;
  contentType?: string; // for the upload presign — defaults to application/pdf
}

export type CreateLeadMagnetResult =
  | {
      success: true;
      id: string;
      slug: string;
      uploadUrl: string;
      r2Key: string;
    }
  | { success: false; error: string };

/**
 * Creates a DRAFT (or specified-status) lead magnet record and returns a
 * fresh presigned PUT URL the admin client uses to upload the file to R2.
 * The `slug` is immutable post-create — every admin write path enforces this.
 */
export async function createLeadMagnetAction(
  input: CreateLeadMagnetInput
): Promise<CreateLeadMagnetResult> {
  await requireAdmin();

  try {
    const title = input.title?.trim();
    const description = input.description?.trim();
    const downloadFileName = input.downloadFileName?.trim();
    const slug = normaliseSlug(input.slug ?? "");

    if (!title) return { success: false, error: "Title is required." };
    if (!description)
      return { success: false, error: "Description is required." };
    if (!downloadFileName)
      return { success: false, error: "Download file name is required." };
    if (!slug || !isValidSlug(slug)) {
      return {
        success: false,
        error: "Slug must be lowercase letters, numbers, or hyphens.",
      };
    }

    const existing = await getLeadMagnetBySlug(slug);
    if (existing) {
      return { success: false, error: `A magnet with slug "${slug}" already exists.` };
    }

    const status =
      input.status && LEAD_MAGNET_STATUSES.includes(input.status)
        ? input.status
        : "DRAFT";

    const r2Key = `lead-magnets/${slug}/${Date.now()}-${downloadFileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    const created = await dbCreateLeadMagnet({
      slug,
      title,
      description,
      downloadFileName,
      r2Key,
      status,
      followUpSequenceId: input.followUpSequenceId ?? null,
      coverImageId: input.coverImageId ?? null,
    });

    const contentType = input.contentType?.trim() || "application/pdf";
    const { presignedUrl } = await generatePresignedUploadUrl({
      key: r2Key,
      contentType,
      eventId: `lead-magnet-${slug}`, // metadata only; not a real event
    });

    await logActivity(
      "NOTE_ADDED",
      `Lead magnet created: ${title}`,
      { leadMagnetId: created.id, slug }
    ).catch(() => {});

    revalidatePath("/admin/lead-magnets");
    revalidatePath(`/magnet/${slug}`);

    return {
      success: true,
      id: created.id,
      slug,
      uploadUrl: presignedUrl,
      r2Key,
    };
  } catch (err) {
    console.error("createLeadMagnetAction error:", err);
    return { success: false, error: "Failed to create lead magnet." };
  }
}

// ─── Update ────────────────────────────────────────────────────────────────

export interface UpdateLeadMagnetInput {
  title?: string;
  description?: string;
  downloadFileName?: string;
  status?: LeadMagnetStatus;
  followUpSequenceId?: string | null;
  coverImageId?: string | null;
}

export async function updateLeadMagnetAction(
  id: string,
  patch: UpdateLeadMagnetInput
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  try {
    const existing = await getLeadMagnet(id);
    if (!existing) return { success: false, error: "Lead magnet not found." };

    const cleaned: Record<string, unknown> = {};

    if (patch.title !== undefined) {
      const trimmed = patch.title.trim();
      if (!trimmed) return { success: false, error: "Title cannot be empty." };
      cleaned.title = trimmed;
    }
    if (patch.description !== undefined) {
      const trimmed = patch.description.trim();
      if (!trimmed)
        return { success: false, error: "Description cannot be empty." };
      cleaned.description = trimmed;
    }
    if (patch.downloadFileName !== undefined) {
      const trimmed = patch.downloadFileName.trim();
      if (!trimmed)
        return { success: false, error: "Download file name cannot be empty." };
      cleaned.downloadFileName = trimmed;
    }
    if (patch.status !== undefined) {
      if (!LEAD_MAGNET_STATUSES.includes(patch.status)) {
        return { success: false, error: "Invalid status." };
      }
      cleaned.status = patch.status;
    }
    if (patch.followUpSequenceId !== undefined) {
      cleaned.followUpSequenceId =
        patch.followUpSequenceId === null || patch.followUpSequenceId === ""
          ? null
          : patch.followUpSequenceId;
    }
    if (patch.coverImageId !== undefined) {
      cleaned.coverImageId =
        patch.coverImageId === null || patch.coverImageId === ""
          ? FieldValue.delete()
          : patch.coverImageId;
    }

    cleaned.updatedAt = FieldValue.serverTimestamp();
    await leadMagnetsCol().doc(id).update(cleaned);

    revalidatePath("/admin/lead-magnets");
    revalidatePath(`/admin/lead-magnets/${id}`);
    revalidatePath(`/magnet/${existing.slug}`);
    return { success: true };
  } catch (err) {
    console.error("updateLeadMagnetAction error:", err);
    return { success: false, error: "Failed to update lead magnet." };
  }
}

// ─── Delete ────────────────────────────────────────────────────────────────

export async function deleteLeadMagnetAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  try {
    const existing = await getLeadMagnet(id);
    if (!existing) return { success: false, error: "Lead magnet not found." };

    await dbDeleteLeadMagnet(id);

    await logActivity(
      "NOTE_ADDED",
      `Lead magnet deleted: ${existing.title}`,
      { leadMagnetId: id, slug: existing.slug }
    ).catch(() => {});

    revalidatePath("/admin/lead-magnets");
    revalidatePath(`/magnet/${existing.slug}`);

    return { success: true };
  } catch (err) {
    console.error("deleteLeadMagnetAction error:", err);
    return { success: false, error: "Failed to delete lead magnet." };
  }
}

// ─── Replace file (issue new presigned PUT URL) ────────────────────────────

export type ReplaceFileResult =
  | { success: true; uploadUrl: string; r2Key: string }
  | { success: false; error: string };

/**
 * Issues a new presigned PUT URL for the magnet. If `keepKey` is true the URL
 * targets the existing `r2Key` (overwrite); otherwise a fresh time-stamped key
 * is minted (and the doc's `r2Key` + `downloadFileName` are updated).
 */
export async function replaceLeadMagnetFileAction(args: {
  id: string;
  fileName?: string;
  contentType?: string;
  keepKey?: boolean;
}): Promise<ReplaceFileResult> {
  await requireAdmin();

  try {
    const existing = await getLeadMagnet(args.id);
    if (!existing) return { success: false, error: "Lead magnet not found." };

    const fileName = args.fileName?.trim() || existing.downloadFileName;
    const contentType = args.contentType?.trim() || "application/pdf";

    const key =
      args.keepKey === true
        ? existing.r2Key
        : `lead-magnets/${existing.slug}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    const { presignedUrl } = await generatePresignedUploadUrl({
      key,
      contentType,
      eventId: `lead-magnet-${existing.slug}`,
    });

    if (key !== existing.r2Key || fileName !== existing.downloadFileName) {
      await leadMagnetsCol().doc(args.id).update({
        r2Key: key,
        downloadFileName: fileName,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    revalidatePath("/admin/lead-magnets");
    revalidatePath(`/admin/lead-magnets/${args.id}`);
    revalidatePath(`/magnet/${existing.slug}`);

    return { success: true, uploadUrl: presignedUrl, r2Key: key };
  } catch (err) {
    console.error("replaceLeadMagnetFileAction error:", err);
    return { success: false, error: "Failed to issue upload URL." };
  }
}

// ─── Convenience redirect wrappers used by <form> actions ──────────────────

export async function createLeadMagnetRedirectAction(
  input: CreateLeadMagnetInput
): Promise<void> {
  const res = await createLeadMagnetAction(input);
  if (res.success) {
    redirect(`/admin/lead-magnets/${res.id}`);
  }
}

// Re-export types so consumers can import the doc shape from this module.
export type { LeadMagnetDoc, LeadMagnetStatus };
