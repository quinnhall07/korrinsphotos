// app/api/auth/session/route.ts
// Called by the client immediately after Firebase sign-in.
// Exchanges the short-lived ID token for a 14-day httpOnly session cookie.
// Also upserts the user document in Firestore and sets the ADMIN custom claim
// if the email matches ADMIN_EMAIL.
//
// Two-step flow for first-time admin sign-in:
//   Step 1 – client sends original token → server sets admin claim → returns
//             { needsRefresh: true } (no session cookie yet).
//   Step 2 – client force-refreshes the Firebase token (picks up new claim)
//             → sends fresh token → server creates the session cookie.
// Subsequent admin sign-ins skip step 1 because the claim is already present.

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

    const adminEmails = (process.env.ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const isAdminEmail = adminEmails.includes((decoded.email ?? "").toLowerCase());
    const alreadyAdminClaim = decoded["role"] === "ADMIN";

    // ── First-time admin sign-in ───────────────────────────────────────────
    // The token was issued before the custom claim existed. Set the claim now
    // and tell the client to get a fresh token before creating the session
    // cookie (so the cookie will contain role:"ADMIN").
    if (isAdminEmail && !alreadyAdminClaim) {
      await adminAuth.setCustomUserClaims(decoded.uid, { role: "ADMIN" });

      // Persist the user record so Firestore also knows the role immediately.
      await upsertUser(decoded.uid, {
        uid:         decoded.uid,
        email:       decoded.email!,
        displayName: decoded.name  ?? null,
        photoURL:    decoded.picture ?? null,
        role:        "ADMIN",
      });

      // Do NOT create a session cookie yet — the token doesn't carry the claim.
      return NextResponse.json({ ok: true, needsRefresh: true, role: "ADMIN" });
    }

    // ── Normal flow (client / returning admin) ─────────────────────────────
    // Re-fetch the user from Firebase Auth to get authoritative custom claims.
    const freshUser = await adminAuth.getUser(decoded.uid);
    const role = (freshUser.customClaims?.["role"] as string) ?? "CLIENT";

    // Promote if admin email but claim not set (edge-case: direct API call)
    if (isAdminEmail && role !== "ADMIN") {
      await adminAuth.setCustomUserClaims(decoded.uid, { role: "ADMIN" });
    }

    // Persist user document
    await upsertUser(decoded.uid, {
      uid:         decoded.uid,
      email:       decoded.email!,
      displayName: decoded.name  ?? freshUser.displayName ?? null,
      photoURL:    decoded.picture ?? freshUser.photoURL ?? null,
      role:        (isAdminEmail ? "ADMIN" : role) as "ADMIN" | "CLIENT",
    });

    // Create the 14-day session cookie from the verified token
    await createSession(idToken);

    return NextResponse.json({ ok: true, role: isAdminEmail ? "ADMIN" : role });
  } catch (err) {
    console.error("[session] Error:", err);
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}