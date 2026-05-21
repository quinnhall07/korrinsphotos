// scripts/2026-05-remap-portfolio-categories.ts
// Backfill the new portfolio category vocabulary (May 2026 redesign).
//
// Legacy stored values → new canonical values:
//   wedding   → portraits
//   portrait  → portraits
//   editorial → edits
//   landscape → landscapes
//
// Anything else is left alone. A new "nature" category is now valid but is
// NEVER auto-assigned — it requires an explicit tag from the admin upload UI.
//
// Run modes:
//   npx tsx scripts/2026-05-remap-portfolio-categories.ts             (dry-run, default)
//   npx tsx scripts/2026-05-remap-portfolio-categories.ts --apply     (writes changes)
//
// Idempotent: re-running after --apply is a no-op (target values short-circuit).

import { adminDb } from "../lib/firebase-admin";

const REMAP: Record<string, string> = {
  wedding:   "portraits",
  portrait:  "portraits",
  editorial: "edits",
  landscape: "landscapes",
};

async function run() {
  const apply = process.argv.includes("--apply");
  const mode = apply ? "APPLY" : "DRY-RUN";
  console.log(`Portfolio category remap — ${mode}`);

  // collectionGroup query picks up every events/{id}/photos doc + the flat
  // photos collection if it exists. Single field filter keeps the query
  // index-light.
  const snap = await adminDb.collectionGroup("photos").get();
  console.log(`Scanned ${snap.size} photos.`);

  let toUpdate = 0;
  let alreadyCanonical = 0;
  let untouched = 0;
  const counts: Record<string, number> = {};

  const batches: { ref: FirebaseFirestore.DocumentReference; to: string; from: string }[] = [];

  for (const doc of snap.docs) {
    const c = doc.get("category");
    if (typeof c !== "string") {
      untouched++;
      continue;
    }
    const v = c.trim().toLowerCase();
    if (v === "") {
      untouched++;
      continue;
    }
    if (REMAP[v]) {
      const target = REMAP[v];
      toUpdate++;
      counts[`${v}→${target}`] = (counts[`${v}→${target}`] ?? 0) + 1;
      batches.push({ ref: doc.ref, to: target, from: v });
    } else if (["portraits", "landscapes", "nature", "edits"].includes(v)) {
      alreadyCanonical++;
    } else {
      untouched++;
    }
  }

  console.log(`\nSummary:`);
  console.log(`  Will update:        ${toUpdate}`);
  console.log(`  Already canonical:  ${alreadyCanonical}`);
  console.log(`  Untouched (other):  ${untouched}`);
  console.log(`\nBy mapping:`);
  for (const [k, n] of Object.entries(counts)) {
    console.log(`  ${k.padEnd(28)} ${n}`);
  }

  if (!apply) {
    console.log(`\nRe-run with --apply to write changes.`);
    return;
  }

  // Commit in batches of 400 (under the 500-write Firestore cap).
  const CHUNK = 400;
  for (let i = 0; i < batches.length; i += CHUNK) {
    const batch = adminDb.batch();
    const chunk = batches.slice(i, i + CHUNK);
    for (const { ref, to } of chunk) {
      batch.update(ref, { category: to });
    }
    await batch.commit();
    console.log(`  Committed ${i + chunk.length}/${batches.length}`);
  }

  console.log(`\nDone. Updated ${batches.length} photos.`);
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
