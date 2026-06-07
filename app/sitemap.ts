// app/sitemap.ts
// Public sitemap for korrinsphotos.com — Phase 13.7.
// Statically generated at build time. Lists every public route Google should
// crawl, including the new per-city /locations/[slug] landing pages.

import type { MetadataRoute } from "next";
import { CITY_SEEDS } from "@/lib/seo/cities";

function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw && raw.length > 0) return raw.replace(/\/$/, "");
  return "https://korrinsphotos.com";
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now  = new Date();

  // Static public routes. Keep in sync as new public surfaces ship.
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`,           lastModified: now, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${base}/portfolio`,  lastModified: now, changeFrequency: "weekly",  priority: 0.9 },
    { url: `${base}/pricing`,    lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/booking`,    lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/journal`,    lastModified: now, changeFrequency: "weekly",  priority: 0.8 },
    { url: `${base}/locations`,  lastModified: now, changeFrequency: "monthly", priority: 0.85 },
  ];

  const cityEntries: MetadataRoute.Sitemap = CITY_SEEDS.map((c) => ({
    url:             `${base}/locations/${c.slug}`,
    lastModified:    now,
    changeFrequency: "monthly",
    priority:        0.75,
  }));

  return [...staticEntries, ...cityEntries];
}
