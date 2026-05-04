"use client";

// app/admin/events/[id]/UploadZone.tsx
// Handles drag-and-drop or click-to-select file uploads.
// Step 1: POST /api/upload   → get pre-signed R2 URL
// Step 2: PUT {presignedUrl} → upload directly to R2 (bypasses Vercel limit)
// Step 3: POST /api/upload/confirm → register photo in Firestore
// On success the page reloads to show the new photos.

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toaster";

interface UploadZoneProps {
  eventId: string;
}

interface UploadFile {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export function UploadZone({ eventId }: UploadZoneProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const uploadFile = useCallback(
    async (file: File, index: number) => {
      // Step 1 — get pre-signed URL
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, status: "uploading", progress: 5 } : f
        )
      );

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
            label: file.name.replace(/\.[^/.]+$/, ""),
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
      const valid = selectedFiles.filter((f) => ACCEPTED.includes(f.type));
      if (valid.length === 0) {
        toast("Please select JPG, PNG, WEBP, or HEIC images.");
        return;
      }

      const newFiles: UploadFile[] = valid.map((f) => ({
        file: f,
        progress: 0,
        status: "pending",
      }));

      setFiles((prev) => [...prev, ...newFiles]);
      const startIdx = files.length;

      await Promise.all(
        newFiles.map((_, i) => uploadFile(valid[i], startIdx + i))
      );

      const doneCount = valid.length;
      toast(`${doneCount} photo${doneCount !== 1 ? "s" : ""} uploaded successfully`);
      router.refresh();
    },
    [files.length, uploadFile, router]
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

  return (
    <div>
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
          or click to select files · JPG, PNG, WEBP, HEIC · Up to 50MB each
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
        accept={ACCEPTED.join(",")}
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