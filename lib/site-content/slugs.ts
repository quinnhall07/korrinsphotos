// lib/site-content/slugs.ts
// Reserved-name list for admin-created custom pages. Anything that already
// maps to a top-level route (or a Next.js metadata file) must stay off-limits
// so the catch-all at app/[slug]/page.tsx never collides with a real path.
//
// Pure module — safe to import from server OR client.

const RESERVED_SLUGS = new Set<string>([
  // Top-level routes
  "admin",
  "api",
  "booking",
  "c",
  "day-of-room",
  "gallery",
  "investment",
  "journal",
  "pricing",
  "locations",
  "login",
  "magnet",
  "portal",
  "portfolio",
  "questionnaire",
  "r",
  "settings",
  "shop",
  "sign-contract",
  "style",
  "t",
  "welcome-packet",
  // Editable built-ins handled by their own routes
  "about",
  "home",
  "footer",
  // Auth-shaped paths people commonly try (and that we may add later)
  "auth",
  "signin",
  "signup",
  "logout",
  "signout",
  "register",
  "account",
  "profile",
  // Next.js / framework reserved
  "_next",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "manifest.json",
  "manifest.webmanifest",
  "opengraph-image",
  "twitter-image",
  "apple-icon",
  "icon",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}
