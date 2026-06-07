// app/investment/page.tsx
// /investment was renamed to /pricing (Slice 1A). Permanent redirect.
import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";

export const metadata: Metadata = { robots: "noindex" };

export default function InvestmentRedirect() {
  permanentRedirect("/pricing");
}
