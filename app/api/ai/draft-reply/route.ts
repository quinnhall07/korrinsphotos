// app/api/ai/draft-reply/route.ts
//
// POST { projectId } → { text }
//
// Generates a draft reply for the given project thread in Korrin's voice.
// Admin-only. Loads project + client + most-recent 30 messages directly via
// adminDb, then hands off to lib/ai/claude.ts.

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { adminDb } from "@/lib/firebase-admin";
import { draftReply, loadVoiceSamples } from "@/lib/ai/claude";
import type { ProjectDoc, MessageDoc } from "@/lib/db/projects";
import type { ClientDoc } from "@/lib/db/clients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await requireAdmin();

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

    // Most recent 30 messages, then reverse so the prompt sees oldest → newest.
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

    const voiceSamples = await loadVoiceSamples(session.uid);

    const result = await draftReply({ project, client, thread, voiceSamples });

    return NextResponse.json({ text: result.text });
  } catch (err) {
    console.error("[/api/ai/draft-reply] failed:", err);
    const message = err instanceof Error ? err.message : "Failed to generate draft reply.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
