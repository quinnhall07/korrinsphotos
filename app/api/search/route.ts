// app/api/search/route.ts
// GET endpoint backing the global command palette (Cmd/Ctrl+K).
// Admin-only — guarded with requireAdmin() on the first line.

import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/session";
import { searchAdmin } from "@/lib/search";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json(
      { clients: [], projects: [], events: [] },
      { status: 401 },
    );
  }

  const q = req.nextUrl.searchParams.get("q") ?? "";
  const results = await searchAdmin(q);
  return NextResponse.json(results);
}
