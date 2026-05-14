// scripts/seed-questionnaires.ts
// Seeds the five default questionnaire templates (Phase 2.9).
//
// Run with: npx tsx scripts/seed-questionnaires.ts
//   --dry-run     Print what would be created; do not write to Firestore.
//
// Idempotent: a template is skipped if one with the same `name` already
// exists in the `questionnaireTemplates` collection.

import {
  createTemplate,
  findTemplateByName,
  type QuestionnaireQuestion,
  type QuestionnaireTemplate,
} from "../lib/db/questionnaires";

type Seed = Omit<QuestionnaireTemplate, "id" | "createdAt" | "updatedAt">;

const DRY_RUN = process.argv.includes("--dry-run");

// Stable per-template question id helper.
const q = (
  id: string,
  type: QuestionnaireQuestion["type"],
  label: string,
  extras: Omit<QuestionnaireQuestion, "id" | "type" | "label"> = {}
): QuestionnaireQuestion => ({ id, type, label, ...extras });

// ─── Wedding (18 questions) ──────────────────────────────────────────────────

const WEDDING: Seed = {
  name: "Wedding Questionnaire",
  sessionType: "Wedding",
  questions: [
    q("partner_names", "text", "Full names of both partners", { required: true }),
    q("wedding_date", "date", "Wedding date", { required: true }),
    q("venue", "text", "Venue name and address", { required: true }),
    q("ceremony_time", "text", "Ceremony start time"),
    q("getting_ready_location", "text", "Where will you each get ready?"),
    q("guest_count", "number", "Approximate guest count"),
    q("wedding_party_size", "number", "Wedding party size (combined)"),
    q("officiant", "text", "Officiant's name"),
    q(
      "coverage_hours",
      "single",
      "How many hours of coverage do you want?",
      { options: ["6", "8", "10", "12+"], required: true }
    ),
    q(
      "must_have_moments",
      "longtext",
      "Are there any must-have moments or shots?",
      { helpText: "First look, private vows, sparkler exit, etc." }
    ),
    q(
      "family_dynamics",
      "longtext",
      "Anything about family dynamics we should know?",
      { helpText: "Divorced parents, recent loss, sensitive groupings." }
    ),
    q(
      "style_words",
      "multiselect",
      "Which words describe the vibe?",
      {
        options: [
          "Romantic",
          "Candid",
          "Editorial",
          "Documentary",
          "Moody",
          "Bright & airy",
          "Timeless",
        ],
      }
    ),
    q(
      "vendor_list",
      "longtext",
      "Other vendors (planner, florist, DJ, etc.)"
    ),
    q("first_look", "single", "Are you doing a first look?", {
      options: ["Yes", "No", "Undecided"],
    }),
    q("second_shooter", "single", "Want a second shooter?", {
      options: ["Yes", "No", "Not sure"],
    }),
    q(
      "dietary_notes",
      "text",
      "Any dietary notes for vendor meal?",
      { helpText: "Allergies, vegetarian, etc." }
    ),
    q("playlist_link", "text", "Link to your timeline or shot-list doc"),
    q(
      "anything_else",
      "longtext",
      "Anything else we should know?"
    ),
  ],
};

// ─── Portrait (12 questions) ─────────────────────────────────────────────────

const PORTRAIT: Seed = {
  name: "Portrait Questionnaire",
  sessionType: "Portrait",
  questions: [
    q("full_name", "text", "Your full name", { required: true }),
    q("session_date_pref", "date", "Preferred date"),
    q(
      "purpose",
      "single",
      "What's the portrait for?",
      {
        options: [
          "Headshot",
          "Personal branding",
          "Senior portrait",
          "Maternity",
          "Just for me",
          "Other",
        ],
      }
    ),
    q("location_pref", "text", "Preferred location or vibe", {
      helpText: "Studio, outdoor, your home — any inspiration links welcome.",
    }),
    q(
      "style_words",
      "multiselect",
      "Style words that resonate",
      {
        options: [
          "Editorial",
          "Candid",
          "Bold",
          "Soft",
          "Moody",
          "Bright & airy",
          "Black & white",
        ],
      }
    ),
    q("wardrobe_planned", "longtext", "What outfits are you bringing?"),
    q("hair_makeup", "single", "Hair & makeup", {
      options: ["DIY", "Booked already", "Need a recommendation"],
    }),
    q("confidence_level", "single", "Comfort level in front of the camera", {
      options: [
        "Nervous — first time",
        "Open to it",
        "Comfortable",
        "Love it",
      ],
    }),
    q(
      "inspiration_links",
      "longtext",
      "Drop any Pinterest / Instagram links",
      { helpText: "Don't worry about copying — we just want to see your taste." }
    ),
    q(
      "must_have_shots",
      "longtext",
      "Any must-have shots?"
    ),
    q("usage", "text", "How will you use these images?"),
    q("anything_else", "longtext", "Anything else we should know?"),
  ],
};

// ─── Family (14 questions) ───────────────────────────────────────────────────

const FAMILY: Seed = {
  name: "Family Questionnaire",
  sessionType: "Family",
  questions: [
    q("family_name", "text", "Family name", { required: true }),
    q("session_date_pref", "date", "Preferred date"),
    q("adults", "number", "Number of adults", { required: true }),
    q("kids", "number", "Number of children"),
    q(
      "kid_ages",
      "text",
      "Ages of the children",
      { helpText: "Comma-separated, e.g. 2, 5, 9" }
    ),
    q(
      "personalities",
      "longtext",
      "Briefly describe each child's personality",
      {
        helpText:
          "Knowing who's shy / silly / energetic helps us read the room.",
      }
    ),
    q(
      "kid_concerns",
      "longtext",
      "Anything we should know about the kids?",
      { helpText: "Naps, fears, special needs, motivators (snacks, songs)." }
    ),
    q(
      "location_pref",
      "single",
      "Preferred location",
      {
        options: [
          "Park / outdoors",
          "Your home",
          "Studio",
          "Beach",
          "Open to suggestions",
        ],
      }
    ),
    q(
      "style_words",
      "multiselect",
      "Vibe",
      { options: ["Candid", "Posed", "Playful", "Soft", "Editorial", "Documentary"] }
    ),
    q(
      "wardrobe",
      "longtext",
      "What is everyone wearing?",
      { helpText: "Colours, formality. We can advise if you're unsure." }
    ),
    q(
      "pets",
      "single",
      "Will pets be joining?",
      { options: ["Yes", "No"] }
    ),
    q(
      "milestones",
      "longtext",
      "Any milestones we're celebrating?",
      { helpText: "Pregnancy, adoption, retirement, anniversary, etc." }
    ),
    q("must_have_shots", "longtext", "Any must-have shots or groupings?"),
    q("anything_else", "longtext", "Anything else we should know?"),
  ],
};

// ─── Editorial (14 questions) ────────────────────────────────────────────────

const EDITORIAL: Seed = {
  name: "Editorial Questionnaire",
  sessionType: "Editorial",
  questions: [
    q("subject_name", "text", "Subject(s) / talent name(s)", { required: true }),
    q("brand", "text", "Brand or publication name"),
    q("creative_director", "text", "Creative director / point of contact"),
    q("shoot_date", "date", "Shoot date", { required: true }),
    q("call_time", "text", "Call time"),
    q(
      "concept",
      "longtext",
      "Concept / story",
      { required: true, helpText: "One paragraph is plenty." }
    ),
    q(
      "mood_links",
      "longtext",
      "Mood board / reference links",
      { helpText: "Pinterest, Are.na, drive folders — drop them all." }
    ),
    q(
      "deliverables",
      "multiselect",
      "Deliverables",
      {
        options: [
          "Hero image",
          "Supporting verticals",
          "Behind-the-scenes",
          "Video / motion",
          "Square crops for social",
        ],
      }
    ),
    q("usage_rights", "longtext", "Usage and license terms"),
    q("crew", "longtext", "Crew on set (stylist, HMU, etc.)"),
    q(
      "location",
      "text",
      "Location / studio"
    ),
    q(
      "wardrobe_owner",
      "single",
      "Who is providing wardrobe?",
      { options: ["Stylist", "Brand", "Talent", "TBD"] }
    ),
    q(
      "post_priorities",
      "longtext",
      "Post-production priorities",
      { helpText: "Retouching level, colour treatment, deliverable format." }
    ),
    q("anything_else", "longtext", "Anything else we should know?"),
  ],
};

// ─── Engagement (13 questions) ───────────────────────────────────────────────

const ENGAGEMENT: Seed = {
  name: "Engagement Questionnaire",
  sessionType: "Engagement",
  questions: [
    q("partner_names", "text", "Your full names", { required: true }),
    q("session_date_pref", "date", "Preferred date"),
    q(
      "how_you_met",
      "longtext",
      "How did you meet?",
      { helpText: "Two sentences is enough — we just love the context." }
    ),
    q("proposal_story", "longtext", "The proposal story (short version)"),
    q(
      "location_ideas",
      "longtext",
      "Where do you imagine shooting?",
      { helpText: "Coffee shop you love, park, your apartment — anything." }
    ),
    q(
      "vibe",
      "multiselect",
      "Vibe",
      {
        options: [
          "Playful",
          "Romantic",
          "Editorial",
          "Candid",
          "Cozy / at-home",
          "Adventurous",
        ],
      }
    ),
    q(
      "outfit_count",
      "single",
      "How many outfit changes?",
      { options: ["1", "2", "3"] }
    ),
    q(
      "wardrobe_thoughts",
      "longtext",
      "What are you thinking for wardrobe?"
    ),
    q(
      "props",
      "longtext",
      "Bringing any props or pets?"
    ),
    q(
      "save_the_date",
      "single",
      "Will these be used as save-the-dates?",
      { options: ["Yes", "No", "Maybe"] }
    ),
    q("wedding_date", "date", "Wedding date (if set)"),
    q("must_have_shots", "longtext", "Any must-have shots?"),
    q("anything_else", "longtext", "Anything else we should know?"),
  ],
};

const SEEDS: Seed[] = [WEDDING, PORTRAIT, FAMILY, EDITORIAL, ENGAGEMENT];

async function run() {
  console.log(
    `Seeding questionnaire templates${DRY_RUN ? " (dry-run)" : ""}…`
  );

  let created = 0;
  let skipped = 0;

  for (const seed of SEEDS) {
    if (DRY_RUN) {
      console.log(
        `  · plan  "${seed.name}" → ${seed.questions.length} questions (sessionType: ${seed.sessionType})`
      );
      continue;
    }

    const existing = await findTemplateByName(seed.name);
    if (existing) {
      console.log(`  · skip  "${seed.name}" (already exists: ${existing.id})`);
      skipped++;
      continue;
    }
    const doc = await createTemplate(seed);
    console.log(
      `  + add   "${seed.name}" → ${doc.id} (${seed.questions.length} questions)`
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
