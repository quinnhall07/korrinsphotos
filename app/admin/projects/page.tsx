import type { Metadata } from "next";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/session";
import { ProjectsPipelineClientPage } from "./ProjectsPipelineClientPage";
import { formatDateTime, toDate } from "@/lib/date";

export const metadata: Metadata = { title: "Pipeline | Admin" };
export const dynamic = "force-dynamic";

async function getProjects() {
  const projectsSnap = await adminDb.collection("projects").orderBy("createdAt", "desc").get();

  const clientsData: Record<string, any> = {};
  const clientsSnap = await adminDb.collection("clients").get();
  clientsSnap.docs.forEach((doc) => {
    clientsData[doc.id] = doc.data();
  });

  return projectsSnap.docs.map((doc) => {
    const data = doc.data();
    const client = clientsData[data.clientId] || {};

    // Derive the most-recent status-change timestamp from statusHistory.
    // Fallback to createdAt if statusHistory is missing/empty.
    let lastStatusChangeIso: string | null = null;
    const history = Array.isArray(data.statusHistory) ? data.statusHistory : [];
    if (history.length > 0) {
      const last = history[history.length - 1];
      const d = toDate(last?.at);
      if (d) lastStatusChangeIso = d.toISOString();
    }
    if (!lastStatusChangeIso) {
      const created = toDate(data.createdAt);
      if (created) lastStatusChangeIso = created.toISOString();
    }

    // Shoot date as ISO (or null) — used by saved views filtering on the client.
    const shoot = toDate(data.shootDate);
    const shootDateIso = shoot ? shoot.toISOString() : null;

    // Last-contacted as ISO (or null) — surfaced in the table view.
    const lastContacted = toDate(data.lastContactedAt);
    const lastContactedIso = lastContacted ? lastContacted.toISOString() : null;

    // Phase 3.13 — editing tracker fields
    const deliveredAt = toDate(data.deliveredAt);
    const deliveredAtIso = deliveredAt ? deliveredAt.toISOString() : null;
    const editingSubStage =
      typeof data.editingSubStage === "string" ? data.editingSubStage : null;

    return {
      id: doc.id,
      clientId: data.clientId,
      firstName: String(client.firstName ?? "Unknown"),
      lastName: String(client.lastName ?? ""),
      email: String(client.email ?? ""),
      sessionType: String(data.sessionType ?? ""),
      title: String(data.title ?? ""),
      status: String(data.status ?? "INQUIRY"),
      leadScore: Number(data.leadScore ?? 0),
      estimatedValue: data.estimatedValue ?? null,
      createdAt: formatDateTime(data.createdAt) ?? "Unknown",
      lastStatusChangeIso,
      shootDateIso,
      lastContactedIso,
      deliveredAtIso,
      editingSubStage,
    };
  });
}

export default async function AdminProjectsPage() {
  await requireAdmin();
  const projects = await getProjects();

  return <ProjectsPipelineClientPage projects={projects} />;
}
