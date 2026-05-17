import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export type VendorCategory =
  | "VENUE"
  | "PLANNER"
  | "FLORIST"
  | "HMUA"
  | "VIDEOGRAPHER"
  | "DJ"
  | "OFFICIANT"
  | "RENTALS"
  | "CATERER"
  | "BAKER"
  | "STATIONERY"
  | "OTHER";

export const VENDOR_CATEGORIES: VendorCategory[] = [
  "VENUE",
  "PLANNER",
  "FLORIST",
  "HMUA",
  "VIDEOGRAPHER",
  "DJ",
  "OFFICIANT",
  "RENTALS",
  "CATERER",
  "BAKER",
  "STATIONERY",
  "OTHER",
];

export interface VendorDoc {
  id: string;
  name: string;
  category: VendorCategory;
  email?: string;
  phone?: string;
  website?: string;
  instagramHandle?: string;
  address?: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  rating?: 1 | 2 | 3 | 4 | 5;
  isPreferred?: boolean;
  referralsSent?: number;
  referralsReceived?: number;
  lastReciprocatedAt?: Timestamp;
  lastWorkedWith?: Timestamp;
  tags?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const vendorsCol = () => adminDb.collection("vendors");

export async function getVendor(id: string): Promise<VendorDoc | null> {
  const snap = await vendorsCol().doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as VendorDoc) : null;
}

export async function listVendors(): Promise<VendorDoc[]> {
  const snap = await vendorsCol().orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as VendorDoc));
}

export async function listVendorsByCategory(
  category: VendorCategory
): Promise<VendorDoc[]> {
  const snap = await vendorsCol()
    .where("category", "==", category)
    .orderBy("createdAt", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as VendorDoc));
}

export async function createVendor(
  data: Omit<VendorDoc, "id" | "createdAt" | "updatedAt">
): Promise<VendorDoc> {
  const ref = vendorsCol().doc();
  const now = Timestamp.now();
  const fullData = {
    referralsSent: 0,
    referralsReceived: 0,
    ...data,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(fullData);
  return { id: ref.id, ...fullData } as VendorDoc;
}

export async function updateVendor(
  id: string,
  data: Partial<Omit<VendorDoc, "id" | "createdAt">>
): Promise<void> {
  await vendorsCol()
    .doc(id)
    .update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

export async function deleteVendor(id: string): Promise<void> {
  await vendorsCol().doc(id).delete();
}

// ─── Reciprocity helpers ───────────────────────────────────────────────────────
// Atomic increments on the reciprocity counters. Both helpers also bump
// lastReciprocatedAt (recency signal for the imbalance flag) and updatedAt.
// The legacy lastWorkedWith stamp is also bumped so the existing "Last worked"
// sort on the list page stays meaningful until that field is fully retired.

export async function logVendorReferralSent(vendorId: string): Promise<void> {
  await vendorsCol().doc(vendorId).update({
    referralsSent: FieldValue.increment(1),
    lastReciprocatedAt: FieldValue.serverTimestamp(),
    lastWorkedWith: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function logVendorReferralReceived(vendorId: string): Promise<void> {
  await vendorsCol().doc(vendorId).update({
    referralsReceived: FieldValue.increment(1),
    lastReciprocatedAt: FieldValue.serverTimestamp(),
    lastWorkedWith: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}
