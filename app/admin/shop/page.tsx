// app/admin/shop/page.tsx
// Lists every digital product. Server Component fetches via lib/db,
// serialises Timestamps, and hands off to the client list page.

import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { listProducts } from "@/lib/db/products";
import {
  ShopListClientPage,
  type SerializedProductRow,
} from "./ShopListClientPage";

export const metadata: Metadata = { title: "Shop | Admin" };
export const dynamic = "force-dynamic";

export default async function AdminShopPage() {
  await requireAdmin();

  const products = await listProducts().catch((err) => {
    console.error("listProducts failed", err);
    return [];
  });

  const rows: SerializedProductRow[] = products.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    type: p.type,
    status: p.status,
    priceCents: p.priceCents,
    purchaseCount: p.purchaseCount ?? 0,
    shortDescription: p.shortDescription,
    createdAt: p.createdAt.toDate().toISOString(),
    updatedAt: p.updatedAt.toDate().toISOString(),
  }));

  return <ShopListClientPage rows={rows} />;
}
