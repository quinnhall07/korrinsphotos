// lib/session.ts
// Firebase session-cookie helpers (server-side only).
//
// Flow:
//   1. User signs in client-side with Firebase Auth.
//   2. Client POSTs the short-lived ID token to /api/auth/session.
//   3. Server calls createSessionCookie() → sets a 14-day httpOnly cookie.
//   4. Every server component / API route calls getSessionUser() to
//      verify the cookie and get the decoded claims (uid, email, role).

import { redirect }   from "next/navigation";
import { cookies }    from "next/headers";
import { adminAuth }  from "@/lib/firebase-admin";
import { adminDb }    from "@/lib/firebase-admin";
import type { DecodedIdToken } from "firebase-admin/auth";

const SESSION_COOKIE_NAME = "__session";
const SESSION_MAX_AGE     = 60 * 60 * 24 * 14; // 14 days (seconds)

// ─── Create ───────────────────────────────────────────────────────────────────
export async function createSession(idToken: string): Promise<void> {
  const expiresIn = SESSION_MAX_AGE * 1000; // Firebase expects ms

  const sessionCookie = await adminAuth.createSessionCookie(idToken, {
    expiresIn,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
    maxAge:   SESSION_MAX_AGE,
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
  });
}

// ─── Verify & read ────────────────────────────────────────────────────────────
export async function getSessionUser(): Promise<DecodedIdToken | null> {
  try {
    const cookieStore = await cookies();
    const cookie      = cookieStore.get(SESSION_COOKIE_NAME);
    if (!cookie?.value) return null;

    // checkRevoked: true → invalidates cookies when user is deleted / signs out server-side
    const decoded = await adminAuth.verifySessionCookie(cookie.value, true);
    return decoded;
  } catch {
    return null;
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

// ─── Role helpers ─────────────────────────────────────────────────────────────
export function isAdmin(decoded: DecodedIdToken): boolean {
  return decoded["role"] === "ADMIN";
}

// ─── Route Protection ────────────────────────────────────────────────────────

/**
 * requireAdmin — enforces that the current user is an ADMIN.
 *
 * Checks the JWT claim first (fast path). Falls back to a Firestore lookup
 * to handle sessions that were created before the ADMIN custom claim was set
 * (e.g. the very first Google sign-in before the two-step refresh completes,
 * or any legacy session cookie issued before this logic existed).
 */
export async function requireAdmin(): Promise<DecodedIdToken> {
  const decoded = await getSessionUser();

  if (!decoded) {
    redirect("/login");
  }

  // Fast path: role claim is embedded in the session cookie JWT.
  if (decoded["role"] === "ADMIN") {
    return decoded;
  }

  // Fallback: look the role up in Firestore. This handles sessions whose
  // cookies were minted before the admin claim was applied.
  try {
    const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
    if (userDoc.exists && userDoc.data()?.role === "ADMIN") {
      return decoded;
    }
  } catch (err) {
    console.error("[requireAdmin] Firestore role lookup failed:", err);
  }

  redirect("/login");
}

export async function requireSession(): Promise<DecodedIdToken> {
  const decoded = await getSessionUser();

  // If no valid session cookie exists, redirect to login
  if (!decoded) {
    redirect("/login");
  }

  return decoded;
}