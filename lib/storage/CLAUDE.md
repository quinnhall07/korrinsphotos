# CLAUDE.md — `lib/storage/`

> Object-storage adapters. Read root `CLAUDE.md` and `lib/CLAUDE.md` first.
> Re-read before changing the upload pipeline or adding a new variant.

---

## Purpose

`lib/storage/` is the server-only boundary to external object storage. Two files, two providers:

| File | Provider | Role |
|---|---|---|
| `r2.ts` | Cloudflare R2 (S3-compatible) | Object storage of record. Holds the original file. |
| `images.ts` | Cloudflare Images | Serves resized, cached variants from `imagedelivery.net`. |

The split mirrors the upload pipeline in root `CLAUDE.md` > "Image Upload Pipeline": browser PUTs the file to R2 via a presigned URL; the confirm step ingests the R2 object URL into Cloudflare Images for delivery.

---

## `r2.ts`

AWS SDK (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`) configured against R2's S3-compatible endpoint. A single `S3Client` is instantiated at module load using:

- `CLOUDFLARE_R2_ENDPOINT`
- `CLOUDFLARE_R2_ACCESS_KEY_ID`
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- `CLOUDFLARE_R2_BUCKET_NAME`

Exports:

- `generatePresignedUploadUrl({ key, contentType, eventId })` — 15-min PUT URL for the single-PUT pipeline. Stamps `eventId` + `uploadedAt` into R2 object metadata.
- `createMultipartUpload({ key, contentType, eventId })` — returns the R2 `UploadId`.
- `generatePresignedPartUrls({ key, uploadId, parts })` — 1-hour PUT URLs, one per part, for the multipart pipeline.
- `completeMultipartUpload({ key, uploadId, parts })` — finalises the multipart upload (parts are `CompletedPart[]` from `@aws-sdk/client-s3`).
- `abortMultipartUpload({ key, uploadId })` — cleanup for failed multipart uploads.
- `deleteFromR2(key)` — used by `lib/domain/events.ts`.
- `generatePresignedGetUrl(key)` — 5-min GET URL (used for serving large/raw originals that bypass Cloudflare Images).

---

## `images.ts`

Plain `fetch` against the Cloudflare Images REST API. Uses:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_IMAGES_API_TOKEN`
- `NEXT_PUBLIC_CLOUDFLARE_IMAGES_URL` (delivery host, e.g. `https://imagedelivery.net/<HASH>`)

Exports:

- `uploadToCloudflareImages(r2ObjectUrl, metadata?)` — POSTs `multipart/form-data` with `url=<r2ObjectUrl>` so Cloudflare ingests from R2 directly (no proxying through Vercel). Returns `{ imageId, deliveryUrl }`. `requireSignedURLs` is hard-coded to `false`.
- `deleteFromCloudflareImages(imageId)` — DELETE against `/images/v1/{imageId}`.
- `buildCdnUrl(cloudflareImageId, variant = "gallery")` — constructs `${NEXT_PUBLIC_CLOUDFLARE_IMAGES_URL}/${imageId}/${variant}`. Variants: `"thumbnail" | "gallery" | "download" | "public"`.

---

## Rules

- **Server-only.** Both files instantiate clients from secrets. NEVER import them from a `"use client"` component.
- **Never expose raw R2 URLs in the DOM.** R2 presigned GET URLs are short-lived and leak the bucket layout. Always use `buildCdnUrl(imageId, variant)` for anything that renders to a browser. The only exception is the temporary R2 object URL passed server-to-server into `uploadToCloudflareImages`.
- **No body proxying.** Browsers PUT directly to R2 via presigned URLs. Do not add an API route that accepts the file body — Vercel caps the request body at 4.5 MB.
- **Best-effort deletes.** External delete failures should not abort the calling flow; `lib/domain/events.ts` wraps each call in `try/catch`. Follow the same pattern when adding new tear-down logic.

---

## `lib/cloudflare.ts` (deprecated facade)

`lib/cloudflare.ts` is a one-line re-export of both modules:

```ts
export * from "./storage/r2";
export * from "./storage/images";
```

It exists so existing imports like `import { deleteFromR2, deleteFromCloudflareImages } from "@/lib/cloudflare"` (used in `lib/domain/events.ts`) keep compiling. Do not add new exports through the facade — new code should import from `@/lib/storage/r2` or `@/lib/storage/images` directly. The facade is retired the moment the last legacy import is updated.
