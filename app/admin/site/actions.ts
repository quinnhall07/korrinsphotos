"use server";

// app/admin/site/actions.ts
// Server actions for the site editor.
// Every action: requireAdmin() → Zod-validated → DB write → activity log → revalidate.

import { requireAdmin } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  saveDraftSections,
  discardDraft as dbDiscardDraft,
  publishDraft as dbPublishDraft,
  restoreRevisionToDraft,
} from "@/lib/db/site-content";
import { logActivity } from "@/lib/db/activity";
import { getPageDefinition, isSectionTypeAllowedForPage } from "@/lib/site-content/page-registry";
import type { Section } from "@/lib/site-content/types";

const PhotoRefSchema = z.object({
  source: z.enum(["PROJECT", "SITE"]),
  id: z.string().min(1),
  cloudflareImageId: z.string().min(1),
  eventId: z.string().optional(),
  altText: z.string().optional(),
});

const HeroSchema = z.object({
  id: z.string().min(1),
  type: z.literal("HERO"),
  slides: z.array(z.object({ photoRef: PhotoRefSchema, caption: z.string().optional() })),
  eyebrow: z.string().optional(),
  headline: z.string().optional(),
  sub: z.string().optional(),
  primaryCtaLabel: z.string().optional(),
  primaryCtaHref: z.string().optional(),
  secondaryCtaLabel: z.string().optional(),
  secondaryCtaHref: z.string().optional(),
});

const PhotoGridSchema = z.object({
  id: z.string().min(1),
  type: z.literal("PHOTO_GRID"),
  eyebrow: z.string().optional(),
  heading: z.string().optional(),
  body: z.string().optional(),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  photos: z.array(PhotoRefSchema),
});

const RichTextSchema = z.object({
  id: z.string().min(1),
  type: z.literal("RICH_TEXT"),
  eyebrow: z.string().optional(),
  heading: z.string().optional(),
  body: z.string().max(20000),
});

const CtaBannerSchema = z.object({
  id: z.string().min(1),
  type: z.literal("CTA_BANNER"),
  eyebrow: z.string().optional(),
  headline: z.string().min(1),
  primaryCtaLabel: z.string().optional(),
  primaryCtaHref: z.string().optional(),
  secondaryCtaLabel: z.string().optional(),
  secondaryCtaHref: z.string().optional(),
  variant: z.enum(["DARK", "LIGHT"]).optional(),
});

const SectionSchema = z.discriminatedUnion("type", [
  HeroSchema,
  PhotoGridSchema,
  RichTextSchema,
  CtaBannerSchema,
]);

type ActionResult = { success: true } | { success: false; error: string };

function publicPathFor(pageId: string): string | null {
  return getPageDefinition(pageId)?.publicHref ?? null;
}

export async function saveDraftAction(
  pageId: string,
  sectionsJson: string
): Promise<ActionResult> {
  const session = await requireAdmin();
  const def = getPageDefinition(pageId);
  if (!def) return { success: false, error: "Unknown page." };

  let parsedSections: Section[];
  try {
    parsedSections = z.array(SectionSchema).parse(JSON.parse(sectionsJson)) as Section[];
  } catch (err) {
    console.error("[site-editor] saveDraft validation:", err);
    return { success: false, error: "Invalid section payload." };
  }

  for (const s of parsedSections) {
    if (!isSectionTypeAllowedForPage(pageId, s.type)) {
      return { success: false, error: `Section type ${s.type} is not allowed on ${pageId}.` };
    }
  }

  await saveDraftSections(pageId, parsedSections, session.uid);
  await logActivity("SITE_DRAFT_SAVED", `Saved draft for site page "${def.label}".`, {
    surface: "site-editor",
    pageId,
    sectionCount: parsedSections.length,
    actorUid: session.uid,
  }).catch(() => {});

  revalidatePath(`/admin/site/${pageId}`);
  revalidatePath(`/admin/site/${pageId}/preview`);
  return { success: true };
}

export async function discardDraftAction(pageId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const def = getPageDefinition(pageId);
  if (!def) return { success: false, error: "Unknown page." };

  await dbDiscardDraft(pageId, session.uid);
  await logActivity("SITE_DRAFT_DISCARDED", `Discarded draft for site page "${def.label}".`, {
    surface: "site-editor",
    pageId,
    actorUid: session.uid,
  }).catch(() => {});

  revalidatePath(`/admin/site/${pageId}`);
  revalidatePath(`/admin/site/${pageId}/preview`);
  return { success: true };
}

export async function publishDraftAction(
  pageId: string,
  noteSummary?: string
): Promise<ActionResult> {
  const session = await requireAdmin();
  const def = getPageDefinition(pageId);
  if (!def) return { success: false, error: "Unknown page." };

  try {
    const { revisionId } = await dbPublishDraft(pageId, session.uid, noteSummary);
    await logActivity("SITE_PUBLISHED", `Published site page "${def.label}".`, {
      surface: "site-editor",
      pageId,
      revisionId,
      noteSummary: noteSummary ?? null,
      actorUid: session.uid,
    }).catch(() => {});

    revalidatePath(`/admin/site/${pageId}`);
    revalidatePath(`/admin/site/${pageId}/preview`);
    revalidatePath(`/admin/site/${pageId}/revisions`);
    const publicHref = publicPathFor(pageId);
    if (publicHref) revalidatePath(publicHref);

    return { success: true };
  } catch (err) {
    console.error("[site-editor] publish:", err);
    return { success: false, error: "Publish failed." };
  }
}

export async function restoreRevisionAction(
  pageId: string,
  revisionId: string
): Promise<ActionResult> {
  const session = await requireAdmin();
  const def = getPageDefinition(pageId);
  if (!def) return { success: false, error: "Unknown page." };

  try {
    await restoreRevisionToDraft(pageId, revisionId, session.uid);
    await logActivity("SITE_REVISION_RESTORED", `Restored revision into draft for site page "${def.label}".`, {
      surface: "site-editor",
      pageId,
      revisionId,
      actorUid: session.uid,
    }).catch(() => {});

    revalidatePath(`/admin/site/${pageId}`);
    revalidatePath(`/admin/site/${pageId}/preview`);
    revalidatePath(`/admin/site/${pageId}/revisions`);
    return { success: true };
  } catch (err) {
    console.error("[site-editor] restore:", err);
    return { success: false, error: "Restore failed." };
  }
}
