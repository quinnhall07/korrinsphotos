import type { Metadata } from "next";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/session";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Project Detail | Admin" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function ProjectDetailPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  const doc = await adminDb.collection("projects").doc(id).get();
  if (!doc.exists) {
    notFound();
  }

  const project = doc.data();
  const clientDoc = await adminDb.collection("clients").doc(project?.clientId).get();
  const client = clientDoc.data();

  // Basic implementation of the workspace
  return (
    <div className="page-fade-in" style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem", borderBottom: "1px solid var(--border-light)", paddingBottom: "2rem" }}>
        <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
          {client?.avatarUrl ? (
            <img src={client.avatarUrl} alt="Avatar" style={{ width: "64px", height: "64px", borderRadius: "50%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "var(--olive)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem" }}>
              {client?.firstName?.[0] || "?"}
            </div>
          )}
          <div>
            <h1 style={{ margin: "0 0 0.25rem 0", fontSize: "2rem", fontFamily: "'Cormorant Garamond', serif", fontWeight: 400 }}>
              {client?.firstName} {client?.lastName}
            </h1>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.6rem", background: "var(--olive-dim)", color: "var(--olive)", borderRadius: "100px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {project?.status}
              </span>
              <span style={{ fontSize: "0.8rem", color: "var(--charcoal-muted)" }}>
                Lead Score: {project?.leadScore || 0}
              </span>
            </div>
          </div>
        </div>
        
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button style={{ padding: "0.5rem 1rem", border: "1px solid var(--border-strong)", background: "white", cursor: "pointer" }}>Advance Status</button>
          <button style={{ padding: "0.5rem 1rem", border: "none", background: "var(--olive)", color: "white", cursor: "pointer" }}>Send Email</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "2rem" }}>
        {/* Left Rail */}
        <div>
          <div style={{ background: "#FAF9F6", padding: "1.5rem", border: "1px solid var(--border-light)", marginBottom: "1.5rem" }}>
            <h3 style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 1rem 0", color: "var(--olive)" }}>Client Detail</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.85rem" }}>
              <p style={{ margin: 0 }}><strong>Email:</strong> {client?.email}</p>
              <p style={{ margin: 0 }}><strong>Source:</strong> {client?.firstTouchSource}</p>
              <p style={{ margin: 0 }}><strong>Sessions:</strong> {client?.totalSessionsBooked}</p>
              <p style={{ margin: 0 }}><strong>Credit:</strong> ${(client?.referralCredit || 0) / 100}</p>
            </div>
          </div>

          <div style={{ background: "#FAF9F6", padding: "1.5rem", border: "1px solid var(--border-light)" }}>
            <h3 style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 1rem 0", color: "var(--olive)" }}>Project Setup</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.85rem" }}>
              <p style={{ margin: 0 }}><strong>Type:</strong> {project?.sessionType}</p>
              <p style={{ margin: 0 }}><strong>Value:</strong> ${project?.estimatedValue || 0}</p>
              <p style={{ margin: 0 }}><strong>Date:</strong> {project?.shootDate ? new Date(project?.shootDate.toMillis()).toLocaleDateString() : "TBD"}</p>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div style={{ background: "#FAF9F6", border: "1px solid var(--border-light)", minHeight: "500px", padding: "2rem" }}>
          {/* We would render tabs here (Overview, Messages, Contract, Invoice, Gallery, Timeline) */}
          <h2 style={{ margin: "0 0 1.5rem 0", fontSize: "1.5rem", fontFamily: "'Cormorant Garamond', serif" }}>Overview</h2>
          <div style={{ fontSize: "0.9rem", color: "var(--charcoal)", lineHeight: 1.6 }}>
            <p><strong>Notes:</strong> {project?.notes || "No notes."}</p>
            <p><strong>Tags:</strong> {project?.tags?.join(", ") || "None"}</p>
            {/* Future expansion: embed other components based on active tab state */}
          </div>
        </div>
      </div>
    </div>
  );
}
