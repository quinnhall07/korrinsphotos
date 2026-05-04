"use client";

// components/SecureImage.tsx
// A protective wrapper around next/image.
//
// Features:
//   - Disables right-click "Save Image As" via onContextMenu
//   - Prevents drag-and-drop saving via onDragStart
//   - CSS pointer-events: none blocks most browser image extraction shortcuts
//   - Accepts a Cloudflare variant so callers don't build URLs manually
//
// Usage:
//   <SecureImage cloudflareImageId="abc123" variant="gallery" alt="Wedding" />
//   <SecureImage src="https://..." alt="Custom" width={600} height={400} />

import Image from "next/image";
import type { ImageProps } from "next/image";
import type { ImageVariant } from "@/lib/cloudflare";

type SecureImageProps = Omit<ImageProps, "src"> & {
  // Pass EITHER a cloudflareImageId + variant OR a direct src
  cloudflareImageId?: string;
  variant?: ImageVariant;
  src?: string;
};

export function SecureImage({
  cloudflareImageId,
  variant = "gallery",
  src,
  alt,
  ...props
}: SecureImageProps) {
  const imageSrc = cloudflareImageId
    ? `${process.env.NEXT_PUBLIC_CLOUDFLARE_IMAGES_URL}/${cloudflareImageId}/${variant}`
    : (src as string);

  const handleContextMenu = (e: React.MouseEvent) => e.preventDefault();
  const handleDragStart = (e: React.DragEvent) => e.preventDefault();

  return (
    <div
      style={{ position: "relative", userSelect: "none" }}
      onContextMenu={handleContextMenu}
      onDragStart={handleDragStart}
    >
      <Image
        src={imageSrc}
        alt={alt}
        draggable={false}
        style={{
          pointerEvents: "none",
          userSelect: "none",
          WebkitUserDrag: "none",
          ...((props.style as React.CSSProperties) ?? {}),
        }}
        {...props}
      />
    </div>
  );
}