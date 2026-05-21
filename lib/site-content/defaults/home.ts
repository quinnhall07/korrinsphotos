// lib/site-content/defaults/home.ts
// Frozen current home-page copy. Rendered when siteContent/home has no published doc.
// Once an admin publishes via /admin/site/home, the DB doc supersedes this.

import type { Section } from "@/lib/site-content/types";

export const HOME_DEFAULTS: Section[] = [
  {
    id: "home-hero-default",
    type: "HERO",
    slides: [],
    eyebrow: undefined,
    headline: "Stories told in **light & shadow**",
    sub: undefined,
    primaryCtaLabel: "Book a Session",
    primaryCtaHref: "/booking",
    secondaryCtaLabel: "View Portfolio",
    secondaryCtaHref: "/portfolio",
  },
  {
    id: "home-grid-default",
    type: "PHOTO_GRID",
    eyebrow: "Selected Work",
    heading: "Stories told in **light & shadow**",
    body: "A curated selection from recent sessions — each image a small universe, a moment suspended between the ordinary and the transcendent.",
    columns: 3,
    photos: [],
  },
  {
    id: "home-cta-default",
    type: "CTA_BANNER",
    eyebrow: "Ready to begin?",
    headline: "Let's create something **unforgettable together**",
    primaryCtaLabel: "Book a Session",
    primaryCtaHref: "/booking",
    secondaryCtaLabel: "View Portfolio",
    secondaryCtaHref: "/portfolio",
    variant: "DARK",
  },
];
