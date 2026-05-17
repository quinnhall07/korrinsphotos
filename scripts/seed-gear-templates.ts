// scripts/seed-gear-templates.ts
// Seeds the five default gear templates (Phase 3.7).
//
// Run with: npx tsx scripts/seed-gear-templates.ts
//   --dry-run     Print what would be created; do not write to Firestore.
//
// Idempotent: a default template for a given sessionType is only inserted if
// no default template for that sessionType already exists. Per-sessionType
// uniqueness is the relevant constraint, so re-running this script after the
// admin has tweaked the seed defaults (or added their own) is safe.

import {
  createGearTemplate,
  getDefaultGearTemplateForSessionType,
  type GearItem,
  type GearItemCategory,
  type GearTemplateDoc,
} from "../lib/db/gear-templates";

type Seed = Omit<GearTemplateDoc, "id" | "createdAt" | "updatedAt">;

const DRY_RUN = process.argv.includes("--dry-run");

// Stable per-template item id helper. Each template uses deterministic ids
// based on the seed name so re-running with `--dry-run` is reproducible.
const i = (
  id: string,
  name: string,
  category: GearItemCategory,
  required = false,
  notes?: string
): GearItem => ({
  id,
  name,
  category,
  required,
  ...(notes ? { notes } : {}),
});

// ─── Wedding (15 items) ──────────────────────────────────────────────────────

const WEDDING: Seed = {
  name: "Wedding kit",
  sessionType: "Wedding",
  isDefault: true,
  items: [
    i("body-primary", "Primary body (R5 / Z9 class)", "CAMERA", true),
    i("body-secondary", "Secondary body", "CAMERA", true, "Mounted with 70-200 during ceremony"),
    i("lens-24-70", "24-70mm f/2.8", "LENS", true),
    i("lens-70-200", "70-200mm f/2.8", "LENS", true),
    i("lens-35", "35mm f/1.4", "LENS", true),
    i("lens-85", "85mm f/1.4", "LENS", true),
    i("flash-speedlight", "Speedlight + diffuser", "LIGHTING", true),
    i("ocf-stand", "Off-camera flash stand + trigger", "LIGHTING", false),
    i("audio-recorder", "Audio recorder for ceremony", "AUDIO", false, "Clip a lav on the officiant"),
    i("batteries-spare", "Spare camera batteries (4+)", "ACCESSORY", true),
    i("sd-cards", "SD / CFexpress cards (formatted)", "STORAGE", true),
    i("laptop-backup", "Backup laptop + card reader", "BACKUP", true, "Offload between ceremony and reception"),
    i("nd-filters", "ND filters (3-stop, 6-stop)", "ACCESSORY", false),
    i("light-meter", "Light meter", "ACCESSORY", false),
    i("cleaning-kit", "Sensor + lens cleaning kit", "ACCESSORY", false),
  ],
};

// ─── Portrait (8 items) ──────────────────────────────────────────────────────

const PORTRAIT: Seed = {
  name: "Portrait kit",
  sessionType: "Portrait",
  isDefault: true,
  items: [
    i("body-primary", "Primary body", "CAMERA", true),
    i("lens-24-70", "24-70mm f/2.8", "LENS", true),
    i("lens-35", "35mm f/1.4", "LENS", false),
    i("lens-85", "85mm f/1.4", "LENS", true),
    i("reflector", "5-in-1 reflector", "LIGHTING", false),
    i("batteries-spare", "Spare camera batteries (2+)", "ACCESSORY", true),
    i("sd-cards", "SD cards (formatted)", "STORAGE", true),
    i("cleaning-kit", "Lens cleaning kit", "ACCESSORY", false),
  ],
};

// ─── Family (9 items) ────────────────────────────────────────────────────────

const FAMILY: Seed = {
  name: "Family kit",
  sessionType: "Family",
  isDefault: true,
  items: [
    i("body-primary", "Primary body", "CAMERA", true),
    i("lens-24-70", "24-70mm f/2.8", "LENS", true),
    i("lens-35", "35mm f/1.4", "LENS", true, "Great for wide group shots"),
    i("lens-85", "85mm f/1.4", "LENS", true),
    i("reflector", "5-in-1 reflector", "LIGHTING", false),
    i("batteries-spare", "Spare camera batteries (2+)", "ACCESSORY", true),
    i("sd-cards", "SD cards (formatted)", "STORAGE", true),
    i("snacks", "Bribery snacks for kids", "OTHER", false, "Goldfish, lollipops"),
    i("cleaning-kit", "Lens cleaning kit", "ACCESSORY", false),
  ],
};

// ─── Editorial (8 items) ─────────────────────────────────────────────────────

const EDITORIAL: Seed = {
  name: "Editorial kit",
  sessionType: "Editorial",
  isDefault: true,
  items: [
    i("body-primary", "Primary body", "CAMERA", true),
    i("lens-35", "35mm f/1.4 prime", "LENS", true),
    i("lens-50", "50mm f/1.2 prime", "LENS", true),
    i("lens-85", "85mm f/1.4 prime", "LENS", true),
    i("ocf-kit", "OCF kit (Profoto B10 or equivalent)", "LIGHTING", true),
    i("light-meter", "Light meter", "ACCESSORY", true),
    i("sd-cards", "SD cards (formatted)", "STORAGE", true),
    i("tether-cable", "Tethering cable + laptop", "BACKUP", false),
  ],
};

// ─── Engagement (9 items) ────────────────────────────────────────────────────

const ENGAGEMENT: Seed = {
  name: "Engagement kit",
  sessionType: "Engagement",
  isDefault: true,
  items: [
    i("body-primary", "Primary body", "CAMERA", true),
    i("body-secondary", "Secondary body", "CAMERA", false, "Pre-mounted with 85 for quick swap"),
    i("lens-24-70", "24-70mm f/2.8", "LENS", true),
    i("lens-35", "35mm f/1.4", "LENS", true),
    i("lens-85", "85mm f/1.4", "LENS", true),
    i("reflector", "5-in-1 reflector", "LIGHTING", false),
    i("batteries-spare", "Spare camera batteries (3+)", "ACCESSORY", true),
    i("sd-cards", "SD cards (formatted)", "STORAGE", true),
    i("cleaning-kit", "Lens cleaning kit", "ACCESSORY", false),
  ],
};

const SEEDS: Seed[] = [WEDDING, PORTRAIT, FAMILY, EDITORIAL, ENGAGEMENT];

async function run() {
  console.log(
    `Seeding gear templates${DRY_RUN ? " (dry-run)" : ""}…`
  );

  let created = 0;
  let skipped = 0;

  for (const seed of SEEDS) {
    if (DRY_RUN) {
      console.log(
        `  · plan  "${seed.name}" → ${seed.items.length} items (sessionType: ${seed.sessionType})`
      );
      continue;
    }

    const existing = await getDefaultGearTemplateForSessionType(seed.sessionType);
    if (existing) {
      console.log(
        `  · skip  "${seed.name}" — default for ${seed.sessionType} already exists (${existing.id})`
      );
      skipped++;
      continue;
    }
    const doc = await createGearTemplate(seed);
    console.log(
      `  + add   "${seed.name}" → ${doc.id} (${seed.items.length} items)`
    );
    created++;
  }

  if (DRY_RUN) {
    console.log(`\nDry-run complete — ${SEEDS.length} templates would be checked.`);
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
