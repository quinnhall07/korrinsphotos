// app/api/admin/search/route.ts
// GET /api/admin/search?q=<query>
// Unified admin search across clients, projects, events, vendors, and
// journal posts. Backs the Cmd/Ctrl+K command palette and the standalone
// /admin/search page.
//
// Admin-only — guarded with requireAdmin() on the first line. On auth
// failure we return an empty payload with HTTP 401 so the palette
// degrades silently instead of throwing.

import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/session";
import { searchAdminAll } from "@/lib/admin/search";

export const dynamic = "force-dynamic";

const EMPTY_PAYLOAD = {
  clients: [],
  projects: [],
  events: [],
  vendors: [],
  journal: [],
};

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json(EMPTY_PAYLOAD, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q") ?? "";
  const results = await searchAdminAll(q);
  return NextResponse.json(results);
}
