"use client";

// app/admin/events/[id]/UploadZone.tsx
// Handles drag-and-drop or click-to-select file uploads.
// Step 1: POST /api/upload   → get pre-signed R2 URL
// Step 2: PUT {presignedUrl} → upload directly to R2 (bypasses Vercel limit)
// Step 3: POST /api/upload/confirm → register photo in Firestore
// On success the page reloads to show the new photos.
//
// Wave 10: a category dropdown + free-text label override apply to every file
// in the next batch. Both flow through to the photo doc (single-PUT and
// multipart pipelines). Category list comes from `app/portfolio/categories.ts`
// — the same source the public portfolio filter consumes, so admin uploads
// surface in the public filters without any further mapping.

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toaster";
import { uploadMultipartFile } from "@/lib/upload";
import { PORTFOLIO_CATEGORIES } from "@/app/portfolio/categories";

interface UploadZoneProps {
  eventId: string;
}

interface UploadFile {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const ACCEPTED_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".raw", ".cr2", ".nef", ".arw", ".dng"];
const MULTIPART_THRESHOLD = 15 * 1024 * 1024; // 15MB

export function UploadZone({ eventId }: UploadZoneProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [batchCategory, setBatchCategory] = useState<string>(""); // "" = uncategorized
  const [batchLabel, setBatchLabel] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const uploadFile = useCallback(
    async (file: File, index: number, category: string, labelOverride: string) => {
      // Step 1 — get pre-signed URL
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, status: "uploading", progress: 5 } : f
        )
      );

      // Resolve the per-file label: explicit batch override beats filename.
      const resolvedLabel =
        labelOverride.trim().length > 0
          ? labelOverride.trim()
          : file.name.replace(/\.[^/.]+$/, "");
      const resolvedCategory = category.trim().length > 0 ? category.trim() : null;

      // Branch based on file size
      if (file.size > MULTIPART_THRESHOLD) {
        try {
          await uploadMultipartFile(
            file,
            eventId,
            (progress) => {
              setFiles((prev) =>
                prev.map((f, i) => (i === index ? { ...f, progress } : f))
              );
            },
            { label: resolvedLabel, category: resolvedCategory },
          );
          setFiles((prev) =>
            prev.map((f, i) =>
              i === index ? { ...f, status: "done", progress: 100 } : f
            )
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Upload failed";
          setFiles((prev) =>
            prev.map((f, i) =>
              i === index ? { ...f, status: "error", error: message } : f
            )
          );
        }
        return;
      }

      // Step 1 — get pre-signed URL for normal files
      let presignedUrl: string;
      let key: string;

      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId,
            fileName: file.name,
            contentType: file.type,
          }),
        });

        if (!res.ok) throw new Error("Failed to get upload URL");
        const data = await res.json();
        presignedUrl = data.presignedUrl;
        key = data.key;
      } catch {
        setFiles((prev) =>
          prev.map((f, i) =>
            i === index
              ? { ...f, status: "error", error: "Failed to get upload URL" }
              : f
          )
        );
        return;
      }

      setFiles((prev) =>
        prev.map((f, i) => (i === index ? { ...f, progress: 30 } : f))
      );

      // Step 2 — PUT directly to R2
      try {
        const putRes = await fetch(presignedUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });
        if (!putRes.ok) throw new Error("R2 upload failed");
      } catch {
        setFiles((prev) =>
          prev.map((f, i) =>
            i === index
              ? { ...f, status: "error", error: "Upload to storage failed" }
              : f
          )
        );
        return;
      }

      setFiles((prev) =>
        prev.map((f, i) => (i === index ? { ...f, progress: 80 } : f))
      );

      // Step 3 — confirm and register in Firestore
      try {
        const confirmRes = await fetch("/api/upload/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key,
            eventId,
            label: resolvedLabel,
            category: resolvedCategory ?? undefined,
          }),
        });
        if (!confirmRes.ok) throw new Error("Confirm failed");
      } catch {
        setFiles((prev) =>
          prev.map((f, i) =>
            i === index
              ? { ...f, status: "error", error: "Failed to register photo" }
              : f
          )
        );
        return;
      }

      setFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, status: "done", progress: 100 } : f
        )
      );
    },
    [eventId]
  );

  const startUploads = useCallback(
    async (selectedFiles: File[]) => {
      const valid = selectedFiles.filter((f) => {
        if (ACCEPTED_TYPES.includes(f.type)) return true;
        const ext = f.name.toLowerCase().match(/\.[^.]+$/)?.[0];
        return ext && ACCEPTED_EXTS.includes(ext);
      });

      if (valid.length === 0) {
        toast("Please select supported images (including RAW formats).");
        return;
      }

      // Snapshot the current batch settings — subsequent state changes during
      // upload should NOT retroactively rewrite the in-flight files.
      const categorySnapshot = batchCategory;
      const labelSnapshot = batchLabel;

      const newFiles: UploadFile[] = valid.map((f) => ({
        file: f,
        progress: 0,
        status: "pending",
      }));

      setFiles((prev) => [...prev, ...newFiles]);
      const startIdx = files.length;

      await Promise.all(
        newFiles.map((_, i) =>
          uploadFile(valid[i], startIdx + i, categorySnapshot, labelSnapshot),
        )
      );

      const doneCount = valid.length;
      toast(`${doneCount} photo${doneCount !== 1 ? "s" : ""} uploaded successfully`);
      router.refresh();
    },
    [batchCategory, batchLabel, files.length, uploadFile, router]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    startUploads(dropped);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    startUploads(selected);
    e.target.value = "";
  };

  const pendingCount = files.filter((f) => f.status !== "done").length;
  const totalProgress =
    files.length > 0
      ? Math.round(files.reduce((sum, f) => sum + f.progress, 0) / files.length)
      : 0;

  // Warn before unload while uploads are in flight — closing the tab silently
  // aborts hundreds of in-flight PUTs otherwise. Browsers ignore custom text
  // and show their built-in "Changes you made may not be saved" prompt.
  useEffect(() => {
    if (pendingCount === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [pendingCount]);

  return (
    <div>
      {/* Wave 10 — Batch metadata controls (apply to every file in the next selection). */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <div>
          <label
            htmlFor="batch-category"
            style={{
              display: "block",
              fontSize: "0.62rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--charcoal-muted)",
              marginBottom: "0.4rem",
              fontFamily: "'Jost', sans-serif",
            }}
          >
            Portfolio category
          </label>
          <select
            id="batch-category"
            value={batchCategory}
            onChange={(e) => setBatchCategory(e.target.value)}
            style={{
              width: "100%",
              padding: "0.55rem 0.7rem",
              fontSize: "0.85rem",
              fontFamily: "'Jost', sans-serif",
              color: "var(--charcoal)",
              background: "var(--white)",
              border: "0.5px solid var(--border-strong)",
              borderRadius: 0,
              cursor: "pointer",
            }}
          >
            <option value="">Uncategorized</option>
            {PORTFOLIO_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="batch-label"
            style={{
              display: "block",
              fontSize: "0.62rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--charcoal-muted)",
              marginBottom: "0.4rem",
              fontFamily: "'Jost', sans-serif",
            }}
          >
            Label override (optional)
          </label>
          <input
            id="batch-label"
            type="text"
            value={batchLabel}
            onChange={(e) => setBatchLabel(e.target.value)}
            placeholder="Leave blank to use filename"
            style={{
              width: "100%",
              padding: "0.55rem 0.7rem",
              fontSize: "0.85rem",
              fontFamily: "'Jost', sans-serif",
              color: "var(--charcoal)",
              background: "var(--white)",
              border: "0.5px solid var(--border-strong)",
              borderRadius: 0,
            }}
          />
        </div>
      </div>
      <p
        style={{
          fontSize: "0.7rem",
          color: "var(--charcoal-muted)",
          marginBottom: "1rem",
          lineHeight: 1.4,
        }}
      >
        These settings apply to every file in the next selection. Change them
        between batches to mix categories or labels in the same event.
      </p>

      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        style={{
          border: `1.5px dashed ${isDragOver ? "var(--olive)" : "rgba(42,42,40,0.22)"}`,
          padding: "4rem 2rem",
          textAlign: "center",
          cursor: "pointer",
          transition: "all 0.2s",
          background: isDragOver ? "rgba(107,120,69,0.04)" : "transparent",
          marginBottom: pendingCount > 0 ? "1.5rem" : 0,
        }}
      >
        <svg
          viewBox="0 0 44 44"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          style={{
            width: "44px",
            height: "44px",
            margin: "0 auto 1rem",
            opacity: 0.3,
            display: "block",
            color: "var(--charcoal)",
          }}
        >
          <path d="M22 30V14M15 21l7-7 7 7" />
          <rect x="6" y="6" width="32" height="32" rx="2" />
        </svg>
        <h4
          style={{
            fontSize: "0.92rem",
            fontWeight: 400,
            color: "var(--charcoal-light)",
            marginBottom: "0.3rem",
          }}
        >
          Drag &amp; drop images here
        </h4>
        <p style={{ fontSize: "0.75rem", color: "var(--charcoal-muted)" }}>
          or click to select files · JPG, PNG, WEBP, HEIC, RAW
        </p>
        <p
          style={{
            color: "var(--olive)",
            marginTop: "0.5rem",
            fontSize: "0.72rem",
          }}
        >
          Files upload directly to R2, bypassing Vercel size limits
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={[...ACCEPTED_TYPES, ...ACCEPTED_EXTS].join(",")}
        multiple
        style={{ display: "none" }}
        onChange={handleChange}
      />

      {/* Progress */}
      {pendingCount > 0 && (
        <div>
          <div
            style={{
              height: "2px",
              background: "var(--border)",
              marginBottom: "0.5rem",
            }}
          >
            <div
              style={{
                height: "100%",
                background: "var(--olive)",
                width: `${totalProgress}%`,
                transition: "width 0.3s",
              }}
            />
          </div>
          <p style={{ fontSize: "0.72rem", color: "var(--charcoal-muted)" }}>
            {pendingCount} file{pendingCount !== 1 ? "s" : ""} uploading…{" "}
            {totalProgress}%
          </p>
        </div>
      )}

      {/* Individual file status */}
      {files.some((f) => f.status === "error") && (
        <div style={{ marginTop: "1rem" }}>
          {files
            .filter((f) => f.status === "error")
            .map((f, i) => (
              <p
                key={i}
                style={{
                  fontSize: "0.78rem",
                  color: "#B45309",
                  marginBottom: "0.25rem",
                }}
              >
                ✕ {f.file.name}: {f.error}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
