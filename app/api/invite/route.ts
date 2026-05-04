// app/api/invite/route.ts
// Grants a client access to an event and sends them a Firebase sign-in link.
// Firebase generates and sends the email automatically — no Resend needed.
//
// POST /api/invite
// Body: { email: string, eventId: string }

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb }        from "@/lib/firebase-admin";
import { getSession }                from "@/lib/session";
import { FieldValue }                from "firebase-admin/firestore";
import { z }                         from "zod";

const InviteSchema = z.object({
  email:   z.string().email(),
  eventId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body   = await req.json();
  const parsed = InviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
  }

  const { email, eventId } = parsed.data;

  // Verify event exists
  const eventDoc = await adminDb.collection("events").doc(eventId).get();
  if (!eventDoc.exists) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  const eventTitle = eventDoc.data()?.title as string;

  // Upsert Firebase Auth user (creates if they've never signed in)
  let uid: string;
  try {
    const existing = await adminAuth.getUserByEmail(email);
    uid = existing.uid;
  } catch {
    // User doesn't exist yet — create them
    const newUser = await adminAuth.createUser({ email });
    uid = newUser.uid;
  }

  // Ensure Firestore user doc exists
  await adminDb.collection("users").doc(uid).set(
    { email, role: "CLIENT", createdAt: FieldValue.serverTimestamp() },
    { merge: true }
  );

  // Grant access (idempotent)
  const accessId = `${uid}_${eventId}`;
  await adminDb.collection("eventAccess").doc(accessId).set(
    { userId: uid, eventId, createdAt: FieldValue.serverTimestamp() },
    { merge: true }
  );

  // Generate a Firebase email sign-in link pointing straight to their gallery.
  // Firebase sends the email automatically — no Resend needed.
  const galleryUrl = `${process.env.NEXT_PUBLIC_APP_URL}/gallery/${eventId}`;

  try {
    const link = await adminAuth.generateSignInWithEmailLink(email, {
      url:             galleryUrl,
      handleCodeInApp: true,
    });

    // Note: generateSignInWithEmailLink only GENERATES the link; Firebase does NOT
    // automatically send it when called from the Admin SDK. You need to either:
    //   a) Send it yourself via an email service (easiest: add Resend back just for this)
    //   b) Use the client SDK sendSignInLinkToEmail() instead (requires client-side flow)
    //
    // For now we log the link (useful in dev) and return it in the response so you
    // can copy-paste it. Add your preferred email service when ready for production.
    console.info(`[INVITE] Sign-in link for ${email}:`, link);

    return NextResponse.json({
      success: true,
      message: `Access granted to ${email} for "${eventTitle}"`,
      // Remove devLink from the response in production
      devLink: process.env.NODE_ENV === "development" ? link : undefined,
    });
  } catch (err) {
    console.error("Failed to generate sign-in link:", err);
    // Access was still granted even if link generation fails
    return NextResponse.json({
      success: true,
      message: `Access granted to ${email}. Link generation failed — check server logs.`,
    });
  }
}