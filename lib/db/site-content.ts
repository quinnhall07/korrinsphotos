// lib/db/site-content.ts
// Persistence layer for the site editor — one doc per editable page.
// Server-only. See lib/site-content/types.ts for the Section shape.

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { Section } from "@/lib/site-content/types";

const REVISIONS_CAP = 50;

export interface SiteContentDoc {
  id: string;
  pageId: string;
  draftSections: Section[];
  publishedSections: Section[];
  draftDirty: boolean;
  publishedAt: Timestamp | null;
  publishedByUid: string | null;
  draftUpdatedAt: Timestamp | null;
  draftUpdatedByUid: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SiteContentRevisionDoc {
  id: string;
  sections: Section[];
  publishedAt: Timestamp;
  publishedByUid: string;
  noteSummary: string | null;
}

export const siteContentCol = () => adminDb.collection("siteContent");

function revisionsCol(pageId: string) {
  return siteContentCol().doc(pageId).collection("revisions");
}

export async function getSiteContent(pageId: string): Promise<SiteContentDoc | null> {
  const snap = await siteContentCol().doc(pageId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as Omit<SiteContentDoc, "id">) };
}

export async function loadPublishedSections(pageId: string): Promise<Section[] | null> {
  const doc = await getSiteContent(pageId);
  if (!doc) return null;
  if (!Array.isArray(doc.publishedSections) || doc.publishedSections.length === 0) return null;
  return doc.publishedSections;
}

export async function loadDraftSections(pageId: string): Promise<Section[] | null> {
  const doc = await getSiteContent(pageId);
  if (!doc) return null;
  if (!Array.isArray(doc.draftSections) || doc.draftSections.length === 0) return null;
  return doc.draftSections;
}

export async function saveDraftSections(
  pageId: string,
  sections: Section[],
  uid: string
): Promise<void> {
  const ref = siteContentCol().doc(pageId);
  const existing = await ref.get();

  if (!existing.exists) {
    await ref.set({
      pageId,
      draftSections: sections,
      publishedSections: [],
      draftDirty: true,
      publishedAt: null,
      publishedByUid: null,
      draftUpdatedAt: FieldValue.serverTimestamp(),
      draftUpdatedByUid: uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return;
  }

  await ref.update({
    draftSections: sections,
    draftDirty: true,
    draftUpdatedAt: FieldValue.serverTimestamp(),
    draftUpdatedByUid: uid,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function discardDraft(pageId: string, uid: string): Promise<Section[]> {
  const ref = siteContentCol().doc(pageId);
  const snap = await ref.get();
  if (!snap.exists) return [];
  const data = snap.data() as Omit<SiteContentDoc, "id">;
  const published = data.publishedSections ?? [];
  await ref.update({
    draftSections: published,
    draftDirty: false,
    draftUpdatedAt: FieldValue.serverTimestamp(),
    draftUpdatedByUid: uid,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return published;
}

export async function publishDraft(
  pageId: string,
  uid: string,
  noteSummary?: string
): Promise<{ revisionId: string; sections: Section[] }> {
  const ref = siteContentCol().doc(pageId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`No draft to publish for pageId="${pageId}"`);

  const data = snap.data() as Omit<SiteContentDoc, "id">;
  const sections = data.draftSections ?? [];

  const revisionRef = revisionsCol(pageId).doc();
  await revisionRef.set({
    sections,
    publishedAt: FieldValue.serverTimestamp(),
    publishedByUid: uid,
    noteSummary: noteSummary ?? null,
  });

  await ref.update({
    publishedSections: sections,
    draftDirty: false,
    publishedAt: FieldValue.serverTimestamp(),
    publishedByUid: uid,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await pruneOldRevisions(pageId);

  return { revisionId: revisionRef.id, sections };
}

async function pruneOldRevisions(pageId: string): Promise<void> {
  const snap = await revisionsCol(pageId)
    .orderBy("publishedAt", "desc")
    .offset(REVISIONS_CAP)
    .get();
  if (snap.empty) return;
  const batch = adminDb.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

export async function listRevisions(pageId: string, limit = 25): Promise<SiteContentRevisionDoc[]> {
  const snap = await revisionsCol(pageId)
    .orderBy("publishedAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SiteContentRevisionDoc, "id">) }));
}

export async function restoreRevisionToDraft(
  pageId: string,
  revisionId: string,
  uid: string
): Promise<Section[]> {
  const revSnap = await revisionsCol(pageId).doc(revisionId).get();
  if (!revSnap.exists) throw new Error(`Revision not found: ${revisionId}`);
  const rev = revSnap.data() as Omit<SiteContentRevisionDoc, "id">;
  await saveDraftSections(pageId, rev.sections, uid);
  return rev.sections;
}
