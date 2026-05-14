import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  CompletedPart,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

export async function generatePresignedUploadUrl({
  key,
  contentType,
  eventId,
}: {
  key: string;
  contentType: string;
  eventId: string;
}): Promise<{ presignedUrl: string; key: string }> {
  const command = new PutObjectCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
    Key: key,
    ContentType: contentType,
    Metadata: {
      eventId,
      uploadedAt: new Date().toISOString(),
    },
  });

  const presignedUrl = await getSignedUrl(r2, command, { expiresIn: 900 });
  return { presignedUrl, key };
}

export async function createMultipartUpload({
  key,
  contentType,
  eventId,
}: {
  key: string;
  contentType: string;
  eventId: string;
}): Promise<string> {
  const command = new CreateMultipartUploadCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
    Key: key,
    ContentType: contentType,
    Metadata: {
      eventId,
      uploadedAt: new Date().toISOString(),
    },
  });

  const response = await r2.send(command);
  if (!response.UploadId) {
    throw new Error("Failed to create multipart upload: No UploadId returned.");
  }
  return response.UploadId;
}

export async function generatePresignedPartUrls({
  key,
  uploadId,
  parts,
}: {
  key: string;
  uploadId: string;
  parts: number;
}): Promise<{ partNumber: number; url: string }[]> {
  const urls: { partNumber: number; url: string }[] = [];
  for (let i = 1; i <= parts; i++) {
    const command = new UploadPartCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
      Key: key,
      UploadId: uploadId,
      PartNumber: i,
    });
    const url = await getSignedUrl(r2, command, { expiresIn: 3600 });
    urls.push({ partNumber: i, url });
  }
  return urls;
}

export async function completeMultipartUpload({
  key,
  uploadId,
  parts,
}: {
  key: string;
  uploadId: string;
  parts: CompletedPart[];
}): Promise<void> {
  const command = new CompleteMultipartUploadCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: { Parts: parts },
  });
  await r2.send(command);
}

export async function abortMultipartUpload({
  key,
  uploadId,
}: {
  key: string;
  uploadId: string;
}): Promise<void> {
  const command = new AbortMultipartUploadCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
    Key: key,
    UploadId: uploadId,
  });
  await r2.send(command);
}

export async function deleteFromR2(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
    Key: key,
  });
  await r2.send(command);
}

/**
 * Alias of `deleteFromR2` — preferred name for new call sites that aren't
 * already importing the legacy helper from `lib/cloudflare`.
 */
export async function deleteObject(key: string): Promise<void> {
  await deleteFromR2(key);
}

export async function generatePresignedGetUrl(
  key: string,
  expiresIn: number = 3600,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
    Key: key,
  });
  return await getSignedUrl(r2, command, { expiresIn });
}

export interface R2Object {
  key: string;
  size: number;
  lastModified: Date | null;
  etag: string;
}

export interface ListObjectsV2Result {
  objects: R2Object[];
  isTruncated: boolean;
  nextContinuationToken?: string;
}

/**
 * Lists objects under a prefix in the R2 bucket. Wraps `ListObjectsV2Command`
 * and normalises the AWS SDK result shape into plain values for callers.
 */
export async function listObjectsV2({
  prefix,
  continuationToken,
}: {
  prefix: string;
  continuationToken?: string;
}): Promise<ListObjectsV2Result> {
  const command = new ListObjectsV2Command({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
    Prefix: prefix,
    ContinuationToken: continuationToken,
  });
  const response = await r2.send(command);
  const objects: R2Object[] = (response.Contents ?? [])
    .filter((o) => typeof o.Key === "string")
    .map((o) => ({
      key: o.Key!,
      size: typeof o.Size === "number" ? o.Size : 0,
      lastModified: o.LastModified ?? null,
      etag: typeof o.ETag === "string" ? o.ETag.replaceAll('"', "") : "",
    }));
  return {
    objects,
    isTruncated: Boolean(response.IsTruncated),
    nextContinuationToken: response.NextContinuationToken,
  };
}
