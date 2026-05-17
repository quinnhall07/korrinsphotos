// lib/domain/journal-drafter.ts
// Auto-draft a journal post for a delivered project. Fired from
// `lib/project-transitions.ts > onGalleryDelivered`. Idempotent — re-running
// for the same projectId returns the existing post without re-drafting.
//
// Server-only. Reads `projects`, `clients`, `events` + `events/{eventId}/photos`,
// and `vendors`; writes `journalPosts`.

import { adminDb } from "@/lib/firebase-admin";
import {
  createJournalPost,
  getJournalPostByProjectId,
  type JournalPostDoc,
} from "@/lib/db/journal-posts";
import { listVendors, type VendorDoc } from "@/lib/db/vendors";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Minimal in-line slugifier. Lower-cases, normalises diacritics,
 * collapses runs of non-alphanumerics to single hyphens, trims. No external
 * dep (the prompt forbids adding `slugify` to the bundle).
 */
function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/**
 * Best-effort city parse from a free-form location label. Heuristic: if the
 * label contains a comma, take the segment after the LAST comma and trim.
 * Otherwise return null. Examples:
 *   "The Bradford, Cary" → "Cary"
 *   "The Umstead, Cary, NC" → "NC"  (acceptable: trailing state segment)
 *   "Studio shoot"            → null
 */
function parseCityFromLocation(label?: string | null): string | null {
  if (!label) return null;
  const trimmed = label.trim();
  if (!trimmed.includes(",")) return null;
  const segments = trimmed.split(",");
  const last = segments[segments.length - 1]?.trim();
  return last && last.length > 0 ? last : null;
}

/**
 * Collapse a list of pieces into a `|`-separated title, dropping empties so
 * we never emit something like "Kelly | | Cary".
 */
function buildTitle(parts: Array<string | null | undefined>): string {
  return parts
    .map((p) => (p ?? "").trim())
    .filter((p) => p.length > 0)
    .join(" | ");
}

// ─── Photo selection ──────────────────────────────────────────────────────────

const MAX_PHOTOS = 30;

async function findEventIdForProject(
  projectId: string
): Promise<string | null> {
  try {
    const snap = await adminDb
      .collection("events")
      .where("projectId", "==", projectId)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return snap.docs[0].id;
  } catch (err) {
    console.error("[journal-drafter] event lookup failed", { projectId, err });
    return null;
  }
}

async function collectPhotoIds(eventId: string): Promise<string[]> {
  try {
    // `galleryReady == true`, ordered by `uploadedAt asc`, capped at MAX_PHOTOS.
    const snap = await adminDb
      .collection("events")
      .doc(eventId)
      .collection("photos")
      .where("galleryReady", "==", true)
      .orderBy("uploadedAt", "asc")
      .limit(MAX_PHOTOS)
      .get();
    return snap.docs
      .map((d) => d.data().cloudflareImageId as string | undefined)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch (err) {
    console.error("[journal-drafter] photo collection failed", {
      eventId,
      err,
    });
    return [];
  }
}

// ─── Vendor lookup ────────────────────────────────────────────────────────────

/**
 * Probe-style lookup: VendorDoc currently has no canonical link field
 * declared on the type. We read every vendor and filter by
 * `linkedProjectIds array-contains projectId` (the documented Phase 3.8
 * shape). Mirrors the approach used in `lib/domain/shoot-brief.ts`.
 */
async function collectLinkedVendorIds(projectId: string): Promise<string[]> {
  try {
    const vendors: VendorDoc[] = await listVendors();
    return vendors
      .filter((v) => {
        const ids = (v as unknown as { linkedProjectIds?: unknown })
          .linkedProjectIds;
        return Array.isArray(ids) && ids.includes(projectId);
      })
      .map((v) => v.id);
  } catch (err) {
    console.error("[journal-drafter] vendor lookup failed", { projectId, err });
    return [];
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Idempotent auto-drafter. If a post already exists for `projectId`, returns
 * it as-is. Otherwise reads the project + client + event + vendors, composes
 * a DRAFT post, and returns it.
 *
 * Returns `null` if the source project (or client) cannot be loaded — caller
 * should treat this as a soft failure (the GALLERY_DELIVERED hook wraps the
 * call in try/catch).
 */
export async function draftJournalPostForProject(
  projectId: string
): Promise<JournalPostDoc | null> {
  // 1. Idempotency guard — return the existing post if one is already drafted.
  const existing = await getJournalPostByProjectId(projectId);
  if (existing) return existing;

  // 2. Load project + client.
  const projectSnap = await adminDb
    .collection("projects")
    .doc(projectId)
    .get();
  if (!projectSnap.exists) return null;
  const project = projectSnap.data()!;
  const clientId = project.clientId as string | undefined;
  if (!clientId) return null;

  const clientSnap = await adminDb.collection("clients").doc(clientId).get();
  const client = clientSnap.exists ? clientSnap.data()! : null;

  // 3. Optional event lookup → photo selection.
  const eventId = await findEventIdForProject(projectId);
  const photoCloudflareIds = eventId ? await collectPhotoIds(eventId) : [];

  // 4. Vendor lookup.
  const vendorIds = await collectLinkedVendorIds(projectId);

  // 5. Compose copy fields.
  const clientFirstName = (client?.firstName as string | undefined)?.trim() || "";
  // No canonical "partner" field on the client doc. Skip silently when absent.
  const partnerFirstName =
    (client?.partnerFirstName as string | undefined)?.trim() || "";
  const shootLocation = (project.shootLocation ?? null) as
    | { label?: string }
    | null;
  const venueOrLocation = shootLocation?.label?.trim() || "";
  const city = parseCityFromLocation(shootLocation?.label) ?? "";
  const sessionType = (project.sessionType as string | undefined)?.trim() || "session";

  // Title: collapse separators when pieces are missing.
  const nameSegment = partnerFirstName
    ? `${clientFirstName} & ${partnerFirstName}`
    : clientFirstName;
  let title = buildTitle([nameSegment, venueOrLocation, city]);
  if (!title) title = `Project ${clientId.slice(0, 8)}`;

  const slug = slugify(title) || `project-${projectId.slice(0, 8)}`;

  const seoTitle = `${title} | Korrin's Photos`;
  const seoDescriptionVenue = venueOrLocation || "a beloved location";
  const seoDescriptionCity = city || "North Carolina";
  const seoDescription = `A ${sessionType.toLowerCase()} captured at ${seoDescriptionVenue}, ${seoDescriptionCity}.`;

  // 6. Pick a hero photo — first gallery-ready photo. May be null on empty.
  const heroPhotoCloudflareId = photoCloudflareIds[0] ?? null;

  const locationName = venueOrLocation || null;
  const cityValue = city || null;

  // 7. Write the draft.
  const draft = await createJournalPost({
    slug,
    status: "DRAFT",
    projectId,
    clientId,
    title,
    subtitle: null,
    heroPhotoCloudflareId,
    photoCloudflareIds,
    vendorIds,
    locationName,
    city: cityValue,
    bodyHtml: "",
    seoTitle,
    seoDescription,
  });

  return draft;
}

/**
 * Force a redraft of the **auto** fields only. Used by the
 * `redraftJournalPostFromProjectAction` Server Action. Korrin-owned fields
 * (`bodyHtml`, `title`, `subtitle`, `slug`, `status`) are deliberately
 * preserved.
 */
export async function redraftAutoFieldsForPost(
  postId: string,
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  const projectSnap = await adminDb
    .collection("projects")
    .doc(projectId)
    .get();
  if (!projectSnap.exists) {
    return { success: false, error: "Source project not found." };
  }
  const project = projectSnap.data()!;
  const clientId = project.clientId as string | undefined;
  if (!clientId) return { success: false, error: "Project has no client." };

  const clientSnap = await adminDb.collection("clients").doc(clientId).get();
  const client = clientSnap.exists ? clientSnap.data()! : null;

  const eventId = await findEventIdForProject(projectId);
  const photoCloudflareIds = eventId ? await collectPhotoIds(eventId) : [];
  const vendorIds = await collectLinkedVendorIds(projectId);

  const shootLocation = (project.shootLocation ?? null) as
    | { label?: string }
    | null;
  const venueOrLocation = shootLocation?.label?.trim() || "";
  const city = parseCityFromLocation(shootLocation?.label) ?? "";
  const sessionType = (project.sessionType as string | undefined)?.trim() || "session";
  const clientFirstName = (client?.firstName as string | undefined)?.trim() || "";
  const partnerFirstName =
    (client?.partnerFirstName as string | undefined)?.trim() || "";
  const nameSegment = partnerFirstName
    ? `${clientFirstName} & ${partnerFirstName}`
    : clientFirstName;
  const titleForSeo =
    buildTitle([nameSegment, venueOrLocation, city]) || `Project ${clientId.slice(0, 8)}`;

  const heroPhotoCloudflareId = photoCloudflareIds[0] ?? null;

  // Touches only auto fields — bodyHtml, title, subtitle, slug, status are
  // explicitly preserved.
  const { updateJournalPost } = await import("@/lib/db/journal-posts");
  await updateJournalPost(postId, {
    heroPhotoCloudflareId,
    photoCloudflareIds,
    vendorIds,
    locationName: venueOrLocation || null,
    city: city || null,
    seoTitle: `${titleForSeo} | Korrin's Photos`,
    seoDescription: `A ${sessionType.toLowerCase()} captured at ${
      venueOrLocation || "a beloved location"
    }, ${city || "North Carolina"}.`,
  });
  return { success: true };
}
