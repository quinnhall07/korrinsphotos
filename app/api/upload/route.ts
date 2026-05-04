// app/api/upload/route.ts
// Step 1 of the upload pipeline — generates a pre-signed R2 URL.
// The browser then PUTs the file directly to R2 (bypassing Vercel's 4.5MB limit).

import { NextRequest, NextResponse }        from "next/server";
import { getSession }                       from "@/lib/session";
import { generatePresignedUploadUrl }       from "@/lib/cloudflare";
import { adminDb }                          from "@/lib/firebase-admin";
import { z }                                from "zod";
import { randomUUID }                       from "crypto";

const PresignSchema = z.object({
  eventId:     z.string().min(1),
  fileName:    z.string().min(1),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic"]),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body   = await req.json();
  const parsed = PresignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
  }

  const { eventId, fileName, contentType } = parsed.data;

  // Verify the event exists in Firestore
  const eventDoc = await adminDb.collection("events").doc(eventId).get();
  if (!eventDoc.exists) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const ext = fileName.split(".").pop() ?? "jpg";
  const key = `events/${eventId}/${randomUUID()}.${ext}`;

  const { presignedUrl } = await generatePresignedUploadUrl({ key, contentType, eventId });

  return NextResponse.json({ presignedUrl, key });
}