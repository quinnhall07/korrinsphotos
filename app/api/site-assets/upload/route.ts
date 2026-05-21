// app/api/site-assets/upload/route.ts
// Step 1 of the site-asset upload pipeline — generates a pre-signed R2 URL.
// Mirrors /api/upload but writes to the global siteAssets/ R2 prefix.

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { generatePresignedUploadUrl } from "@/lib/cloudflare";
import { z } from "zod";
import { randomUUID } from "crypto";

const PresignSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic"]),
});

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = PresignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
  }

  const { fileName, contentType } = parsed.data;
  const ext = fileName.split(".").pop() ?? "jpg";
  const key = `site-assets/${randomUUID()}.${ext}`;

  const { presignedUrl } = await generatePresignedUploadUrl({ key, contentType, eventId: "site-assets" });

  return NextResponse.json({ presignedUrl, key });
}
