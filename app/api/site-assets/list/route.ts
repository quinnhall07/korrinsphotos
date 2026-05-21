// app/api/site-assets/list/route.ts
// Lightweight GET feeding the PhotoPicker after a new upload.

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { listSiteAssets } from "@/lib/db/site-assets";

export async function GET() {
  const session = await getSessionUser();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const siteAssets = await listSiteAssets();
  return NextResponse.json({
    siteAssets: siteAssets.map((a) => ({
      id: a.id,
      cloudflareImageId: a.cloudflareImageId,
      label: a.label,
      altText: a.altText,
    })),
  });
}
