// app/api/invite/route.ts
// Invites a client to a specific event gallery:
//   1. Upserts the User record (creates if new, no-op if existing)
//   2. Creates an EventAccess row linking the user to the event
//   3. Sends a magic-link invitation email via Resend
//
// POST /api/invite
// Body: { email: string, eventId: string }

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const InviteSchema = z.object({
  email: z.string().email(),
  eventId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = InviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message },
      { status: 400 }
    );
  }

  const { email, eventId } = parsed.data;

  // Verify event exists
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true },
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Upsert user — creates a CLIENT row if they've never signed in before
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, role: "CLIENT" },
  });

  // Grant access (idempotent — unique constraint prevents duplicates)
  await prisma.eventAccess.upsert({
    where: { userId_eventId: { userId: user.id, eventId } },
    update: {},
    create: { userId: user.id, eventId },
  });

  // Send the invitation email with a magic link via Resend + NextAuth
  // NextAuth's signIn route generates a magic link when called server-side.
  // We use Resend directly here to send a custom-styled invite email.
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    const galleryUrl = `${process.env.NEXTAUTH_URL}/api/auth/signin/resend?email=${encodeURIComponent(email)}&callbackUrl=/gallery/${eventId}`;

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: email,
      subject: `Your photos from ${event.title} are ready`,
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family:'Helvetica Neue',sans-serif;background:#FAF9F6;margin:0;padding:40px 20px;">
            <div style="max-width:480px;margin:0 auto;border:0.5px solid rgba(42,42,40,0.22);padding:48px;background:#FAF9F6;">
              <div style="font-family:'Georgia',serif;font-size:22px;color:#2A2A28;margin-bottom:24px;">
                Korrin's<span style="color:#6B7845;">.</span>
              </div>
              <p style="font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#6B7845;margin-bottom:16px;">Your Gallery Is Ready</p>
              <h1 style="font-family:'Georgia',serif;font-size:26px;font-weight:300;color:#2A2A28;margin:0 0 16px;line-height:1.3;">
                Your photos from<br/>${event.title}
              </h1>
              <p style="font-size:14px;color:#4A4A47;line-height:1.7;margin-bottom:32px;">
                Korrin has shared your private gallery with you. Click below to view your images securely.
              </p>
              <a href="${galleryUrl}" style="display:inline-block;background:#6B7845;color:#FAF9F6;text-decoration:none;padding:14px 32px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;">
                View My Gallery
              </a>
              <p style="font-size:11px;color:#8A8A85;margin-top:32px;line-height:1.6;">
                This link will sign you in securely. If you didn't expect this email, you can safely ignore it.
              </p>
            </div>
          </body>
        </html>
      `,
    });
  } catch (emailErr) {
    console.error("Failed to send invite email:", emailErr);
    // Don't fail the request — access was still granted. Log and continue.
  }

  return NextResponse.json({
    success: true,
    message: `Invitation sent to ${email}`,
  });
}