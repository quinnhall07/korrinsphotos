// lib/site-content/defaults/footer.ts
// Default footer copy. The Footer component reads siteContent/footer and
// renders these blocks at the bottom of every page. Until an admin publishes,
// the existing hard-coded Footer.tsx still renders.

import type { Section } from "@/lib/site-content/types";

export const FOOTER_DEFAULTS: Section[] = [
  {
    id: "footer-richtext-default",
    type: "RICH_TEXT",
    body: "© Korrin's Photos — based in Louisville, KY; relocating to Tuscaloosa, AL fall 2026.\n\n[Booking](/booking) · [Portfolio](/portfolio) · [Journal](/journal)",
  },
];
