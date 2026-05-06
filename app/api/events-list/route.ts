// app/api/events-list/route.ts
// Simple API endpoint that returns all events (id + title) for use in
// client-side dropdowns (e.g., linking a booking inquiry to an event).

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ events: [] }, { status: 401 });
  }

  const snap = await adminDb
    .collection("events")
    .orderBy("createdAt", "desc")
    .get();

  const events = snap.docs.map((doc) => ({
    id: doc.id,
    title: (doc.data().title as string) ?? "Untitled",
  }));

  return NextResponse.json({ events });
}
