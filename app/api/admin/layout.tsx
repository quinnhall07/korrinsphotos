// app/admin/layout.tsx
// Admin layout with server-side auth guard.
// Any non-ADMIN request is redirected to /login before the page renders.

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminSidebar } from "./AdminSidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  return (
    <div style={{ paddingTop: "72px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "260px 1fr",
          minHeight: "calc(100vh - 72px)",
        }}
      >
        <AdminSidebar />
        <div style={{ padding: "3rem 3.5rem" }}>{children}</div>
      </div>
    </div>
  );
}