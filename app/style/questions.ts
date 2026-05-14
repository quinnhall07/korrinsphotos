// app/style/questions.ts
// Pure data — the canonical question catalog for the style quiz, shared by
// the client component (renders the cards) and the server action (derives
// the tagSummary). Safe to import from both sides because there are no
// runtime imports.
//
// Tag taxonomy: each option carries one or more `tags`. The server action
// counts tag frequency across all answers and returns the dominant
// buckets (top-N) as `tagSummary`. The future AI mood-board generator
// (Phase 5.8) will key prompt seeds off the same taxonomy.

export type StyleOption = {
  id: string;
  label: string;
  description: string;
  /** Tag bucket keys this option contributes to. */
  tags: string[];
  /** Hex swatch used as the visual when no portfolio image is wired in. */
  swatch: string;
  /** Display name overlaid on the swatch in cursive. */
  swatchTitle: string;
};

export type StyleQuestion = {
  id: string;
  prompt: string;
  options: StyleOption[];
};

export const STYLE_QUESTIONS: StyleQuestion[] = [
  {
    id: "tone",
    prompt: "Which feels more like you?",
    options: [
      {
        id: "tone-light",
        label: "Light & airy",
        description: "Soft whites, gentle highlights, sun-soaked.",
        tags: ["light-airy"],
        swatch: "linear-gradient(135deg, #F8F4EC 0%, #E8E0D2 100%)",
        swatchTitle: "Light & Airy",
      },
      {
        id: "tone-dark",
        label: "Dark & moody",
        description: "Deep shadows, rich contrast, cinematic.",
        tags: ["dark-moody"],
        swatch: "linear-gradient(135deg, #2A2A28 0%, #4A4435 100%)",
        swatchTitle: "Dark & Moody",
      },
    ],
  },
  {
    id: "posing",
    prompt: "How do you want to feel in front of the camera?",
    options: [
      {
        id: "posing-candid",
        label: "Candid",
        description: "Caught laughing, unposed, in motion.",
        tags: ["candid", "documentary"],
        swatch: "linear-gradient(135deg, #C8B796 0%, #9C8D6C 100%)",
        swatchTitle: "Candid",
      },
      {
        id: "posing-posed",
        label: "Posed",
        description: "Considered, intentional, magazine-ready.",
        tags: ["posed", "editorial"],
        swatch: "linear-gradient(135deg, #6B7845 0%, #4A5530 100%)",
        swatchTitle: "Posed",
      },
    ],
  },
  {
    id: "setting",
    prompt: "Where do you picture the shoot?",
    options: [
      {
        id: "setting-studio",
        label: "Indoor studio",
        description: "Clean walls, controlled light, intentional set.",
        tags: ["indoor", "studio"],
        swatch: "linear-gradient(135deg, #E5E2DA 0%, #B8B2A4 100%)",
        swatchTitle: "Studio",
      },
      {
        id: "setting-outdoor",
        label: "Outdoor natural",
        description: "Fields, golden hour, the world as backdrop.",
        tags: ["outdoor", "natural-light"],
        swatch: "linear-gradient(135deg, #8A9A5A 0%, #5C6B3A 100%)",
        swatchTitle: "Outdoor",
      },
    ],
  },
  {
    id: "narrative",
    prompt: "Pick the storytelling style that pulls you in.",
    options: [
      {
        id: "narrative-doc",
        label: "Documentary",
        description: "Real moments, no direction, true to life.",
        tags: ["documentary", "candid"],
        swatch: "linear-gradient(135deg, #B0A795 0%, #756E5E 100%)",
        swatchTitle: "Documentary",
      },
      {
        id: "narrative-editorial",
        label: "Editorial",
        description: "Composed scenes, fashion-forward, intentional.",
        tags: ["editorial", "posed"],
        swatch: "linear-gradient(135deg, #2A2A28 0%, #6B7845 100%)",
        swatchTitle: "Editorial",
      },
    ],
  },
  {
    id: "temperature",
    prompt: "Which palette feels closer to home?",
    options: [
      {
        id: "temp-warm",
        label: "Warm tones",
        description: "Honey, peach, sunset gold.",
        tags: ["warm-tones"],
        swatch: "linear-gradient(135deg, #E8B88A 0%, #B8744A 100%)",
        swatchTitle: "Warm",
      },
      {
        id: "temp-cool",
        label: "Cool tones",
        description: "Slate, sage, oceanic blue.",
        tags: ["cool-tones"],
        swatch: "linear-gradient(135deg, #A8B8C0 0%, #5C6B7A 100%)",
        swatchTitle: "Cool",
      },
    ],
  },
  {
    id: "saturation",
    prompt: "How loud should the colour be?",
    options: [
      {
        id: "sat-bright",
        label: "Bright & saturated",
        description: "Bold, joyful, unapologetic colour.",
        tags: ["vibrant", "bold-color"],
        swatch: "linear-gradient(135deg, #D94C3D 0%, #E8B43A 100%)",
        swatchTitle: "Vibrant",
      },
      {
        id: "sat-muted",
        label: "Muted earth tones",
        description: "Quiet, weathered, lived-in palette.",
        tags: ["muted", "earth-tones"],
        swatch: "linear-gradient(135deg, #B5A88E 0%, #8A7E62 100%)",
        swatchTitle: "Muted Earth",
      },
    ],
  },
  {
    id: "framing",
    prompt: "Which framing speaks to you?",
    options: [
      {
        id: "frame-tight",
        label: "Tight crops",
        description: "Faces, hands, intimate detail.",
        tags: ["tight-crop", "intimate"],
        swatch: "linear-gradient(135deg, #2A2A28 0%, #3A3A35 100%)",
        swatchTitle: "Tight",
      },
      {
        id: "frame-wide",
        label: "Wide & environmental",
        description: "Sweeping landscapes, you in the world.",
        tags: ["wide-environmental", "landscape"],
        swatch: "linear-gradient(135deg, #6B7845 0%, #C8B796 100%)",
        swatchTitle: "Environmental",
      },
    ],
  },
  {
    id: "finish",
    prompt: "Pick a finish.",
    options: [
      {
        id: "finish-film",
        label: "Film grain",
        description: "Texture, grain, timeless analog feel.",
        tags: ["film-grain", "analog"],
        swatch: "linear-gradient(135deg, #8A8275 0%, #5C5648 100%)",
        swatchTitle: "Film",
      },
      {
        id: "finish-digital",
        label: "Crisp digital",
        description: "Clean, sharp, true-to-life clarity.",
        tags: ["crisp-digital", "clean"],
        swatch: "linear-gradient(135deg, #FAF9F6 0%, #C8C5BC 100%)",
        swatchTitle: "Crisp",
      },
    ],
  },
];

/**
 * Pure tag-frequency reducer. Counts every tag emitted by every chosen
 * option across the answer map, sorts descending by count, and returns the
 * top-N most-dominant buckets. Used by both the server action and the
 * future AI mood-board generator.
 */
export function deriveTagSummary(
  answers: Record<string, string>,
  topN: number = 5
): string[] {
  const counts = new Map<string, number>();
  for (const question of STYLE_QUESTIONS) {
    const chosenId = answers[question.id];
    if (!chosenId) continue;
    const option = question.options.find((o) => o.id === chosenId);
    if (!option) continue;
    for (const tag of option.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([tag]) => tag);
}
