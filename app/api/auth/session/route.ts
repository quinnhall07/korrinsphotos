// app/api/auth/session/route.ts
// Creates or destroys the HttpOnly session cookie.
//
// POST /api/auth/session  — exchange a Firebase ID token for a session cookie
// DELETE /api/auth/session — sign out (clears the cookie)

import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { upsertUser } from "@/lib/session";

// 14 days in milliseconds
const SESSION_DURATION_MS = 60 * 60 * 24 * 14 * 1000;

export async function POST(req: NextRequest) {
  const { idToken } = await req.json();

  if (!idToken) {
    return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
  }

  try {
    // Verify the ID token is valid and not expired
    const decoded = await adminAuth.verifyIdToken(idToken);

    // Ensure the user document exists in Firestore (and promote to admin if needed)
    await upsertUser(decoded.uid, decoded.email ?? "");

    // Exchange the short-lived ID token for a long-lived session cookie
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });

    const res = NextResponse.json({ status: "ok" });

    res.cookies.set("session", sessionCookie, {
      httpOnly:  true,
      secure:    process.env.NODE_ENV === "production",
      sameSite:  "lax",
      maxAge:    SESSION_DURATION_MS / 1000, // maxAge is in seconds
      path:      "/",
    });

    return res;
  } catch (err) {
    console.error("Session creation failed:", err);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ status: "ok" });

  res.cookies.set("session", "", {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   0, // Immediately expire
    path:     "/",
  });

  return res;
}