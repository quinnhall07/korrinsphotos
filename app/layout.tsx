// app/layout.tsx
// Root layout — wraps every page with the Navbar and Firebase AuthProvider.
// The AuthProvider handles completing email-link sign-ins when the user returns.

import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Navbar }       from "@/components/Navbar";
import { AuthProvider } from "@/components/AuthProvider";
import { Toaster }      from "@/components/ui/Toaster";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: {
    default:  "Korrin's Photography",
    template: "%s | Korrin's Photography",
  },
  description:
    "Fine art photography for weddings, portraits, and editorial work — crafted with intention and an eye for the extraordinary.",
  icons: { icon: "/favicon.ico" },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title:       "Korrin's Photography",
    description: "Fine art photography for weddings, portraits, and editorial work.",
    type:        "website",
  },
};

// In the Next.js 15 App Router, theme colour lives on `viewport`, not
// `metadata`. Charcoal matches the brand and the manifest theme_color.
export const viewport: Viewport = {
  themeColor: "#2A2A28",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&family=Jost:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/*
          AuthProvider is a Client Component that:
          - Listens to Firebase Auth state changes
          - Completes email-link sign-in when the user lands back on /login
          - Provides useAuth() hook to all child Client Components
        */}
        <AuthProvider>
          <Navbar />
          <main>{children}</main>
          <Toaster />
          <ServiceWorkerRegister />
        </AuthProvider>
      </body>
    </html>
  );
}