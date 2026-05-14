// app/api/ai/summarize-thread/route.ts
//
// POST { projectId } → { summary }
//
// Summarizes a project's full thread into ~3 short paragraphs for an admin
// glance. Admin-only. Loads project + client + most-recent 30 messages
// directly via adminDb.

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { adminDb } from "@/lib/firebase-admin";
import { summarizeThread } from "@/lib/ai/claude";
import type { ProjectDoc, MessageDoc } from "@/lib/db/projects";
import type { ClientDoc } from "@/lib/db/clients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await requireAdmin();

  let projectId: string;
  try {
    const body = await req.json();
    projectId = typeof body?.projectId === "string" ? body.projectId : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  try {
    const projectSnap = await adminDb.collection("projects").doc(projectId).get();
    if (!projectSnap.exists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const project = { id: projectSnap.id, ...projectSnap.data() } as ProjectDoc;

    const clientSnap = await adminDb.collection("clients").doc(project.clientId).get();
    if (!clientSnap.exists) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    const client = { id: clientSnap.id, ...clientSnap.data() } as ClientDoc;

    const messagesSnap = await adminDb
      .collection("projects")
      .doc(projectId)
      .collection("messages")
      .orderBy("sentAt", "desc")
      .limit(30)
      .get();

    const thread: MessageDoc[] = messagesSnap.docs
      .map((d) => ({ id: d.id, ...d.data() } as MessageDoc))
      .reverse();

    const result = await summarizeThread({ project, client, thread });

    return NextResponse.json({ summary: result.text });
  } catch (err) {
    console.error("[/api/ai/summarize-thread] failed:", err);
    const message = err instanceof Error ? err.message : "Failed to summarize thread.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
