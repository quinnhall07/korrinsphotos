// lib/upload.ts
// Client-only orchestrator for the multipart upload pipeline.
// Drives /api/upload/multipart/{init,complete} with parallel part PUTs
// (CHUNK_SIZE = 10 MB, CONCURRENCY = 3).
//
// Wave 10: also forwards `label` / `category` through the `complete` call so
// post-upload metadata is persisted on the photo doc the same way the
// single-PUT pipeline does.

export interface UploadMultipartOptions {
  /** Optional human-readable label for the photo doc. */
  label?: string | null;
  /** Optional portfolio category (see app/portfolio/categories.ts). */
  category?: string | null;
}

export async function uploadMultipartFile(
  file: File,
  eventId: string,
  onProgress?: (progress: number) => void,
  options?: UploadMultipartOptions,
): Promise<void> {
  const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB per chunk
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  onProgress?.(5);

  // 1. Initialize Multipart Upload
  const initRes = await fetch("/api/upload/multipart/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventId,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      parts: totalChunks,
    }),
  });

  if (!initRes.ok) throw new Error("Failed to initialize multipart upload");
  const { uploadId, key, partUrls } = await initRes.json();

  onProgress?.(10);

  const completedParts: { PartNumber: number; ETag: string }[] = [];
  let uploadedChunks = 0;

  // 2. Upload chunks in parallel (with concurrency limit, e.g., 3)
  const CONCURRENCY = 3;

  for (let i = 0; i < totalChunks; i += CONCURRENCY) {
    const chunkPromises: Promise<{ PartNumber: number; ETag: string }>[] = [];

    for (let j = 0; j < CONCURRENCY && i + j < totalChunks; j++) {
      const chunkIndex = i + j;
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      const urlInfo = (partUrls as { partNumber: number; url: string }[]).find(
        (p) => p.partNumber === chunkIndex + 1,
      );

      if (!urlInfo) throw new Error(`Missing presigned URL for part ${chunkIndex + 1}`);

      const uploadPromise = fetch(urlInfo.url, {
        method: "PUT",
        body: chunk,
        // Do not set Content-Type header here for parts as AWS presigner handles it
      }).then((res) => {
        if (!res.ok) throw new Error(`Failed to upload part ${chunkIndex + 1}`);
        const etag = res.headers.get("etag") || res.headers.get("ETag");
        if (!etag) throw new Error(`Missing ETag for part ${chunkIndex + 1}`);

        uploadedChunks++;
        const progress = 10 + Math.round((uploadedChunks / totalChunks) * 80);
        onProgress?.(progress);

        return { PartNumber: chunkIndex + 1, ETag: etag.replace(/"/g, "") };
      });

      chunkPromises.push(uploadPromise);
    }

    const results = await Promise.all(chunkPromises);
    completedParts.push(...results);
  }

  // Sort parts just in case
  completedParts.sort((a, b) => a.PartNumber - b.PartNumber);

  // 3. Complete Multipart Upload (forwards label/category if provided)
  const completeRes = await fetch("/api/upload/multipart/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventId,
      key,
      uploadId,
      parts: completedParts,
      label: options?.label ?? null,
      category: options?.category ?? null,
    }),
  });

  if (!completeRes.ok) throw new Error("Failed to complete multipart upload");

  onProgress?.(100);
}
