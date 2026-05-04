// app/api/auth/session/route.ts
// Called by the client immediately after Firebase sign-in.
// Exchanges the short-lived ID token for a 14-day httpOnly session cookie.
// Also upserts the user document in Firestore and sets the ADMIN custom claim
// if the email matches ADMIN_EMAIL.

import { NextRequest, NextResponse } from "next/server";
import { adminAuth }                 from "@/lib/firebase-admin";
import { createSession }             from "@/lib/session";
import { upsertUser }                from "@/lib/firestore";

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();
    if (!idToken || typeof idToken !== "string") {
      return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
    }

    // Verify the ID token first
    const decoded = await adminAuth.verifyIdToken(idToken);

    // Promote to ADMIN if this is the designated admin email
    if (decoded.email === process.env.ADMIN_EMAIL) {
      await adminAuth.setCustomUserClaims(decoded.uid, { role: "ADMIN" });
    }

    // Re-fetch claims after potential promotion
    const freshToken = await adminAuth.getUser(decoded.uid);
    const role = (freshToken.customClaims?.["role"] as string) ?? "CLIENT";

    // Persist user to Firestore (upsert — safe to call every login)
    await upsertUser(decoded.uid, {
      uid:         decoded.uid,
      email:       decoded.email!,
      displayName: decoded.name  ?? freshToken.displayName ?? null,
      photoURL:    decoded.picture ?? freshToken.photoURL ?? null,
      role:        role as "ADMIN" | "CLIENT",
    });

    // Create the session cookie
    await createSession(idToken);

    return NextResponse.json({ ok: true, role });
  } catch (err) {
    console.error("[session] Error:", err);
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}