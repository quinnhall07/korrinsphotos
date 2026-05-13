// app/admin/layout.tsx
// Admin layout — server-side auth guard + sidebar wrapper.
// requireAdmin() reads the Firebase session cookie; redirects to /login if missing or invalid.

import { requireAdmin } from "@/lib/session";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div style={{ paddingTop: "72px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "200px 1fr",
          minHeight: "calc(100vh - 72px)",
        }}
      >
        <AdminSidebar />
        <div style={{ padding: "1.5rem 2rem", overflowX: "auto" }}>
          {children}
        </div>
      </div>
    </div>
  );
}