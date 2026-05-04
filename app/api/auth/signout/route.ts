// app/api/auth/signout/route.ts
// Clears the Firebase session cookie, effectively signing the user out
// server-side. The client also calls firebase.auth().signOut() separately.

import { NextResponse } from "next/server";
import { clearSession } from "@/lib/session";

export async function POST() {
  await clearSession();
  return NextResponse.json({ ok: true });
}