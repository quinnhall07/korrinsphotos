// app/api/projects/[id]/files/delete/route.ts
// Deletes a single R2 object under the project's files prefix. Path-traversal
// guarded — the supplied key must live inside `projects/{id}/files/`.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/session";
import { deleteObject } from "@/lib/storage/r2";

const DeleteSchema = z.object({
  key: z.string().min(1),
});

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

  const parsed = DeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const { key } = parsed.data;
  const expectedPrefix = `projects/${id}/files/`;
  if (!key.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: "Forbidden key" }, { status: 403 });
  }

  try {
    await deleteObject(key);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[/api/projects/[id]/files/delete] failed:", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
