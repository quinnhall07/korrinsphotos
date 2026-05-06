import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { createMultipartUpload, generatePresignedPartUrls } from "@/lib/cloudflare";
import { adminDb } from "@/lib/firebase-admin";
import { z } from "zod";
import { randomUUID } from "crypto";

const InitMultipartSchema = z.object({
  eventId: z.string().min(1),
  fileName: z.string().min(1),
  // Allow common image formats and octet-stream for generic raw files
  contentType: z.string().min(1),
  parts: z.number().int().min(1).max(10000), // S3 limit is 10,000 parts
});

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = InitMultipartSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
  }

  const { eventId, fileName, contentType, parts } = parsed.data;

  // Verify the event exists in Firestore
  const eventDoc = await adminDb.collection("events").doc(eventId).get();
  if (!eventDoc.exists) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const ext = fileName.split(".").pop() ?? "jpg";
  const key = `events/${eventId}/${randomUUID()}.${ext}`;

  try {
    // 1. Create the multipart upload to get an UploadId
    const uploadId = await createMultipartUpload({ key, contentType, eventId });

    // 2. Generate presigned URLs for each part
    const partUrls = await generatePresignedPartUrls({ key, uploadId, parts });

    return NextResponse.json({ uploadId, key, partUrls });
  } catch (error: any) {
    console.error("Multipart Init Error:", error);
    return NextResponse.json({ error: "Failed to initialize multipart upload" }, { status: 500 });
  }
}
