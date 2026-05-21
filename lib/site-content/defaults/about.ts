// lib/site-content/defaults/about.ts
// Frozen About-page seed. No static About page exists in the codebase yet —
// this is where it gets born. Edited via /admin/site/about; rendered by the
// slug catch-all at app/[slug]/page.tsx.

import type { Section } from "@/lib/site-content/types";

export const ABOUT_DEFAULTS: Section[] = [
  {
    id: "about-hero-default",
    type: "HERO",
    slides: [],
    eyebrow: "About",
    headline: "Hi, I'm *Korrin*",
    sub: "Photographer + student, currently based in Louisville and moving to Tuscaloosa for the fall. I shoot light-and-airy editorial work for portraits, families, and Greek-life events.",
  },
  {
    id: "about-richtext-default",
    type: "RICH_TEXT",
    eyebrow: "The story",
    heading: "How I got here",
    body: "I'll write this part. For now, here's a placeholder so the page renders.\n\nYou can edit this entire section from `/admin/site/about` — including the heading, the eyebrow, and the body copy below.",
  },
  {
    id: "about-cta-default",
    type: "CTA_BANNER",
    eyebrow: "Want to work together?",
    headline: "Tell me about *your shoot*",
    primaryCtaLabel: "Inquire",
    primaryCtaHref: "/booking",
    variant: "LIGHT",
  },
];
