import type { Metadata } from "next";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/session";
import { ProjectsPipelineClientPage } from "./ProjectsPipelineClientPage";
import { formatDateTime } from "@/lib/date";

export const metadata: Metadata = { title: "Pipeline | Admin" };
export const dynamic = "force-dynamic";

async function getProjects() {
  const projectsSnap = await adminDb.collection("projects").orderBy("createdAt", "desc").get();
  
  const clientsData: Record<string, any> = {};
  const clientsSnap = await adminDb.collection("clients").get();
  clientsSnap.docs.forEach(doc => {
    clientsData[doc.id] = doc.data();
  });

  return projectsSnap.docs.map(doc => {
    const data = doc.data();
    const client = clientsData[data.clientId] || {};
    
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
    };
  });
}

export default async function AdminProjectsPage() {
  await requireAdmin();
  const projects = await getProjects();

  return <ProjectsPipelineClientPage projects={projects} />;
}
