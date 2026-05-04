// app/gallery/layout.tsx
// Protects all /gallery routes. Unauthenticated users are redirected to /login.
// Admins can also access gallery routes (for preview purposes).

import { requireSession } from "@/lib/session";

export default async function GalleryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();
  return <>{children}</>;
}