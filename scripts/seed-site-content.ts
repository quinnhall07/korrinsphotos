// scripts/seed-site-content.ts
// One-time seed: write current page designs into Firestore as PUBLISHED
// site-editor sections so public pages can render via the single SectionsCanvas
// path (no hand-coded fallback).
//   npx tsx scripts/seed-site-content.ts            (dry-run, default)
//   npx tsx scripts/seed-site-content.ts --apply    (writes)
// Idempotent: a page that already has publishedSections is skipped. A legacy
// `investment` doc is migrated to `pricing` then deleted.

import { adminDb } from "../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { Section } from "../lib/site-content/types";
import { HOME_DEFAULTS } from "../lib/site-content/defaults/home";
import { PORTFOLIO_DEFAULTS } from "../lib/site-content/defaults/portfolio";
import { INVESTMENT_DEFAULTS } from "../lib/site-content/defaults/investment";
import { BOOKING_DEFAULTS } from "../lib/site-content/defaults/booking";

const SEED: Record<string, Section[]> = {
  home: HOME_DEFAULTS,
  portfolio: PORTFOLIO_DEFAULTS,
  pricing: INVESTMENT_DEFAULTS, // investment design becomes the pricing page
  booking: BOOKING_DEFAULTS,
};

async function run() {
  const apply = process.argv.includes("--apply");
  const mode = apply ? "APPLY" : "DRY-RUN";
  const col = adminDb.collection("siteContent");

  const legacy = await col.doc("investment").get();
  if (legacy.exists) {
    console.log(`[${mode}] legacy 'investment' doc found -> migrate to 'pricing' + delete.`);
    if (apply) {
      const pricingRef = col.doc("pricing");
      if (!(await pricingRef.get()).exists) {
        await pricingRef.set({ ...legacy.data(), pageId: "pricing", updatedAt: FieldValue.serverTimestamp() });
      }
      await col.doc("investment").delete();
    }
  }

  for (const [pageId, sections] of Object.entries(SEED)) {
    const ref = col.doc(pageId);
    const snap = await ref.get();
    const existing = snap.exists ? (snap.data()?.publishedSections as Section[] | undefined) : undefined;
    if (existing && existing.length > 0) {
      console.log(`[${mode}] ${pageId}: already has ${existing.length} published sections - SKIP`);
      continue;
    }
    console.log(`[${mode}] ${pageId}: would seed ${sections.length} sections`);
    if (apply) {
      await ref.set(
        {
          pageId,
          draftSections: sections,
          publishedSections: sections,
          draftDirty: false,
          publishedAt: FieldValue.serverTimestamp(),
          publishedByUid: "seed-script",
          draftUpdatedAt: FieldValue.serverTimestamp(),
          draftUpdatedByUid: "seed-script",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
  }
  console.log(`[${mode}] done.`);
}

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
