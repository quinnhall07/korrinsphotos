// app/admin/vendors/page.tsx
// Lists all vendors in the network. Server Component fetches from Firestore
// via lib/db/vendors and delegates filtering/sorting to the client component.

import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { listVendors, type VendorCategory } from "@/lib/db/vendors";
import { formatDisplayDate } from "@/lib/date";
import { VendorsClientPage, type SerializedVendor } from "./VendorsClientPage";

export const metadata: Metadata = { title: "Vendors | Admin" };
export const dynamic = "force-dynamic";

async function getVendors(): Promise<SerializedVendor[]> {
  const vendors = await listVendors();
  return vendors.map((v) => ({
    id: v.id,
    name: v.name,
    category: v.category as VendorCategory,
    email: v.email ?? null,
    phone: v.phone ?? null,
    website: v.website ?? null,
    instagramHandle: v.instagramHandle ?? null,
    city: v.city ?? null,
    state: v.state ?? null,
    rating: v.rating ?? null,
    isPreferred: !!v.isPreferred,
    referralsSent: v.referralsSent ?? 0,
    referralsReceived: v.referralsReceived ?? 0,
    lastWorkedWith: formatDisplayDate(v.lastWorkedWith),
    lastWorkedWithMs: v.lastWorkedWith?.toMillis?.() ?? null,
    lastReciprocatedAt: formatDisplayDate(v.lastReciprocatedAt),
    lastReciprocatedAtMs: v.lastReciprocatedAt?.toMillis?.() ?? null,
    tags: Array.isArray(v.tags) ? v.tags : [],
    createdAtMs: v.createdAt?.toMillis?.() ?? 0,
  }));
}

export default async function AdminVendorsPage() {
  await requireAdmin();
  const vendors = await getVendors();
  return <VendorsClientPage vendors={vendors} />;
}
