// app/api/site-assets/confirm/route.ts
// Step 2 of the site-asset upload pipeline.
// Ingests the R2 object into Cloudflare Images and writes a siteAssets/{id} doc.

import { NextRequest, NextResponse } from "next/server";
import { getSessionOrNull } from "@/lib/session";
import { uploadToCloudflareImages } from "@/lib/storage/images";
import { generatePresignedGetUrl } from "@/lib/storage/r2";
import { createSiteAsset } from "@/lib/db/site-assets";
import { z } from "zod";

const ConfirmSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1).max(120),
  altText: z.string().max(240).optional().default(""),
});

export async function POST(req: NextRequest) {
  const session = await getSessionOrNull();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = ConfirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
  }

  const { key, label, altText } = parsed.data;
  const r2ObjectUrl = await generatePresignedGetUrl(key, 60);

  const { imageId, deliveryUrl } = await uploadToCloudflareImages(r2ObjectUrl, {
    label,
    scope: "site-asset",
  });

  const asset = await createSiteAsset({
    cloudflareImageId: imageId,
    cloudflareUrl: deliveryUrl,
    r2Key: key,
    label,
    altText,
    uploadedByUid: session.uid,
  });

  return NextResponse.json({
    asset: {
      id: asset.id,
      cloudflareImageId: asset.cloudflareImageId,
      cloudflareUrl: asset.cloudflareUrl,
      label: asset.label,
      altText: asset.altText,
    },
  });
}
