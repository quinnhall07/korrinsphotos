// scripts/seed-sequences.ts
// Seeds the six starter sequences (Phase 4.2).
//
// Run with: npx tsx scripts/seed-sequences.ts
//
// Idempotent: a sequence is skipped if one with the same `name` already
// exists in the `sequences` collection.

import {
  createSequence,
  findSequenceByName,
  type SequenceDoc,
} from "../lib/db/sequences";

type SequenceSeed = Omit<SequenceDoc, "id" | "createdAt" | "updatedAt">;

const SEEDS: SequenceSeed[] = [
  // 1. Cold-lead nurture — manual enroll for now
  {
    name: "Cold-lead nurture",
    description:
      "Five-touch warm-up for leads that have gone cold. Manual enroll until we wire a gated trigger.",
    trigger: "MANUAL",
    triggerStatus: null,
    dateAnchor: null,
    active: true,
    steps: [
      { delayHours: 0, channel: "EMAIL", templateId: "cold-lead-1", conditionPredicate: null },
      { delayHours: 48, channel: "EMAIL", templateId: "cold-lead-2", conditionPredicate: null },
      { delayHours: 168, channel: "EMAIL", templateId: "cold-lead-3", conditionPredicate: null },
      { delayHours: 336, channel: "EMAIL", templateId: "cold-lead-4", conditionPredicate: null },
      { delayHours: 672, channel: "EMAIL", templateId: "cold-lead-5", conditionPredicate: null },
    ],
  },

  // 2. Shoot-day countdown — relative to shootDate
  {
    name: "Shoot-day countdown",
    description:
      "Four-touch pre-shoot ramp: 4w out, 1w out, 2d out, day-of. Anchored to shootDate.",
    trigger: "DATE_RELATIVE_TO_SHOOT",
    triggerStatus: null,
    dateAnchor: "shootDate",
    active: true,
    steps: [
      { delayHours: -672, channel: "EMAIL", templateId: "shoot-day-4w", conditionPredicate: null },
      { delayHours: -168, channel: "EMAIL", templateId: "shoot-day-1w", conditionPredicate: null },
      { delayHours: -48, channel: "EMAIL", templateId: "shoot-day-2d", conditionPredicate: null },
      { delayHours: 0, channel: "EMAIL", templateId: "shoot-day-of", conditionPredicate: null },
    ],
  },

  // 3. Sneak peek + delivery — fires on IN_EDITING
  {
    name: "Sneak peek + delivery",
    description:
      "Two-touch hold-the-hand sequence after the shoot lands in editing.",
    trigger: "STATUS_CHANGE",
    triggerStatus: "IN_EDITING",
    dateAnchor: null,
    active: true,
    steps: [
      { delayHours: 0, channel: "EMAIL", templateId: "sneak-peek-1", conditionPredicate: null },
      { delayHours: 120, channel: "EMAIL", templateId: "sneak-peek-2", conditionPredicate: null },
    ],
  },

  // 4. Review request — fires on GALLERY_DELIVERED
  {
    name: "Review request",
    description:
      "Single touch one week after the gallery is delivered — asks for a Google review.",
    trigger: "STATUS_CHANGE",
    triggerStatus: "GALLERY_DELIVERED",
    dateAnchor: null,
    active: true,
    steps: [
      {
        delayHours: 168,
        channel: "EMAIL",
        templateId: "review-request-google",
        conditionPredicate: null,
      },
    ],
  },

  // 5. Anniversary touch — one year after delivery
  {
    name: "Anniversary touch",
    description:
      "Single touch one year after the gallery is delivered. Anchored to deliveredAt.",
    trigger: "DATE_RELATIVE_TO_SHOOT",
    triggerStatus: null,
    dateAnchor: "deliveredAt",
    active: true,
    steps: [
      {
        delayHours: 8760,
        channel: "EMAIL",
        templateId: "anniversary-touch",
        conditionPredicate: null,
      },
    ],
  },

  // 6. Win-back — manual for now, will be cron-gated later
  {
    name: "Win-back",
    description:
      "Single touch to revive long-dormant clients. Manual until the gated cron is wired.",
    trigger: "MANUAL",
    triggerStatus: null,
    dateAnchor: null,
    active: true,
    steps: [
      {
        delayHours: 0,
        channel: "EMAIL",
        templateId: "winback-1",
        conditionPredicate: null,
      },
    ],
  },
];

async function run() {
  console.log("Seeding sequences…");

  let created = 0;
  let skipped = 0;

  for (const seed of SEEDS) {
    const existing = await findSequenceByName(seed.name);
    if (existing) {
      console.log(`  · skip  "${seed.name}" (already exists: ${existing.id})`);
      skipped++;
      continue;
    }
    const doc = await createSequence(seed);
    console.log(`  + add   "${seed.name}" → ${doc.id}`);
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
