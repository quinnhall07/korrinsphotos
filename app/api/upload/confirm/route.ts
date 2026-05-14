// app/api/upload/confirm/route.ts
// Step 2 of the upload pipeline — called after the browser PUT to R2.
// Ingests the image into Cloudflare Images, then writes a Photo doc to Firestore.

import { NextRequest, NextResponse }          from "next/server";
import { getSessionUser }                         from "@/lib/session";
import { uploadToCloudflareImages }           from "@/lib/storage/images";
import { generatePresignedGetUrl }            from "@/lib/storage/r2";
import { adminDb }                            from "@/lib/firebase-admin";
import { FieldValue }                         from "firebase-admin/firestore";
import { z }                                  from "zod";

const ConfirmSchema = z.object({
  key:       z.string().min(1),
  eventId:   z.string().min(1),
  label:     z.string().optional(),
  category:  z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body   = await req.json();
  const parsed = ConfirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
  }

  const { key, eventId, label, category } = parsed.data;

  // Presigned GET URL works on both public and private R2 buckets and avoids env coupling
  // to the bucket's public-access configuration. 60s TTL is plenty for Cloudflare Images
  // to fetch the object server-side via upload-from-URL.
  const r2ObjectUrl = await generatePresignedGetUrl(key, 60);

  const { imageId, deliveryUrl } = await uploadToCloudflareImages(r2ObjectUrl, { eventId, label: label ?? "" });

  // Write photo as a subcollection document under the event
  // r2Key is persisted so the object can be cleaned up on photo/event delete
  // (parity with the multipart pipeline's `storageKey`).
  const photoRef = await adminDb
    .collection("events")
    .doc(eventId)
    .collection("photos")
    .add({
      cloudflareUrl:     deliveryUrl,
      cloudflareImageId: imageId,
      r2Key:             key,
      label:             label ?? null,
      category:          category ?? null,
      uploadedAt:        FieldValue.serverTimestamp(),
    });

  return NextResponse.json({ photo: { id: photoRef.id, cloudflareUrl: deliveryUrl } });
}