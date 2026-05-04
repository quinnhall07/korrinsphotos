// lib/cloudflare.ts
// Server-only utilities for Cloudflare R2 (pre-signed upload URLs)
// and Cloudflare Images (upload via URL, delete).
// NEVER import this file in Client Components.

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand, // Add this import
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ─── R2 S3 Client ─────────────────────────────────────────────────────────────

const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

// ─── Pre-signed Upload URL ────────────────────────────────────────────────────

/**
 * Generates a pre-signed PUT URL so the browser can upload directly to R2,
 * completely bypassing Vercel's 4.5MB request body limit.
 *
 * Flow:
 *   Browser → POST /api/upload (gets pre-signed URL)
 *   Browser → PUT {presignedUrl} (uploads file directly to R2)
 *   Browser → POST /api/upload/confirm (registers photo in DB)
 */
export async function generatePresignedUploadUrl({
  key,
  contentType,
  eventId,
}: {
  key: string;       // e.g. "events/evt_123/photo_456.jpg"
  contentType: string; // "image/jpeg" | "image/png" | "image/webp"
  eventId: string;
}): Promise<{ presignedUrl: string; key: string }> {
  const command = new PutObjectCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
    Key: key,
    ContentType: contentType,
    // Metadata stored alongside the object in R2
    Metadata: {
      eventId,
      uploadedAt: new Date().toISOString(),
    },
  });

  // URL expires in 15 minutes — plenty of time for a browser upload
  const presignedUrl = await getSignedUrl(r2, command, { expiresIn: 900 });

  return { presignedUrl, key };
}

/**
 * Deletes an object from R2 (called when a photo is removed from the DB).
 */
export async function deleteFromR2(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
    Key: key,
  });
  await r2.send(command);
}

// ─── Cloudflare Images ────────────────────────────────────────────────────────

/**
 * After a file lands in R2, we "ingest" it into Cloudflare Images by passing
 * the R2 object URL. Cloudflare Images fetches it, optimizes it, and returns
 * an image ID that we can use to build CDN delivery URLs.
 *
 * Prerequisite: Enable "Images Source" in Cloudflare Images dashboard, or use
 * the upload-from-URL endpoint shown below.
 *
 * Returns the Cloudflare image ID (e.g. "abc123def456")
 */
export async function uploadToCloudflareImages(
  r2ObjectUrl: string,
  metadata?: Record<string, string>
): Promise<{ imageId: string; deliveryUrl: string }> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID!;
  const apiToken = process.env.CLOUDFLARE_IMAGES_API_TOKEN!;

  const formData = new FormData();
  formData.append("url", r2ObjectUrl);
  if (metadata) {
    formData.append("metadata", JSON.stringify(metadata));
  }
  // Prevent the image from being listed publicly on Cloudflare Images
  formData.append("requireSignedURLs", "false");

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        // Do NOT set Content-Type — fetch sets it automatically for FormData
      },
      body: formData,
    }
  );

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Cloudflare Images upload failed: ${error}`);
  }

  const data = await res.json();
  const imageId = data.result.id as string;
  const deliveryUrl = `${process.env.NEXT_PUBLIC_CLOUDFLARE_IMAGES_URL}/${imageId}`;

  return { imageId, deliveryUrl };
}

/**
 * Deletes an image from Cloudflare Images (called when a photo is deleted).
 */
export async function deleteFromCloudflareImages(
  imageId: string
): Promise<void> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID!;
  const apiToken = process.env.CLOUDFLARE_IMAGES_API_TOKEN!;

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/${imageId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiToken}` },
    }
  );

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Cloudflare Images delete failed: ${error}`);
  }
}

// ─── CDN URL Helpers ──────────────────────────────────────────────────────────

/**
 * Builds a Cloudflare Images CDN URL for a given variant.
 *
 * Variants must be configured in your Cloudflare Images dashboard:
 *   - "thumbnail" → max 400px, WebP, quality 80
 *   - "gallery"   → max 1200px, WebP, quality 80
 *   - "download"  → max 2048px, WebP, quality 85
 *   - "public"    → max 800px, WebP, quality 80
 *
 * Example output:
 *   https://imagedelivery.net/{hash}/abc123/gallery
 */
export type ImageVariant = "thumbnail" | "gallery" | "download" | "public";

export function buildCdnUrl(
  cloudflareImageId: string,
  variant: ImageVariant = "gallery"
): string {
  const base = process.env.NEXT_PUBLIC_CLOUDFLARE_IMAGES_URL;
  return `${base}/${cloudflareImageId}/${variant}`;
}

/**
 * Generates a pre-signed GET URL to temporarily allow secure read access 
 * to a private R2 object.
 */
export async function generatePresignedGetUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
    Key: key,
  });

  // URL expires in 5 minutes (300 seconds) — just enough time for Cloudflare Images to fetch it
  return await getSignedUrl(r2, command, { expiresIn: 300 });
}