// lib/auth.ts
// NextAuth v5 (Auth.js) — Email magic-link provider + Prisma adapter.
// Docs: https://authjs.dev/getting-started/installation?framework=next.js

import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),

  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.RESEND_FROM_EMAIL,

      // Custom magic-link email sent via Resend.
      // The `url` parameter IS the magic link — clicking it signs the user in.
      async sendVerificationRequest({ identifier: email, url, provider }) {
        const { Resend: ResendClient } = await import("resend");
        const resend = new ResendClient(provider.apiKey);

        await resend.emails.send({
          from: provider.from as string,
          to: email,
          subject: "Your Korrin's Photos gallery link",
          html: `
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
          `,
        });
      },
    }),
  ],

  // Persist sessions in the database (required for Prisma adapter)
  session: {
    strategy: "database",
  },

  callbacks: {
    // Attach role and id to the session object so we can use them in Server Components
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        // Fetch role from DB (not stored on the User by NextAuth by default)
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true },
        });
        session.user.role = dbUser?.role ?? "CLIENT";
      }
      return session;
    },

    // On first sign-in, promote the admin email to ADMIN role
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