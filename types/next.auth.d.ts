// types/next-auth.d.ts
// Extends the default NextAuth Session/User types to include our custom fields.

import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "ADMIN" | "CLIENT";
    } & DefaultSession["user"];
  }
}