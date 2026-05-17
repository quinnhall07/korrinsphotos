"use server";

// app/admin/campaigns/actions.ts
// Server Actions for the campaign CMS (Phase 4.9). Every export re-validates
// admin auth at the top — the parent `app/admin/layout.tsx` guard does not
// propagate into Server Actions.
//
// Slug is mandatory on create + immutable post-create; the public renderer
// resolves campaigns by slug from the cookie, so changing it would orphan
// existing inbound traffic and analytics.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/session";
import { logActivity } from "@/lib/db/activity";
import {
  CAMPAIGN_STATUSES,
  campaignsCol,
  createCampaign as dbCreateCampaign,
  deleteCampaign as dbDeleteCampaign,
  getCampaign,
  getCampaignBySlug,
  type CampaignDoc,
  type CampaignStatus,
  type CampaignDefaultUtm,
  type CampaignInquiryPrefill,
} from "@/lib/db/campaigns";

// ─── Helpers ───────────────────────────────────────────────────────────────

const SLUG_RE = /^[a-z0-9-]+$/;

function trimOrNull(value: string | undefined | null): string | null {
  if (value === undefined || value === null) return null;
  const t = value.trim();
  return t === "" ? null : t;
}

function sanitizeUtm(utm: CampaignDefaultUtm): CampaignDefaultUtm {
  return {
    source: utm.source.trim(),
    medium: utm.medium.trim(),
    campaign: utm.campaign.trim(),
  };
}

// ─── Create ────────────────────────────────────────────────────────────────

export interface CreateCampaignInput {
  slug: string;
  title: string;
  heroTitle: string;
  heroSubtitle?: string | null;
  heroPhotoCloudflareId?: string | null;
  bodyHtml?: string;
  ctaText?: string;
  ctaHref?: string | null;
  galleryCategory?: string | null;
  defaultUtm: CampaignDefaultUtm;
  inquiryPrefill?: CampaignInquiryPrefill | null;
  status?: CampaignStatus;
}

export type CreateCampaignResult =
  | { success: true; id: string; slug: string }
  | { success: false; error: string };

export async function createCampaignAction(
  input: CreateCampaignInput
): Promise<CreateCampaignResult> {
  await requireAdmin();

  try {
    const slug = (input.slug ?? "").trim().toLowerCase();
    const title = (input.title ?? "").trim();
    const heroTitle = (input.heroTitle ?? "").trim();

    if (!slug) return { success: false, error: "Slug is required." };
    if (!SLUG_RE.test(slug)) {
      return {
        success: false,
        error: "Slug must contain only lowercase letters, numbers, and hyphens.",
      };
    }
    if (!title) return { success: false, error: "Title is required." };
    if (!heroTitle) return { success: false, error: "Hero title is required." };

    const utm = input.defaultUtm;
    if (!utm || !utm.source?.trim() || !utm.medium?.trim() || !utm.campaign?.trim()) {
      return {
        success: false,
        error: "Default UTM source, medium, and campaign are all required.",
      };
    }

    const existing = await getCampaignBySlug(slug);
    if (existing) {
      return { success: false, error: `A campaign with slug "${slug}" already exists.` };
    }

    const status =
      input.status && CAMPAIGN_STATUSES.includes(input.status) ? input.status : "DRAFT";

    const created = await dbCreateCampaign({
      slug,
      status,
      title,
      heroTitle,
      heroSubtitle: trimOrNull(input.heroSubtitle ?? null),
      heroPhotoCloudflareId: trimOrNull(input.heroPhotoCloudflareId ?? null),
      bodyHtml: (input.bodyHtml ?? "").trim(),
      ctaText: (input.ctaText ?? "Inquire").trim() || "Inquire",
      ctaHref: trimOrNull(input.ctaHref ?? null),
      galleryCategory: trimOrNull(input.galleryCategory ?? null),
      defaultUtm: sanitizeUtm(utm),
      inquiryPrefill: input.inquiryPrefill ?? null,
    });

    await logActivity(
      "NOTE_ADDED",
      `Campaign created: ${created.title}`,
      { campaignId: created.id, slug: created.slug }
    ).catch(() => {});

    revalidatePath("/admin/campaigns");
    revalidatePath(`/c/${slug}`);

    return { success: true, id: created.id, slug: created.slug };
  } catch (err) {
    console.error("createCampaignAction error:", err);
    return { success: false, error: "Failed to create campaign." };
  }
}

/**
 * Form-action wrapper used by the "+ New campaign" form on the list page.
 * Redirects straight into the editor on success.
 */
export async function createCampaignRedirectAction(
  input: CreateCampaignInput
): Promise<void> {
  const res = await createCampaignAction(input);
  if (res.success) {
    redirect(`/admin/campaigns/${res.id}`);
  }
}

// ─── Update ────────────────────────────────────────────────────────────────

export interface UpdateCampaignInput {
  title?: string;
  heroTitle?: string;
  heroSubtitle?: string | null;
  heroPhotoCloudflareId?: string | null;
  bodyHtml?: string;
  ctaText?: string;
  ctaHref?: string | null;
  galleryCategory?: string | null;
  defaultUtm?: CampaignDefaultUtm;
  inquiryPrefill?: CampaignInquiryPrefill | null;
  status?: CampaignStatus;
}

export async function updateCampaignAction(
  id: string,
  patch: UpdateCampaignInput
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  try {
    const existing = await getCampaign(id);
    if (!existing) return { success: false, error: "Campaign not found." };

    const cleaned: Record<string, unknown> = {};

    if (patch.title !== undefined) {
      const t = patch.title.trim();
      if (!t) return { success: false, error: "Title cannot be empty." };
      cleaned.title = t;
    }
    if (patch.heroTitle !== undefined) {
      const t = patch.heroTitle.trim();
      if (!t) return { success: false, error: "Hero title cannot be empty." };
      cleaned.heroTitle = t;
    }
    if (patch.heroSubtitle !== undefined) {
      cleaned.heroSubtitle = trimOrNull(patch.heroSubtitle);
    }
    if (patch.heroPhotoCloudflareId !== undefined) {
      cleaned.heroPhotoCloudflareId = trimOrNull(patch.heroPhotoCloudflareId);
    }
    if (patch.bodyHtml !== undefined) {
      cleaned.bodyHtml = patch.bodyHtml;
    }
    if (patch.ctaText !== undefined) {
      const t = patch.ctaText.trim();
      if (!t) return { success: false, error: "CTA text cannot be empty." };
      cleaned.ctaText = t;
    }
    if (patch.ctaHref !== undefined) {
      cleaned.ctaHref = trimOrNull(patch.ctaHref);
    }
    if (patch.galleryCategory !== undefined) {
      cleaned.galleryCategory = trimOrNull(patch.galleryCategory);
    }
    if (patch.defaultUtm !== undefined) {
      const u = patch.defaultUtm;
      if (!u.source?.trim() || !u.medium?.trim() || !u.campaign?.trim()) {
        return {
          success: false,
          error: "Default UTM source, medium, and campaign are all required.",
        };
      }
      cleaned.defaultUtm = sanitizeUtm(u);
    }
    if (patch.inquiryPrefill !== undefined) {
      cleaned.inquiryPrefill = patch.inquiryPrefill ?? null;
    }
    if (patch.status !== undefined) {
      if (!CAMPAIGN_STATUSES.includes(patch.status)) {
        return { success: false, error: "Invalid status." };
      }
      cleaned.status = patch.status;
    }

    cleaned.updatedAt = FieldValue.serverTimestamp();
    await campaignsCol().doc(id).update(cleaned);

    revalidatePath("/admin/campaigns");
    revalidatePath(`/admin/campaigns/${id}`);
    revalidatePath(`/c/${existing.slug}`);

    return { success: true };
  } catch (err) {
    console.error("updateCampaignAction error:", err);
    return { success: false, error: "Failed to update campaign." };
  }
}

// ─── Status quick-set ──────────────────────────────────────────────────────

export async function setCampaignStatusAction(
  id: string,
  status: CampaignStatus
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  try {
    if (!CAMPAIGN_STATUSES.includes(status)) {
      return { success: false, error: "Invalid status." };
    }
    const existing = await getCampaign(id);
    if (!existing) return { success: false, error: "Campaign not found." };

    await campaignsCol().doc(id).update({
      status,
      updatedAt: FieldValue.serverTimestamp(),
    });

    revalidatePath("/admin/campaigns");
    revalidatePath(`/admin/campaigns/${id}`);
    revalidatePath(`/c/${existing.slug}`);

    return { success: true };
  } catch (err) {
    console.error("setCampaignStatusAction error:", err);
    return { success: false, error: "Failed to update campaign status." };
  }
}

// ─── Delete ────────────────────────────────────────────────────────────────

export async function deleteCampaignAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  try {
    const existing = await getCampaign(id);
    if (!existing) return { success: false, error: "Campaign not found." };

    await dbDeleteCampaign(id);

    await logActivity(
      "NOTE_ADDED",
      `Campaign deleted: ${existing.title}`,
      { campaignId: id, slug: existing.slug }
    ).catch(() => {});

    revalidatePath("/admin/campaigns");
    revalidatePath(`/c/${existing.slug}`);

    return { success: true };
  } catch (err) {
    console.error("deleteCampaignAction error:", err);
    return { success: false, error: "Failed to delete campaign." };
  }
}

// Re-export the document type for convenience in client components.
export type { CampaignDoc, CampaignStatus };
