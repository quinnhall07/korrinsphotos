"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ProjectStatus } from "@/lib/db/projects";

type PipelineProject = {
  id: string;
  clientId: string;
  firstName: string;
  lastName: string;
  email: string;
  sessionType: string;
  title: string;
  status: string;
  leadScore: number;
  estimatedValue: number | null;
  createdAt: string;
};

interface Props {
  projects: PipelineProject[];
}

const PIPELINE_COLUMNS: { id: ProjectStatus; label: string; bg: string }[] = [
  { id: "INQUIRY", label: "Inquiry", bg: "#FEF3C7" },
  { id: "QUALIFYING", label: "Qualifying", bg: "#E0E7FF" },
  { id: "PROPOSAL_SENT", label: "Proposal Sent", bg: "#DBEAFE" },
  { id: "CONTRACT_SENT", label: "Contract Sent", bg: "#FED7AA" },
  { id: "DEPOSIT_PENDING", label: "Deposit Pending", bg: "#FEE2E2" },
  { id: "BOOKED", label: "Booked", bg: "#D1FAE5" },
  { id: "SHOOT_READY", label: "Shoot Ready", bg: "#CCFBF1" },
  { id: "IN_EDITING", label: "In Editing", bg: "#E0E7FF" },
  { id: "GALLERY_DELIVERED", label: "Delivered", bg: "#F3E8FF" },
  { id: "COMPLETED", label: "Completed", bg: "#F1F5F9" },
];

export function ProjectsPipelineClientPage({ projects }: Props) {
  // Compute column stats
  const columnStats = useMemo(() => {
    const stats: Record<string, { count: number; weightedValue: number }> = {};
    for (const col of PIPELINE_COLUMNS) {
      stats[col.id] = { count: 0, weightedValue: 0 };
    }
    for (const p of projects) {
      if (stats[p.status]) {
        stats[p.status].count++;
        const val = p.estimatedValue || 0;
        stats[p.status].weightedValue += val * (p.leadScore / 100);
      }
    }
    return stats;
  }, [projects]);

  return (
    <div className="page-fade-in" style={{ padding: "2rem" }}>
      <div style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <p style={{ fontSize: "0.65rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--olive)", marginBottom: "0.3rem" }}>Pipeline</p>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "2rem", fontWeight: 300, margin: 0 }}>Project Pipeline</h2>
        </div>
      </div>

      <div style={{ 
        display: "flex", 
        gap: "1rem", 
        overflowX: "auto", 
        paddingBottom: "1rem",
        minHeight: "calc(100vh - 200px)"
      }}>
        {PIPELINE_COLUMNS.map((col) => {
          const colProjects = projects.filter((p) => p.status === col.id);
          const stats = columnStats[col.id];

          return (
            <div key={col.id} style={{ 
              width: "300px", 
              flexShrink: 0, 
              background: "#FAF9F6", 
              border: "1px solid var(--border-light)",
              display: "flex",
              flexDirection: "column",
              borderRadius: "4px"
            }}>
              {/* Column Header */}
              <div style={{ padding: "1rem", borderBottom: "1px solid var(--border-light)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: col.bg, border: "1px solid rgba(0,0,0,0.1)" }}></div>
                  <h3 style={{ fontSize: "0.85rem", fontWeight: 500, margin: 0, letterSpacing: "0.05em" }}>{col.label}</h3>
                  <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "var(--charcoal-muted)" }}>{stats.count}</span>
                </div>
                
                {/* Revenue Bar */}
                <div style={{ background: "white", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--border-light)", fontSize: "0.75rem", display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--charcoal-muted)" }}>Pipeline:</span>
                  <span style={{ fontWeight: 500, color: "var(--olive)" }}>
                    ${stats.weightedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>

              {/* Cards */}
              <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem", overflowY: "auto", flex: 1 }}>
                {colProjects.map((p) => (
                  <Link href={`/admin/projects/${p.id}`} key={p.id} style={{ textDecoration: "none" }}>
                    <div style={{ 
                      background: "white", 
                      padding: "1rem", 
                      border: "1px solid var(--border-light)", 
                      borderRadius: "4px",
                      cursor: "pointer",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                      transition: "transform 0.1s, box-shadow 0.1s"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.05)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "none";
                      e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.02)";
                    }}
                    >
                      <h4 style={{ margin: "0 0 0.25rem 0", fontSize: "0.9rem", color: "var(--charcoal)" }}>
                        {p.title}
                      </h4>
                      <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.75rem", color: "var(--charcoal-muted)" }}>
                        {p.firstName} {p.lastName}
                      </p>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.7rem", color: "var(--charcoal-muted)" }}>
                        <span>{p.sessionType}</span>
                        {p.estimatedValue ? (
                          <span style={{ fontWeight: 500, color: "var(--olive)" }}>${p.estimatedValue}</span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
