// app/api/invite/route.ts
// Grants a client access to an event and emails them a Firebase sign-in link.
//
// Flow:
//   1. Admin POSTs { email, eventId }
//   2. We upsert the user in Firebase Auth and Firestore
//   3. We write an eventAccess doc (grants gallery permission)
//   4. We call sendFirebaseSignInLink() — Firebase sends the email
//   5. The email contains a magic link pointing back to /login?email=...&next=/gallery
//   6. When the client clicks it, AuthProvider completes sign-in and redirects
//
// POST /api/invite
// Body: { email: string, eventId: string }

import { NextRequest, NextResponse }        from "next/server";
import { adminAuth, adminDb }               from "@/lib/firebase-admin";
import { getSession }                       from "@/lib/session";
import { sendFirebaseSignInLink, buildContinueUrl } from "@/lib/firebase-email";
import { FieldValue }                       from "firebase-admin/firestore";
import { z }                                from "zod";

const InviteSchema = z.object({
  email:   z.string().email("Please enter a valid email address"),
  eventId: z.string().min(1, "Event ID is required"),
});

export async function POST(req: NextRequest) {
  // ── Auth guard ──────────────────────────────────────────────────────────────
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Validate body ───────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = InviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const { email, eventId } = parsed.data;

  // ── Verify event exists ─────────────────────────────────────────────────────
  const eventDoc = await adminDb.collection("events").doc(eventId).get();
  if (!eventDoc.exists) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // ── Upsert Firebase Auth user ───────────────────────────────────────────────
  // Creates the account if this is the first time this email has been invited.
  let uid: string;
  try {
    const existing = await adminAuth.getUserByEmail(email);
    uid = existing.uid;
  } catch {
    // User doesn't exist yet in Firebase Auth — create a passwordless account.
    const newUser = await adminAuth.createUser({ email });
    uid = newUser.uid;
  }

  // ── Upsert Firestore user doc ───────────────────────────────────────────────
  await adminDb
    .collection("users")
    .doc(uid)
    .set(
      {
        email,
        role:      "CLIENT",
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

  // ── Grant event access (idempotent) ─────────────────────────────────────────
  const accessId = `${uid}_${eventId}`;
  await adminDb
    .collection("eventAccess")
    .doc(accessId)
    .set(
      {
        userId:    uid,
        eventId,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

  // ── Send the sign-in link email ─────────────────────────────────────────────
  // The continueUrl encodes the recipient's email and the post-login destination.
  // AuthProvider reads these query params when the user lands back on /login.
  const continueUrl = buildContinueUrl({
    email,
    next: "/gallery",
  });

  try {
    await sendFirebaseSignInLink(email, { continueUrl });
  } catch (err) {
    console.error("[invite] Failed to send sign-in link:", err);
    // Access was already granted above — report the email failure but don't roll back.
    return NextResponse.json(
      {
        success: false,
        error:
          "Access was granted, but the invitation email could not be sent. " +
          "Check that Email Link sign-in is enabled in your Firebase project.",
        hint: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: `Invitation sent to ${email}`,
  });
}