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
  getSiteContent,
} from "@/lib/db/site-content";
import { logActivity } from "@/lib/db/activity";
import { getPageDefinition } from "@/lib/site-content/page-registry";
import { isReservedSlug } from "@/app/[slug]/page";
import type { Section, SectionType } from "@/lib/site-content/types";

// Custom pages (no registry entry) accept any registered section type.
const CUSTOM_PAGE_ALLOWED_SECTIONS: readonly SectionType[] = [
  "HERO",
  "PHOTO_GRID",
  "SLIDESHOW",
  "STATS",
  "RICH_TEXT",
  "CTA_BANNER",
  "PROCESS_STEPS",
  "PACKAGE_CARDS",
  "TESTIMONIAL",
];

function allowedSectionsFor(pageId: string): readonly SectionType[] {
  const def = getPageDefinition(pageId);
  if (def) return def.allowedSections;
  return CUSTOM_PAGE_ALLOWED_SECTIONS;
}

async function resolvePageLabel(pageId: string): Promise<string> {
  const def = getPageDefinition(pageId);
  if (def) return def.label;
  return pageId.charAt(0).toUpperCase() + pageId.slice(1);
}

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

const ProcessStepsSchema = z.object({
  id: z.string().min(1),
  type: z.literal("PROCESS_STEPS"),
  eyebrow: z.string().optional(),
  heading: z.string().optional(),
  intro: z.string().optional(),
  steps: z.array(z.object({
    n: z.string().max(8),
    title: z.string().max(200),
    body: z.string().max(2000),
  })),
});

const PackageCardsSchema = z.object({
  id: z.string().min(1),
  type: z.literal("PACKAGE_CARDS"),
  eyebrow: z.string().optional(),
  heading: z.string().optional(),
  intro: z.string().optional(),
  packages: z.array(z.object({
    id: z.string().min(1).max(80),
    name: z.string().max(120),
    startingPriceUsd: z.number().min(0).max(1_000_000),
    sessionType: z.string().max(80),
    includes: z.array(z.string().max(200)).max(20),
    idealFor: z.string().max(400),
    ctaLabel: z.string().max(80).optional(),
  })),
});

const TestimonialSchema = z.object({
  id: z.string().min(1),
  type: z.literal("TESTIMONIAL"),
  eyebrow: z.string().optional(),
  quote: z.string().min(1).max(4000),
  author: z.string().max(120).optional(),
  authorRole: z.string().max(160).optional(),
  variant: z.enum(["DARK", "LIGHT"]).optional(),
});

const SlideshowSchema = z.object({
  id: z.string().min(1),
  type: z.literal("SLIDESHOW"),
  eyebrow: z.string().optional(),
  heading: z.string().optional(),
  slides: z.array(PhotoRefSchema),
  intervalMs: z.number().min(1500).max(30000).optional(),
});

const StatsSchema = z.object({
  id: z.string().min(1),
  type: z.literal("STATS"),
  items: z.array(z.object({
    number: z.string().max(40),
    label: z.string().max(120),
  })),
});

const SectionSchema = z.discriminatedUnion("type", [
  HeroSchema,
  PhotoGridSchema,
  RichTextSchema,
  CtaBannerSchema,
  ProcessStepsSchema,
  PackageCardsSchema,
  TestimonialSchema,
  SlideshowSchema,
  StatsSchema,
]);

type ActionResult = { success: true } | { success: false; error: string };

function publicPathFor(pageId: string): string | null {
  const def = getPageDefinition(pageId);
  if (def) return def.publicHref;
  // Custom admin-created pages live under `/{slug}`.
  return `/${pageId}`;
}

// True for a built-in page in the registry, OR a custom page that already
// has a doc in `siteContent`. Used as the existence check on every mutation.
async function pageExists(pageId: string): Promise<boolean> {
  if (getPageDefinition(pageId)) return true;
  if (isReservedSlug(pageId)) return false;
  const doc = await getSiteContent(pageId);
  return !!doc;
}

export async function saveDraftAction(
  pageId: string,
  sectionsJson: string
): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!(await pageExists(pageId))) return { success: false, error: "Unknown page." };
  const label = await resolvePageLabel(pageId);

  let parsedSections: Section[];
  try {
    parsedSections = z.array(SectionSchema).parse(JSON.parse(sectionsJson)) as Section[];
  } catch (err) {
    console.error("[site-editor] saveDraft validation:", err);
    return { success: false, error: "Invalid section payload." };
  }

  const allowed = allowedSectionsFor(pageId);
  for (const s of parsedSections) {
    if (!allowed.includes(s.type)) {
      return { success: false, error: `Section type ${s.type} is not allowed on ${pageId}.` };
    }
  }

  await saveDraftSections(pageId, parsedSections, session.uid);
  await logActivity("SITE_DRAFT_SAVED", `Saved draft for site page "${label}".`, {
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
  if (!(await pageExists(pageId))) return { success: false, error: "Unknown page." };
  const label = await resolvePageLabel(pageId);

  await dbDiscardDraft(pageId, session.uid);
  await logActivity("SITE_DRAFT_DISCARDED", `Discarded draft for site page "${label}".`, {
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
  if (!(await pageExists(pageId))) return { success: false, error: "Unknown page." };
  const label = await resolvePageLabel(pageId);

  try {
    const { revisionId } = await dbPublishDraft(pageId, session.uid, noteSummary);
    await logActivity("SITE_PUBLISHED", `Published site page "${label}".`, {
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
    // Catch-all custom pages live at `/{slug}`.
    if (!getPageDefinition(pageId)) revalidatePath(`/${pageId}`);

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
  if (!(await pageExists(pageId))) return { success: false, error: "Unknown page." };
  const label = await resolvePageLabel(pageId);

  try {
    await restoreRevisionToDraft(pageId, revisionId, session.uid);
    await logActivity("SITE_REVISION_RESTORED", `Restored revision into draft for site page "${label}".`, {
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

const SlugSchema = z
  .string()
  .min(2)
  .max(40)
  .regex(/^[a-z][a-z0-9-]*$/, "Slug must be lowercase, kebab-case, starting with a letter.");

/**
 * Create a brand-new admin-defined page at the given slug. Reserved
 * top-level paths refuse; existing siteContent docs refuse; everything else
 * gets a tiny seed page (one HERO + one RICH_TEXT) saved as a draft, so the
 * admin can iterate before publishing.
 */
export async function createCustomPageAction(
  rawSlug: string,
  label: string
): Promise<ActionResult & { slug?: string }> {
  const session = await requireAdmin();
  const slugParse = SlugSchema.safeParse(rawSlug.trim());
  if (!slugParse.success) {
    return { success: false, error: slugParse.error.errors[0]?.message ?? "Invalid slug." };
  }
  const slug = slugParse.data;
  if (isReservedSlug(slug)) {
    return { success: false, error: "That slug is reserved by an existing route." };
  }
  if (getPageDefinition(slug)) {
    return { success: false, error: "That page already exists." };
  }
  const existing = await getSiteContent(slug);
  if (existing) {
    return { success: false, error: "That page already exists." };
  }

  const safeLabel = label.trim().slice(0, 80) || slug;
  const initialSections: Section[] = [
    {
      id: `${slug}-hero-${Math.random().toString(36).slice(2, 6)}`,
      type: "HERO",
      slides: [],
      eyebrow: safeLabel,
      headline: safeLabel,
      sub: "Tell visitors what this page is about.",
    },
    {
      id: `${slug}-richtext-${Math.random().toString(36).slice(2, 6)}`,
      type: "RICH_TEXT",
      body: "Write your content here. Use **bold** and *italic* — supported Markdown is limited but predictable.",
    },
  ];

  await saveDraftSections(slug, initialSections, session.uid);
  await logActivity("SITE_PAGE_CREATED", `Created new page "${safeLabel}" at /${slug}.`, {
    surface: "site-editor",
    pageId: slug,
    actorUid: session.uid,
  }).catch(() => {});

  revalidatePath("/admin/site");
  return { success: true, slug };
}
