// lib/db/journal-posts.ts
// Persistence for `journalPosts/{id}`. A journal post is the public-facing
// editorial write-up paired with a delivered project — auto-drafted on
// `GALLERY_DELIVERED`, hand-edited by Korrin, then published to /journal/[slug].
//
// Server-only: imports `adminDb`. Never import from a "use client" file.

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export type JournalPostStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

/**
 * Public journal post — one per delivered project (auto-drafted by
 * `lib/domain/journal-drafter.ts`). `bodyHtml` is intentionally empty on
 * first draft; Korrin fills it in via the admin editor. Once published,
 * `slug`, `title`, `subtitle`, and `bodyHtml` are Korrin-owned and must
 * never be overwritten by the redraft hook.
 */
export interface JournalPostDoc {
  id: string;
  /** URL-safe identifier. Unique across the collection; immutable post-create. */
  slug: string;
  status: JournalPostStatus;
  /** Source project — used by the redraft helper to repopulate auto fields. */
  projectId: string;
  clientId: string;
  /** Display title (rendered as the page H1). Example: "Kelly & Michael | The Bradford | Cary". */
  title: string;
  subtitle?: string | null;
  /** Cloudflare Images id for the hero / og:image. Optional — falls back to first photo. */
  heroPhotoCloudflareId?: string | null;
  /** Ordered Cloudflare Images ids, up to 30. Empty on drafts without ready photos. */
  photoCloudflareIds: string[];
  /** Vendor ids pulled at draft time. Refreshed on redraft, otherwise frozen. */
  vendorIds: string[];
  locationName?: string | null;
  city?: string | null;
  /** Free-form HTML. Korrin is the only author — trusted at render time. */
  bodyHtml: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  publishedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const journalPostsCol = () => adminDb.collection("journalPosts");

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function getJournalPost(id: string): Promise<JournalPostDoc | null> {
  const snap = await journalPostsCol().doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as JournalPostDoc) : null;
}

export async function getJournalPostBySlug(
  slug: string
): Promise<JournalPostDoc | null> {
  const snap = await journalPostsCol().where("slug", "==", slug).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() } as JournalPostDoc;
}

export async function getJournalPostByProjectId(
  projectId: string
): Promise<JournalPostDoc | null> {
  const snap = await journalPostsCol()
    .where("projectId", "==", projectId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() } as JournalPostDoc;
}

/**
 * List every journal post, newest first. Status filter is optional.
 * Used by the admin index — public callers should use
 * `listPublishedJournalPostsForIndex` instead.
 */
export async function listJournalPosts(
  status?: JournalPostStatus
): Promise<JournalPostDoc[]> {
  let query = journalPostsCol().orderBy(
    "createdAt",
    "desc"
  ) as FirebaseFirestore.Query;
  if (status) query = query.where("status", "==", status);
  const snap = await query.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as JournalPostDoc));
}

/**
 * Public index — published posts only, sorted by `publishedAt` desc.
 * Posts missing `publishedAt` are filtered out (defensive — they shouldn't
 * exist, since `publishJournalPostAction` stamps the field).
 */
export async function listPublishedJournalPostsForIndex(
  limit?: number
): Promise<JournalPostDoc[]> {
  let query = journalPostsCol()
    .where("status", "==", "PUBLISHED")
    .orderBy("publishedAt", "desc") as FirebaseFirestore.Query;
  if (typeof limit === "number" && limit > 0) query = query.limit(limit);
  const snap = await query.get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as JournalPostDoc))
    .filter((p) => !!p.publishedAt);
}

// ─── Writes ───────────────────────────────────────────────────────────────────

type CreateJournalPostInput = Omit<
  JournalPostDoc,
  "id" | "createdAt" | "updatedAt"
>;

/**
 * Slug-collision handling: read first, append `-2`, `-3`, … until a free slug
 * is found. Best-effort — NOT transactional. Two concurrent creates could
 * still collide, but the auto-drafter is idempotent (one post per project),
 * so the race window is effectively zero in practice.
 */
async function resolveUniqueSlug(baseSlug: string): Promise<string> {
  const fallback = baseSlug.trim().length > 0 ? baseSlug : "untitled";
  let candidate = fallback;
  let suffix = 2;
  // Cap the loop just in case the collection grows pathologically.
  while (suffix < 1000) {
    const existing = await getJournalPostBySlug(candidate);
    if (!existing) return candidate;
    candidate = `${fallback}-${suffix}`;
    suffix += 1;
  }
  // Pathological fallback — append a timestamp suffix.
  return `${fallback}-${Date.now()}`;
}

export async function createJournalPost(
  input: CreateJournalPostInput
): Promise<JournalPostDoc> {
  const slug = await resolveUniqueSlug(input.slug);
  const ref = journalPostsCol().doc();
  const now = Timestamp.now();
  const fullData = { ...input, slug, createdAt: now, updatedAt: now };
  await ref.set(fullData);
  return { id: ref.id, ...fullData } as JournalPostDoc;
}

export async function updateJournalPost(
  id: string,
  patch: Partial<Omit<JournalPostDoc, "id" | "createdAt">>
): Promise<void> {
  await journalPostsCol().doc(id).update({
    ...patch,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function deleteJournalPost(id: string): Promise<void> {
  await journalPostsCol().doc(id).delete();
}
