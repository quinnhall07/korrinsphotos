// app/admin/layout.tsx
// Admin layout with server-side auth guard using Firebase session cookie.
// Non-admins are redirected to /login before anything renders.

import { redirect }      from "next/navigation";
import { requireAdmin }  from "@/lib/session";
import { AdminSidebar }  from "./AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // requireAdmin() reads the session cookie and verifies it server-side.
  // Redirects to /login if the cookie is missing, expired, or not ADMIN role.
  await requireAdmin();

  return (
    <div style={{ paddingTop: "72px" }}>
      <div
        style={{
          display:               "grid",
          gridTemplateColumns:   "260px 1fr",
          minHeight:             "calc(100vh - 72px)",
        }}
      >
        <AdminSidebar />
        <div style={{ padding: "3rem 3.5rem" }}>{children}</div>
      </div>
    </div>
  );
}