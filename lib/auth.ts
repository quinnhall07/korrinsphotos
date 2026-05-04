// lib/auth.ts
// NextAuth v5 (Auth.js) — Multi-provider auth:
//   • Resend magic link (email)
//   • Google OAuth
//   • Microsoft / Outlook (Azure AD / Entra ID)
//   • Apple (iCloud)
//
// Required environment variables:
//   RESEND_API_KEY, RESEND_FROM_EMAIL
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
//   MICROSOFT_ENTRA_ID_CLIENT_ID, MICROSOFT_ENTRA_ID_CLIENT_SECRET, MICROSOFT_ENTRA_ID_TENANT_ID
//   APPLE_ID, APPLE_SECRET (PEM private key), APPLE_TEAM_ID, APPLE_KEY_ID
//   ADMIN_EMAIL
//   NEXTAUTH_URL, NEXTAUTH_SECRET

import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import Google from "next-auth/providers/google";
import MicrosoftEntraId from "next-auth/providers/microsoft-entra-id";
import Apple from "next-auth/providers/apple";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),

  providers: [
    // ── Google ────────────────────────────────────────────────────────────
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),

    // ── Microsoft / Outlook / Azure AD ────────────────────────────────────
    // Set MICROSOFT_ENTRA_ID_TENANT_ID to "common" to allow any Microsoft
    // account (personal Outlook, work/school). Restrict to a specific tenant
    // by using that tenant's ID instead.
    MicrosoftEntraId({
      clientId: process.env.MICROSOFT_ENTRA_ID_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_ENTRA_ID_CLIENT_SECRET!,
      tenantId: process.env.MICROSOFT_ENTRA_ID_TENANT_ID ?? "common",
      allowDangerousEmailAccountLinking: true,
    }),

    // ── Apple / iCloud ────────────────────────────────────────────────────
    // Apple requires: App ID (clientId), a private key PEM (clientSecret
    // generated via Apple Developer portal), team ID, and key ID.
    // See: https://authjs.dev/getting-started/providers/apple
    Apple({
      clientId: process.env.APPLE_ID!,
      clientSecret: process.env.APPLE_SECRET!, // PEM private key
      allowDangerousEmailAccountLinking: true,
    }),

    // ── Resend magic link ─────────────────────────────────────────────────
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.RESEND_FROM_EMAIL,

      async sendVerificationRequest({ identifier: email, url, provider }) {
        const { Resend: ResendClient } = await import("resend");
        const resend = new ResendClient(provider.apiKey);

        await resend.emails.send({
          from: provider.from as string,
          to: email,
          subject: "Your Korrin's Photos gallery link",
          html: magicLinkEmail(url),
        });
      },
    }),
  ],

  session: {
    strategy: "database",
  },

  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true },
        });
        session.user.role = dbUser?.role ?? "CLIENT";
      }
      return session;
    },

    async signIn({ user }) {
      if (user.email === process.env.ADMIN_EMAIL) {
        await prisma.user.update({
          where: { email: user.email },
          data: { role: "ADMIN" },
        });
      }
      return true;
    },
  },

  pages: {
    signIn: "/login",
    verifyRequest: "/login?verify=1",
    error: "/login?error=1",
  },
});

// ─── Email template ───────────────────────────────────────────────────────────
function magicLinkEmail(url: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
      </head>
      <body style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background:#FAF9F6;margin:0;padding:40px 20px;">
        <div style="max-width:480px;margin:0 auto;background:#FAF9F6;border:0.5px solid rgba(42,42,40,0.22);padding:48px;">
          <div style="font-family:'Georgia',serif;font-size:22px;font-weight:400;color:#2A2A28;margin-bottom:8px;">
            Korrin's<span style="color:#6B7845;">.</span>
          </div>
          <div style="height:0.5px;background:rgba(42,42,40,0.12);margin:24px 0;"></div>
          <p style="font-size:13px;letter-spacing:0.2em;text-transform:uppercase;color:#6B7845;margin-bottom:16px;">
            Your Gallery Link
          </p>
          <h1 style="font-family:'Georgia',serif;font-size:28px;font-weight:300;color:#2A2A28;line-height:1.3;margin:0 0 16px;">
            Your private gallery<br>is ready
          </h1>
          <p style="font-size:14px;color:#4A4A47;line-height:1.7;margin-bottom:32px;">
            Click the button below to securely access your photos. This link expires in 15 minutes and can only be used once.
          </p>
          <a href="${url}" style="display:inline-block;background:#6B7845;color:#FAF9F6;text-decoration:none;padding:14px 32px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;">
            Access My Gallery
          </a>
          <p style="font-size:12px;color:#8A8A85;margin-top:32px;line-height:1.6;">
            If you didn't request this link, you can safely ignore this email.
            Your gallery remains private and secure.
          </p>
          <div style="height:0.5px;background:rgba(42,42,40,0.12);margin:32px 0 24px;"></div>
          <p style="font-size:11px;color:#8A8A85;letter-spacing:0.06em;">
            © ${new Date().getFullYear()} Korrin's Photos. All images are copyright protected.
          </p>
        </div>
      </body>
    </html>
  `;
}