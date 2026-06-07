// app/sitemap.ts
// Public sitemap for korrinsphotos.com.
// Statically generated at build time. Lists every live public route Google
// should crawl. /about, /journal, /locations, and /shop have been dissolved
// (routes deleted, slugs reserved) — they are intentionally absent here.

import type { MetadataRoute } from "next";

function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw && raw.length > 0) return raw.replace(/\/$/, "");
  return "https://korrinsphotos.com";
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now  = new Date();

  // Static public routes. Keep in sync as new public surfaces ship.
  return [
    { url: `${base}/`,          lastModified: now, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${base}/portfolio`, lastModified: now, changeFrequency: "weekly",  priority: 0.9 },
    { url: `${base}/pricing`,   lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/booking`,   lastModified: now, changeFrequency: "monthly", priority: 0.9 },
  ];
}
