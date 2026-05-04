// lib/session.ts
// Server-side session helpers. Used in Server Components, layouts, and API routes.
//
// Flow:
//   1. Client signs in with Firebase email link → gets ID token
//   2. Client POSTs ID token to /api/auth/session
//   3. Server verifies token, creates a Firebase session cookie (14-day expiry)
//   4. Server components call getSession() to read + verify that cookie
//
// The session cookie is an HttpOnly, Secure, SameSite=Lax cookie named "session".

import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export type SessionUser = {
  uid:   string;
  email: string;
  role:  "ADMIN" | "CLIENT";
};

/**
 * Reads the session cookie and verifies it with Firebase Admin.
 * Returns null if the cookie is missing, expired, or invalid.
 * Safe to call from any Server Component or Route Handler.
 */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) return null;

  try {
    // checkRevoked: true — also fails if the user's session was explicitly revoked
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);

    return {
      uid:   decoded.uid,
      email: decoded.email ?? "",
      // Role is stored as a custom claim so we don't need a Firestore round-trip
      role:  (decoded.role as "ADMIN" | "CLIENT") ?? "CLIENT",
    };
  } catch {
    // Cookie is invalid or expired — treat as signed out
    return null;
  }
}

/**
 * Like getSession() but throws a redirect to /login if there's no valid session.
 * Use this in protected layouts instead of getSession() + manual redirect.
 */
export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }
  return session;
}

/**
 * Like requireSession() but also enforces ADMIN role.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const session = await requireSession();
  if (session.role !== "ADMIN") {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }
  return session;
}

/**
 * Promotes a user to ADMIN by setting a custom Firebase Auth claim.
 * Custom claims are included in all future ID tokens and session cookies.
 * Called once during the first sign-in of the designated admin email.
 */
export async function promoteToAdmin(uid: string): Promise<void> {
  await adminAuth.setCustomUserClaims(uid, { role: "ADMIN" });
  // Mirror the role in Firestore so admin pages can display it in tables
  await adminDb.collection("users").doc(uid).set(
    { role: "ADMIN" },
    { merge: true }
  );
}

/**
 * Ensures a Firestore /users/{uid} document exists after first sign-in.
 * Creates it with role CLIENT unless the email matches ADMIN_EMAIL.
 */
export async function upsertUser(uid: string, email: string): Promise<void> {
  const userRef = adminDb.collection("users").doc(uid);
  const snap = await userRef.get();

  if (!snap.exists) {
    await userRef.set({
      email,
      role: "CLIENT",
      createdAt: new Date(),
    });
  }

  // Promote to admin on first sign-in if this is the designated admin email
  if (email === process.env.ADMIN_EMAIL) {
    await promoteToAdmin(uid);
  }
}