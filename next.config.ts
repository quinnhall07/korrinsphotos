import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        // Cloudflare Images CDN — your account-specific subdomain
        // Replace with your actual Cloudflare Images delivery URL
        protocol: "https",
        hostname: "imagedelivery.net",
        pathname: "/**",
      },
      {
        // Cloudflare R2 public bucket (if used for public portfolio images)
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com",
        pathname: "/**",
      },
      {
        // Picsum for placeholder images during development
        protocol: "https",
        hostname: "picsum.photos",
        pathname: "/**",
      },
    ],
    // Cloudflare Images handles its own optimization; skip Next.js re-processing
    formats: ["image/avif", "image/webp"],
  },
  // Ensure server actions are enabled (default in Next.js 14+)
  experimental: {
    serverActions: {
      // Allow larger bodies for booking form data
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;