// app/api/upload/confirm/route.ts
// Step 2 of the upload pipeline — called after the browser has PUT the file
// directly to R2. This route:
//   1. Constructs the public R2 URL for the object
//   2. Pushes it to Cloudflare Images (which fetches from R2 and optimizes)
//   3. Writes a Photo row to the database with the Cloudflare Images ID

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadToCloudflareImages } from "@/lib/cloudflare";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const ConfirmSchema = z.object({
  key: z.string().min(1),       // The R2 object key from step 1
  eventId: z.string().min(1),
  label: z.string().optional(),
  category: z.string().optional(), // "wedding" | "portrait" | "editorial" | "landscape"
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = ConfirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message },
      { status: 400 }
    );
  }

  const { key, eventId, label, category } = parsed.data;

  // Build the R2 public URL. Your R2 bucket must have "public access" enabled,
  // OR use a Cloudflare Worker to proxy it. Update this URL pattern to match
  // your R2 custom domain or public bucket URL.
  const r2ObjectUrl = `https://${process.env.CLOUDFLARE_R2_BUCKET_NAME}.${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;

  // Ingest into Cloudflare Images — this does the WebP/AVIF conversion
  const { imageId, deliveryUrl } = await uploadToCloudflareImages(r2ObjectUrl, {
    eventId,
    label: label ?? "",
  });

  // Persist to database
  const photo = await prisma.photo.create({
    data: {
      eventId,
      cloudflareUrl: deliveryUrl,
      cloudflareImageId: imageId,
      label: label ?? null,
      category: category ?? null,
    },
  });

  return NextResponse.json({ photo: { id: photo.id, cloudflareUrl: photo.cloudflareUrl } });
}