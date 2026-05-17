// scripts/migrate-event-status.ts
// Normalizes legacy/typo values in events/{id}.status to the canonical union
// declared in lib/db/events.ts:
//
//   UPCOMING | ACTIVE | COMPLETED | DELIVERED | ARCHIVED
//
// Anything else (lowercase, typos, legacy aliases) gets mapped to the closest
// canonical value below. Docs missing a status field get "UPCOMING" written in.
//
// Run modes:
//   npx tsx scripts/migrate-event-status.ts            (dry-run, default)
//   npx tsx scripts/migrate-event-status.ts --dry-run  (dry-run, explicit)
//   npx tsx scripts/migrate-event-status.ts --apply    (writes changes)
//
// Idempotent: re-running after --apply is a no-op (every doc lands in the set).

import { adminDb } from "../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { EventStatus } from "../lib/db/events";

const CANONICAL: ReadonlySet<EventStatus> = new Set([
  "UPCOMING",
  "ACTIVE",
  "COMPLETED",
  "DELIVERED",
  "ARCHIVED",
]);

// Legacy / typo / lowercase variants → canonical value.
// Keys are uppercased before lookup, so include only the uppercase form here.
const LEGACY_MAP: Record<string, EventStatus> = {
  // already-canonical (kept for explicit clarity; CANONICAL set handles these)
  UPCOMING: "UPCOMING",
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  DELIVERED: "DELIVERED",
  ARCHIVED: "ARCHIVED",

  // common synonyms / older spellings we may have written historically
  PENDING: "UPCOMING",
  SCHEDULED: "UPCOMING",
  DRAFT: "UPCOMING",
  IN_PROGRESS: "ACTIVE",
  ONGOING: "ACTIVE",
  LIVE: "ACTIVE",
  DONE: "COMPLETED",
  FINISHED: "COMPLETED",
  CLOSED: "COMPLETED",
  SENT: "DELIVERED",
  PUBLISHED: "DELIVERED",
  CANCELED: "ARCHIVED",
  CANCELLED: "ARCHIVED",
  HIDDEN: "ARCHIVED",
};

function normalize(raw: unknown): EventStatus {
  if (typeof raw !== "string") return "UPCOMING";
  const upper = raw.trim().toUpperCase();
  if (CANONICAL.has(upper as EventStatus)) return upper as EventStatus;
  if (LEGACY_MAP[upper]) return LEGACY_MAP[upper];
  return "UPCOMING";
}

async function run() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const mode = apply ? "APPLY (writes will happen)" : "DRY-RUN (no writes)";

  console.log(`migrate-event-status — mode: ${mode}`);

  // Bail with a useful message if Firebase Admin creds are missing locally,
  // rather than throwing the SDK's "not initialized" stack trace.
  if (
    !process.env.FIREBASE_PROJECT_ID ||
    !process.env.FIREBASE_CLIENT_EMAIL ||
    !process.env.FIREBASE_PRIVATE_KEY
  ) {
    console.log(
      "\nFirebase Admin credentials not found in environment — skipping scan."
    );
    console.log(
      "Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY"
    );
    console.log(
      "(in .env.local or your shell) and re-run. No events were touched."
    );
    return;
  }

  const snap = await adminDb.collection("events").get();
  console.log(`Scanned ${snap.size} event doc(s).\n`);

  const buckets: Record<EventStatus, number> = {
    UPCOMING: 0,
    ACTIVE: 0,
    COMPLETED: 0,
    DELIVERED: 0,
    ARCHIVED: 0,
  };

  let unchanged = 0;
  let normalized = 0;
  let missing = 0;
  const examples: { id: string; before: unknown; after: EventStatus }[] = [];

  // Batch writes in chunks of 400 to stay under Firestore's 500-op limit.
  let batch = adminDb.batch();
  let batchOps = 0;
  const commits: Promise<unknown>[] = [];

  for (const doc of snap.docs) {
    const before = doc.data().status as unknown;
    const after = normalize(before);
    buckets[after]++;

    const isCanonicalAlready =
      typeof before === "string" && CANONICAL.has(before as EventStatus);

    if (before === undefined || before === null) {
      missing++;
    } else if (isCanonicalAlready) {
      unchanged++;
      continue;
    } else {
      normalized++;
      if (examples.length < 10) examples.push({ id: doc.id, before, after });
    }

    if (apply) {
      batch.update(doc.ref, {
        status: after,
        updatedAt: FieldValue.serverTimestamp(),
      });
      batchOps++;
      if (batchOps >= 400) {
        commits.push(batch.commit());
        batch = adminDb.batch();
        batchOps = 0;
      }
    }
  }

  if (apply && batchOps > 0) {
    commits.push(batch.commit());
  }
  if (commits.length > 0) await Promise.all(commits);

  console.log("Result distribution (post-normalization):");
  for (const [status, count] of Object.entries(buckets)) {
    console.log(`  ${status.padEnd(10)} ${count}`);
  }

  const touched = normalized + missing;
  console.log("");
  console.log(`Unchanged (already canonical):  ${unchanged}`);
  console.log(`Normalized (legacy → canonical): ${normalized}`);
  console.log(`Missing status field (→ UPCOMING): ${missing}`);
  console.log(`Total docs that would be written: ${touched}`);

  if (examples.length > 0) {
    console.log("\nSample changes:");
    for (const e of examples) {
      console.log(`  ${e.id}  ${JSON.stringify(e.before)} → ${e.after}`);
    }
  }

  if (!apply) {
    console.log("\n(dry-run — no docs were modified; re-run with --apply to commit)");
  } else {
    console.log("\nApplied.");
  }
}

run().catch((err) => {
  console.error("migrate-event-status failed:", err);
  process.exit(1);
});
