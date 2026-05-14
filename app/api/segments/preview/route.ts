// app/api/segments/preview/route.ts
// POST endpoint for the segment-builder's "Live preview" button. Resolves a
// SegmentPredicate against Firestore and returns a count + a small sample of
// matched client ids. Admin-only.

import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/session";
import { resolveSegment } from "@/lib/segments/resolver";
import type { SegmentPredicate } from "@/lib/db/segments";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await requireAdmin();

  let predicate: SegmentPredicate;
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || !body.predicate) {
      return NextResponse.json(
        { error: "Missing `predicate` field" },
        { status: 400 }
      );
    }
    predicate = body.predicate as SegmentPredicate;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const resolution = await resolveSegment(predicate);
    return NextResponse.json({
      count: resolution.count,
      capped: !!resolution.capped,
      sampleClientIds: resolution.clientIds.slice(0, 10),
    });
  } catch (err) {
    console.error("segments/preview: resolveSegment failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Resolution failed" },
      { status: 500 }
    );
  }
}
