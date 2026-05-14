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

// ─── Commercial Brand Brief (15 questions) ───────────────────────────────────

const COMMERCIAL: Seed = {
  name: "Commercial Brand Brief",
  sessionType: "Commercial",
  questions: [
    q("brand_name", "text", "Brand name", { required: true }),
    q(
      "brand_website",
      "text",
      "Brand website + social handles",
      { helpText: "URL and @handles for the platforms you actively post on." }
    ),
    q(
      "brand_positioning",
      "longtext",
      "One-line brand positioning / what you sell",
      { required: true }
    ),
    q(
      "target_audience",
      "longtext",
      "Target audience — demographic + psychographic",
      {
        required: true,
        helpText: "Who are we talking to? Age, income, lifestyle, the spaces they hang out in.",
      }
    ),
    q(
      "deliverables_wanted",
      "multiselect",
      "Deliverables wanted",
      {
        required: true,
        options: [
          "Hero brand stills",
          "Lifestyle product shots",
          "Founder portrait",
          "Behind-the-scenes",
          "Cut-down social videos",
          "Look book",
          "Web header sets",
        ],
      }
    ),
    q(
      "looks_count",
      "number",
      "Number of looks / outfits / setups"
    ),
    q(
      "mood_board_url",
      "text",
      "Mood board reference URL — Pinterest / Are.na / Drive",
      { helpText: "Paste a link or describe the vibe" }
    ),
    q(
      "brand_palette",
      "text",
      "Brand color palette",
      { helpText: "Hex codes or rough description" }
    ),
    q(
      "existing_assets",
      "longtext",
      "Existing brand assets we should match",
      { helpText: "Past campaign imagery, logo treatments, type system — drop links or describe." }
    ),
    q(
      "usage_window",
      "single",
      "Usage rights window",
      {
        required: true,
        options: ["3 months", "6 months", "1 year", "2 years", "Perpetual"],
      }
    ),
    q(
      "exclusivity",
      "single",
      "Exclusivity",
      {
        required: true,
        options: ["Non-exclusive", "Industry exclusive", "Full exclusivity"],
      }
    ),
    q(
      "talent",
      "single",
      "Talent",
      {
        options: [
          "Provided by us",
          "Need photographer to source",
          "Founder appearing",
        ],
      }
    ),
    q(
      "final_delivery_date",
      "date",
      "Required final delivery date",
      { required: true }
    ),
    q(
      "deliverable_formats",
      "multiselect",
      "Final deliverable formats",
      {
        options: [
          "JPG hi-res",
          "JPG web-optimized",
          "PNG with transparent bg",
          "Square crops for IG",
          "Vertical crops for IG/TikTok",
          "Raw files (extra license)",
        ],
      }
    ),
    q(
      "budget_range",
      "single",
      "Budget range",
      {
        required: true,
        options: ["Under $2k", "$2k–$5k", "$5k–$10k", "$10k–$25k", "$25k+"],
      }
    ),
  ],
};

const SEEDS: Seed[] = [WEDDING, PORTRAIT, FAMILY, EDITORIAL, ENGAGEMENT, COMMERCIAL];

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
