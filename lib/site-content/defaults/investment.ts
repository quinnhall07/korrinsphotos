// lib/site-content/defaults/investment.ts
// Frozen current Investment/Pricing copy. Rendered when siteContent/investment
// has no published doc. The current static page (app/investment/page.tsx +
// app/investment/packages.ts) is the source for this seed.

import type { Section } from "@/lib/site-content/types";

export const INVESTMENT_DEFAULTS: Section[] = [
  {
    id: "investment-hero-default",
    type: "HERO",
    slides: [],
    eyebrow: "Process & Pricing",
    headline: "Investment *in light*",
    sub: "A session is a long-term decision — a quiet archive of who you were, kept for the people who will care most. Every package below is a starting point; the rest, we shape together.",
  },
  {
    id: "investment-process-default",
    type: "PROCESS_STEPS",
    eyebrow: "The Process",
    heading: "From first message to *final frame*",
    intro: "Four steps, unhurried — designed so the day itself feels familiar by the time we're standing on it.",
    steps: [
      {
        n: "01",
        title: "Inquire",
        body: "Share a few details about your vision — the season, the people, the feeling you want to remember. Korrin reads every inquiry herself and responds within 48 hours.",
      },
      {
        n: "02",
        title: "Consult",
        body: "We meet for a relaxed call to walk through locations, timeline, wardrobe, and the small details that make a session feel like yours. This is where the shoot begins.",
      },
      {
        n: "03",
        title: "Shoot",
        body: "On the day, the camera disappears. We move with the light, follow the moments as they come, and trust that the in-between frames are often the best ones.",
      },
      {
        n: "04",
        title: "Receive your gallery",
        body: "A private online gallery arrives within four weeks, with a sneak peek inside one. High-resolution downloads, print release, and an archive that lives for a full year.",
      },
    ],
  },
  {
    id: "investment-packages-default",
    type: "PACKAGE_CARDS",
    eyebrow: "Packages",
    heading: "Three starting points, *each one tailored*",
    intro: "These are the foundations. Most clients arrive with something specific in mind — we shape the rest together.",
    packages: [
      {
        id: "mini",
        name: "The Mini",
        startingPriceUsd: 450,
        sessionType: "Portrait",
        includes: [
          "60 minutes of coverage",
          "25 edited high-resolution images",
          "One location, one outfit",
          "Private online gallery for 12 months",
          "Personal print release",
        ],
        idealFor: "Ideal for solo portraits, branding headshots, and intimate family sessions.",
      },
      {
        id: "story",
        name: "The Story",
        startingPriceUsd: 1250,
        sessionType: "Family",
        includes: [
          "2.5 hours of coverage",
          "75 edited high-resolution images",
          "Two locations, two outfit changes",
          "Sneak peek delivered within one week",
          "Private online gallery for 12 months",
          "Personal print release",
        ],
        idealFor: "Ideal for engagements, anniversary stories, and editorial concept shoots.",
      },
      {
        id: "day",
        name: "The Day",
        startingPriceUsd: 3500,
        sessionType: "Greek-life event",
        includes: [
          "Full-day coverage (up to 10 hours)",
          "400+ edited high-resolution images",
          "Second shooter optional",
          "Sneak peek delivered within one week",
          "Full delivery within four weeks",
          "Private online gallery for 12 months",
          "Personal print release",
        ],
        idealFor: "Ideal for formals, philanthropy days, and multi-event days that deserve start-to-finish coverage.",
      },
    ],
  },
  {
    id: "investment-testimonial-default",
    type: "TESTIMONIAL",
    eyebrow: "In Their Words",
    quote: "[Placeholder — a real client testimonial will live here once reviews are imported.]",
    authorRole: "Real testimonial to be added",
    variant: "DARK",
  },
  {
    id: "investment-cta-default",
    type: "CTA_BANNER",
    eyebrow: "Ready to begin?",
    headline: "Let's plan the *next one*",
    primaryCtaLabel: "Start your inquiry",
    primaryCtaHref: "/booking",
    variant: "LIGHT",
  },
];
