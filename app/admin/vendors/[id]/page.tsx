// app/admin/vendors/[id]/page.tsx
// Vendor detail — contact info, location, notes, tags, reciprocity counters,
// edit + delete. Server Component; mutations live in the client child.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { getVendor, type VendorCategory } from "@/lib/db/vendors";
import { formatDisplayDate, formatDateTime } from "@/lib/date";
import { VendorDetailClient, type SerializedVendorDetail } from "./VendorDetailClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const vendor = await getVendor(id);
  return { title: vendor ? `${vendor.name} | Vendors` : "Vendor | Admin" };
}

export default async function VendorDetailPage({ params }: Props) {
  const { id } = await params;
  await requireAdmin();

  const vendor = await getVendor(id);
  if (!vendor) notFound();

  const serialized: SerializedVendorDetail = {
    id: vendor.id,
    name: vendor.name,
    category: vendor.category as VendorCategory,
    email: vendor.email ?? null,
    phone: vendor.phone ?? null,
    website: vendor.website ?? null,
    instagramHandle: vendor.instagramHandle ?? null,
    address: vendor.address ?? null,
    city: vendor.city ?? null,
    state: vendor.state ?? null,
    latitude: typeof vendor.latitude === "number" ? vendor.latitude : null,
    longitude: typeof vendor.longitude === "number" ? vendor.longitude : null,
    notes: vendor.notes ?? "",
    rating: vendor.rating ?? null,
    isPreferred: !!vendor.isPreferred,
    referralsSent: vendor.referralsSent ?? 0,
    referralsReceived: vendor.referralsReceived ?? 0,
    lastWorkedWith: formatDisplayDate(vendor.lastWorkedWith),
    tags: Array.isArray(vendor.tags) ? vendor.tags : [],
    createdAt: formatDateTime(vendor.createdAt) ?? "—",
    updatedAt: formatDateTime(vendor.updatedAt) ?? "—",
  };

  return (
    <div className="page-fade-in">
      {/* Breadcrumb */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          fontSize: "0.78rem",
          color: "var(--charcoal-muted)",
          marginBottom: "1.25rem",
        }}
      >
        <Link
          href="/admin/vendors"
          style={{ color: "var(--charcoal-muted)", textDecoration: "none" }}
        >
          Vendors
        </Link>
        <span>/</span>
        <span style={{ color: "var(--charcoal)" }}>{vendor.name}</span>
      </div>

      <VendorDetailClient vendor={serialized} />
    </div>
  );
}
