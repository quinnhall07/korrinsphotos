// app/layout.tsx
// Root layout — wraps every page with the Nav, session provider,
// and the grain texture overlay (applied via globals.css body::before).

import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { SessionProvider } from "@/components/SessionProvider";
import { Toaster } from "@/components/ui/Toaster";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: {
    default: "Korrin's Photos",
    template: "%s | Korrin's Photos",
  },
  description:
    "Fine art photography for weddings, portraits, and editorial work — crafted with intention and an eye for the extraordinary.",
  openGraph: {
    title: "Korrin's Photos",
    description: "Fine art photography for weddings, portraits, and editorial work.",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="en">
      <head>
        {/* Preconnect to Google Fonts before any render */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&family=Jost:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <SessionProvider session={session}>
          <Navbar session={session} />
          <main>{children}</main>
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  );
}