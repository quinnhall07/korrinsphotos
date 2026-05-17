// scripts/seed-lead-magnets.ts
// Seeds four starter lead magnets in DRAFT status (Phase 4.1).
//
// Run with: npx tsx scripts/seed-lead-magnets.ts
//
// Idempotent: a magnet is skipped if one with the same `slug` already exists.
// The R2 files are NOT uploaded by this script — Korrin uploads the actual
// PDFs via /admin/lead-magnets/[id] after seeding.

import {
  createLeadMagnet,
  getLeadMagnetBySlug,
  type LeadMagnetDoc,
} from "../lib/db/lead-magnets";

type SeedInput = Omit<
  LeadMagnetDoc,
  "id" | "createdAt" | "updatedAt" | "downloadCount"
>;

const SEEDS: SeedInput[] = [
  {
    slug: "pricing-guide",
    title: "Korrin's Pricing Guide",
    description: "Packages, pricing, what's included.",
    r2Key: "lead-magnets/pricing-guide/placeholder.pdf",
    downloadFileName: "Korrins-Pricing-Guide.pdf",
    status: "DRAFT",
    followUpSequenceId: null,
    coverImageId: null,
  },
  {
    slug: "wedding-prep-guide",
    title: "The Wedding Prep Guide",
    description: "What to know in the 6 weeks before.",
    r2Key: "lead-magnets/wedding-prep-guide/placeholder.pdf",
    downloadFileName: "The-Wedding-Prep-Guide.pdf",
    status: "DRAFT",
    followUpSequenceId: null,
    coverImageId: null,
  },
  {
    slug: "engagement-what-to-wear",
    title: "What to Wear for Your Engagement Session",
    description:
      "A quiet, considered guide to wardrobe choices that will age well in your archive.",
    r2Key: "lead-magnets/engagement-what-to-wear/placeholder.pdf",
    downloadFileName: "What-to-Wear-for-Your-Engagement-Session.pdf",
    status: "DRAFT",
    followUpSequenceId: null,
    coverImageId: null,
  },
  {
    slug: "cary-rdu-venue-guide",
    title: "12 Venues Worth Booking in Cary/RDU",
    description:
      "A short list of venues that consistently deliver — light, scale, and a quiet kind of magic.",
    r2Key: "lead-magnets/cary-rdu-venue-guide/placeholder.pdf",
    downloadFileName: "12-Venues-Worth-Booking-in-Cary-RDU.pdf",
    status: "DRAFT",
    followUpSequenceId: null,
    coverImageId: null,
  },
];

async function run() {
  console.log("Seeding lead magnets…");

  let created = 0;
  let skipped = 0;

  for (const seed of SEEDS) {
    const existing = await getLeadMagnetBySlug(seed.slug);
    if (existing) {
      console.log(
        `  · skip  "${seed.slug}" (already exists: ${existing.id})`
      );
      skipped++;
      continue;
    }
    const doc = await createLeadMagnet(seed);
    console.log(`  + add   "${seed.slug}" → ${doc.id}`);
    created++;
  }

  console.log(
    `\nSeed complete — ${created} created, ${skipped} skipped, ${SEEDS.length} total.`
  );
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
