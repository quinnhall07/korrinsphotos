// app/admin/layout.tsx
// Admin layout — server-side auth guard + sidebar wrapper.
// requireAdmin() reads the Firebase session cookie; redirects to /login if missing or invalid.

import { requireAdmin } from "@/lib/session";
import {
  AdminMobileHeader,
  AdminSidebarSlot,
} from "@/components/admin/AdminMobileShell";
import { CommandPaletteProvider } from "@/components/ui/CommandPaletteProvider";
import { InstallPrompt } from "@/components/admin/InstallPrompt";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <CommandPaletteProvider>
      <div style={{ paddingTop: "72px" }}>
        {/* Mobile-only header bar (display: none at >= 900px). Above the grid. */}
        <AdminMobileHeader />

        <div className="admin-shell-grid">
          {/* AdminSidebarSlot renders both the desktop inline sidebar
              (grid column 1) and the mobile drawer (position: fixed). */}
          <AdminSidebarSlot />
          <div style={{ padding: "1.5rem 2rem", overflowX: "auto" }}>
            {children}
          </div>
        </div>
      </div>
      <InstallPrompt />
      <style>{`
        .admin-shell-grid {
          display: grid;
          grid-template-columns: 200px 1fr;
          min-height: calc(100vh - 72px);
        }
        @media (max-width: 899px) {
          .admin-shell-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </CommandPaletteProvider>
  );
}
