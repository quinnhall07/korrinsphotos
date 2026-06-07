// app/investment/page.tsx
// /investment was renamed to /pricing (Slice 1A). Permanent redirect.
import { permanentRedirect } from "next/navigation";

export default function InvestmentRedirect() {
  permanentRedirect("/pricing");
}
