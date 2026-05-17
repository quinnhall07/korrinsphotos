// app/admin/settings/insurer/page.tsx
// Phase 3.9 — Insurer contact settings page. Persists the destination email,
// name, phone, and default additional-insured language used by the COI
// (Certificate of Insurance) request flow on each project workspace.

import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { getUser } from "@/lib/db/users";
import { InsurerForm } from "./InsurerForm";

export const metadata: Metadata = { title: "Insurer | Admin" };
export const dynamic = "force-dynamic";

export default async function InsurerSettingsPage() {
  const session = await requireAdmin();
  const user = await getUser(session.uid);
  const contact = user?.insurerContact ?? {};

  return (
    <div className="page-fade-in" style={{ maxWidth: 880, padding: "2rem 2.5rem" }}>
      <header style={{ marginBottom: "2rem" }}>
        <p
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--olive)",
            marginBottom: "0.5rem",
          }}
        >
          Settings · Insurer
        </p>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontWeight: 300,
            fontSize: "2.4rem",
            lineHeight: 1.1,
            color: "var(--charcoal)",
            marginBottom: "0.75rem",
          }}
        >
          Insurer <em>contact</em>
        </h1>
        <p
          style={{
            fontSize: "0.88rem",
            lineHeight: 1.65,
            color: "var(--charcoal-light)",
            maxWidth: 620,
          }}
        >
          Used by the COI (Certificate of Insurance) request flow on each
          project. When you click <em>Request COI</em> from the Contract tab,
          we email these details to your insurer and pre-fill the
          additional-insured language for the venue.
        </p>
      </header>

      <InsurerForm
        initial={{
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          defaultAdditionalInsuredText: contact.defaultAdditionalInsuredText,
        }}
      />
    </div>
  );
}
