// app/api/upload/route.ts
// Two-step Cloudflare R2 direct upload pipeline:
//
// Step 1 — POST /api/upload
//   Client sends: { eventId, fileName, contentType }
//   Server returns: { presignedUrl, key }
//   Client then: PUT {presignedUrl} with the raw file bytes (bypasses Vercel!)
//
// Step 2 — POST /api/upload/confirm
//   Client sends: { key, eventId, label?, category? }
//   Server: ingests from R2 into Cloudflare Images, writes Photo row to DB
//   Server returns: { photo: { id, cloudflareUrl } }

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generatePresignedUploadUrl, uploadToCloudflareImages } from "@/lib/cloudflare";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { randomUUID } from "crypto";

// ─── Step 1: Generate pre-signed URL ─────────────────────────────────────────

const PresignSchema = z.object({
  eventId: z.string().min(1),
  fileName: z.string().min(1),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic"]),
});

export async function POST(req: NextRequest) {
  // Only admins may upload
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = PresignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message },
      { status: 400 }
    );
  }

  const { eventId, fileName, contentType } = parsed.data;

  // Verify the event exists
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Build a unique key within the event's "folder" in R2
  const ext = fileName.split(".").pop() ?? "jpg";
  const key = `events/${eventId}/${randomUUID()}.${ext}`;

  const { presignedUrl } = await generatePresignedUploadUrl({
    key,
    contentType,
    eventId,
  });

  return NextResponse.json({ presignedUrl, key });
}