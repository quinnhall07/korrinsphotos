// app/api/upload/confirm/route.ts
// Step 2 of the upload pipeline — called after the browser PUT to R2.
// Ingests the image into Cloudflare Images, then writes a Photo doc to Firestore.

import { NextRequest, NextResponse }          from "next/server";
import { getSessionUser }                         from "@/lib/session";
import { uploadToCloudflareImages }           from "@/lib/cloudflare";
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

  const r2ObjectUrl = `https://${process.env.CLOUDFLARE_R2_BUCKET_NAME}.${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;

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