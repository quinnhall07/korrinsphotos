// scripts/seed-segments.ts
// Seeds the five starter segments (Phase 4.3).
//
// Run with: npx tsx scripts/seed-segments.ts
//   --dry-run     Print what would be created; do not write to Firestore.
//
// Idempotent: a segment is skipped if one with the same `name` already
// exists in the `segments` collection.
//
// Segment seeds:
//   1. All clients              · empty predicate (matches everyone)
//   2. Booked in last 90d       · projectStatus in [BOOKED, ...]
//                                 leadScoreMin 0 (broad)
//                                 deliveredAfter = today - 90d
//                                 (the resolver also walks projects, so this
//                                  catches recently-booked clients via their
//                                  project's BOOKED status; deliveredAfter is
//                                  permissive)
//   3. Past clients (12+ mo)    · deliveredBefore = today - 365d
//   4. Ghosted leads            · projectStatus in [INQUIRY, QUALIFYING]
//                                 leadScoreMin 0 (any score) — narrow with
//                                 manual tagging later
//   5. Engaged (life-event tag) · tagsInclude = ["engaged"]

import {
  createSegment,
  findSegmentByName,
  type SegmentDoc,
  type SegmentPredicate,
} from "../lib/db/segments";

type Seed = Omit<SegmentDoc, "id" | "createdAt" | "updatedAt">;

const DRY_RUN = process.argv.includes("--dry-run");

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  // ISO date (no time) so the resolver's `Date.parse` lands on UTC midnight.
  return d.toISOString().slice(0, 10);
}

const SEEDS: Seed[] = [
  {
    name: "All clients",
    description: "Every client in the database. The widest possible audience.",
    predicate: {} satisfies SegmentPredicate,
    lastResolvedCount: null,
    lastResolvedAt: null,
  },
  {
    name: "Booked in last 90d",
    description:
      "Clients with a project that hit BOOKED in the last ninety days. Useful for sneak-peek roundups and shoot-day prep blasts.",
    predicate: {
      projectStatus: ["BOOKED", "SHOOT_READY", "IN_EDITING"],
      deliveredAfter: daysAgoIso(90),
    } satisfies SegmentPredicate,
    lastResolvedCount: null,
    lastResolvedAt: null,
  },
  {
    name: "Past clients (12+ mo)",
    description:
      "Delivered galleries older than a year. Win-back, anniversary, and referral nudges target this group.",
    predicate: {
      deliveredBefore: daysAgoIso(365),
    } satisfies SegmentPredicate,
    lastResolvedCount: null,
    lastResolvedAt: null,
  },
  {
    name: "Ghosted leads",
    description:
      "Inquired or qualified, never booked. A cold-lead re-engagement broadcast or seasonal offer can revive them.",
    predicate: {
      projectStatus: ["INQUIRY", "QUALIFYING"],
    } satisfies SegmentPredicate,
    lastResolvedCount: null,
    lastResolvedAt: null,
  },
  {
    name: "Engaged (life-event tag)",
    description:
      "Tagged as recently engaged. Prime audience for wedding-package teasers.",
    predicate: {
      tagsInclude: ["engaged"],
    } satisfies SegmentPredicate,
    lastResolvedCount: null,
    lastResolvedAt: null,
  },
];

async function run() {
  console.log(`Seeding segments${DRY_RUN ? " (dry-run)" : ""}…`);

  let created = 0;
  let skipped = 0;

  for (const seed of SEEDS) {
    if (DRY_RUN) {
      console.log(
        `  · plan  "${seed.name}" → predicate: ${JSON.stringify(seed.predicate)}`
      );
      continue;
    }

    const existing = await findSegmentByName(seed.name);
    if (existing) {
      console.log(`  · skip  "${seed.name}" (already exists: ${existing.id})`);
      skipped++;
      continue;
    }
    const doc = await createSegment(seed);
    console.log(`  + add   "${seed.name}" → ${doc.id}`);
    created++;
  }

  if (DRY_RUN) {
    console.log(`\nDry-run complete — ${SEEDS.length} segments would be checked.`);
  } else {
    console.log(
      `\nSeed complete — ${created} created, ${skipped} skipped, ${SEEDS.length} total.`
    );
  }
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
