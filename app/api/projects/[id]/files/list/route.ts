// app/api/projects/[id]/files/list/route.ts
// Lists R2 objects under `projects/{projectId}/files/` and returns each with a
// short-lived presigned GET URL for downloading. The Firestore record of what
// files exist is derived from this listing — no separate collection.

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { listObjectsV2, generatePresignedGetUrl } from "@/lib/storage/r2";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ objects: [] }, { status: 400 });
  }

  try {
    const prefix = `projects/${id}/files/`;
    const { objects } = await listObjectsV2({ prefix });

    const enriched = await Promise.all(
      objects.map(async (o) => {
        const name = o.key.slice(o.key.lastIndexOf("/") + 1);
        const downloadUrl = await generatePresignedGetUrl(o.key, 3600);
        return {
          key: o.key,
          name,
          size: o.size,
          lastModified: o.lastModified ? o.lastModified.toISOString() : null,
          downloadUrl,
        };
      }),
    );

    return NextResponse.json({ objects: enriched });
  } catch (err) {
    console.error("[/api/projects/[id]/files/list] failed:", err);
    return NextResponse.json({ objects: [] }, { status: 500 });
  }
}
