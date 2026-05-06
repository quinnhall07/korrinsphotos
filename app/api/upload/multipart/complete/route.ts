import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { completeMultipartUpload, abortMultipartUpload } from "@/lib/cloudflare";
import { adminDb } from "@/lib/firebase-admin";
import { z } from "zod";

const CompleteMultipartSchema = z.object({
  eventId: z.string().min(1),
  key: z.string().min(1),
  uploadId: z.string().min(1),
  parts: z.array(
    z.object({
      PartNumber: z.number().int().min(1),
      ETag: z.string().min(1),
    })
  ).min(1),
});

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = CompleteMultipartSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
  }

  const { eventId, key, uploadId, parts } = parsed.data;

  try {
    // 1. Complete the multipart upload
    await completeMultipartUpload({ key, uploadId, parts });

    // Note: If you want to ingest this into Cloudflare Images right away, you would do it here:
    // const presignedGetUrl = await generatePresignedGetUrl(key);
    // const { imageId, deliveryUrl } = await uploadToCloudflareImages(presignedGetUrl, { eventId });
    // And then save to Firestore. 
    // For RAW files, Cloudflare Images might not support ingestion directly depending on the format.
    // If they are strictly RAW (.cr2, .nef), they stay in R2.
    // We will just store the R2 reference in Firestore.
    
    // 2. Register the file in Firestore
    const photoRef = adminDb.collection("events").doc(eventId).collection("photos").doc();
    await photoRef.set({
      id: photoRef.id,
      storageKey: key, // Using storageKey since it's in R2
      status: "uploaded",
      isRaw: true,
      uploadedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, id: photoRef.id });
  } catch (error: any) {
    console.error("Multipart Complete Error:", error);
    
    // Fallback: try to abort the upload if completion failed
    try {
      await abortMultipartUpload({ key, uploadId });
    } catch (abortError) {
      console.error("Failed to abort multipart upload after completion failure:", abortError);
    }
    
    return NextResponse.json({ error: "Failed to complete multipart upload" }, { status: 500 });
  }
}
