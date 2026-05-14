// app/api/projects/[id]/files/presign/route.ts
// Step 1 of the project-files single-PUT pipeline — generates a pre-signed R2
// URL the browser PUTs directly to. Mirrors `/api/upload` but for project files
// (PDFs, contracts, deliverables) instead of event photos.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/session";
import { generatePresignedUploadUrl } from "@/lib/storage/r2";

const PresignSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
});

function sanitizeFileName(name: string): string {
  // Strip path separators and characters that aren't safe in an R2 key.
  const base = name.split(/[\\/]/).pop() ?? name;
  return base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "file";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing project id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = PresignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const { fileName, contentType } = parsed.data;
  const safeName = sanitizeFileName(fileName);
  const key = `projects/${id}/files/${Date.now()}-${safeName}`;

  try {
    const { presignedUrl } = await generatePresignedUploadUrl({
      key,
      contentType,
      // `generatePresignedUploadUrl` requires an `eventId` field for its R2
      // metadata stamp. For project files we reuse it as the project id —
      // it's free-form metadata, not a foreign key into `events`.
      eventId: id,
    });
    return NextResponse.json({ presignedUrl, key });
  } catch (err) {
    console.error("[/api/projects/[id]/files/presign] failed:", err);
    return NextResponse.json({ error: "Failed to presign upload" }, { status: 500 });
  }
}
