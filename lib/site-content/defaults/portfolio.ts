// lib/site-content/defaults/portfolio.ts
// Frozen current Portfolio header copy. The category filter + photo list are
// data-driven (Firestore), so the editable surface here is the header / intro
// + the closing CTA only.

import type { Section } from "@/lib/site-content/types";

export const PORTFOLIO_DEFAULTS: Section[] = [
  {
    id: "portfolio-hero-default",
    type: "HERO",
    slides: [],
    eyebrow: "Portfolio",
    headline: "Selected *work*",
    sub: "An evolving archive of recent sessions. Filter by category below — or drop me a note if you have a session in mind.",
  },
  {
    id: "portfolio-cta-default",
    type: "CTA_BANNER",
    eyebrow: "Like what you see?",
    headline: "Let's make *something together*",
    primaryCtaLabel: "Book a Session",
    primaryCtaHref: "/booking",
    variant: "DARK",
  },
];
