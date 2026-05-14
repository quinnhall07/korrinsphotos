"use server";

// app/admin/vendors/actions.ts
// Server Actions for the Vendor CRM. Every mutation re-validates admin auth.

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { FieldValue } from "firebase-admin/firestore";
import { logActivity } from "@/lib/db/activity";
import {
  createVendor as createVendorDoc,
  deleteVendor as deleteVendorDoc,
  getVendor,
  logVendorReferralReceived,
  logVendorReferralSent,
  updateVendor as updateVendorDoc,
  vendorsCol,
  type VendorCategory,
  type VendorDoc,
  VENDOR_CATEGORIES,
} from "@/lib/db/vendors";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function sanitize<T extends object>(input: T): T {
  // Strip undefined fields so we don't write them to Firestore.
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

export type CreateVendorInput = {
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
  tags?: string[];
};

export type UpdateVendorInput = Partial<CreateVendorInput>;

// ─── Create Vendor ─────────────────────────────────────────────────────────────

export async function createVendor(
  input: CreateVendorInput
): Promise<{ success: boolean; error?: string; id?: string }> {
  await requireAdmin();

  try {
    const name = (input.name ?? "").trim();
    if (!name) return { success: false, error: "Name is required." };

    if (!VENDOR_CATEGORIES.includes(input.category)) {
      return { success: false, error: "Invalid category." };
    }

    const payload = sanitize({
      name,
      category: input.category,
      email: input.email?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      website: input.website?.trim() || undefined,
      instagramHandle: input.instagramHandle?.trim() || undefined,
      address: input.address?.trim() || undefined,
      city: input.city?.trim() || undefined,
      state: input.state?.trim() || undefined,
      latitude: input.latitude,
      longitude: input.longitude,
      notes: input.notes?.trim() || undefined,
      rating: input.rating,
      isPreferred: input.isPreferred ?? false,
      tags: input.tags && input.tags.length > 0 ? input.tags : undefined,
    }) as Omit<VendorDoc, "id" | "createdAt" | "updatedAt">;

    const vendor = await createVendorDoc(payload);

    await logActivity(
      "NOTE_ADDED",
      `Vendor "${vendor.name}" added to network`,
      { vendorId: vendor.id, category: vendor.category }
    ).catch(() => {});

    revalidatePath("/admin/vendors");
    return { success: true, id: vendor.id };
  } catch (err) {
    console.error("createVendor error:", err);
    return { success: false, error: "Failed to create vendor." };
  }
}

// ─── Update Vendor ─────────────────────────────────────────────────────────────

export async function updateVendor(
  id: string,
  patch: UpdateVendorInput
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  try {
    const existing = await getVendor(id);
    if (!existing) return { success: false, error: "Vendor not found." };

    if (patch.category && !VENDOR_CATEGORIES.includes(patch.category)) {
      return { success: false, error: "Invalid category." };
    }

    const cleaned: Record<string, unknown> = {};
    if (patch.name !== undefined) {
      const trimmed = patch.name.trim();
      if (!trimmed) return { success: false, error: "Name cannot be empty." };
      cleaned.name = trimmed;
    }
    if (patch.category !== undefined) cleaned.category = patch.category;
    if (patch.email !== undefined) cleaned.email = patch.email.trim() || FieldValue.delete();
    if (patch.phone !== undefined) cleaned.phone = patch.phone.trim() || FieldValue.delete();
    if (patch.website !== undefined) cleaned.website = patch.website.trim() || FieldValue.delete();
    if (patch.instagramHandle !== undefined)
      cleaned.instagramHandle = patch.instagramHandle.trim() || FieldValue.delete();
    if (patch.address !== undefined) cleaned.address = patch.address.trim() || FieldValue.delete();
    if (patch.city !== undefined) cleaned.city = patch.city.trim() || FieldValue.delete();
    if (patch.state !== undefined) cleaned.state = patch.state.trim() || FieldValue.delete();
    if (patch.latitude !== undefined)
      cleaned.latitude = Number.isFinite(patch.latitude) ? patch.latitude : FieldValue.delete();
    if (patch.longitude !== undefined)
      cleaned.longitude = Number.isFinite(patch.longitude) ? patch.longitude : FieldValue.delete();
    if (patch.notes !== undefined) cleaned.notes = patch.notes;
    if (patch.rating !== undefined) cleaned.rating = patch.rating ?? FieldValue.delete();
    if (patch.isPreferred !== undefined) cleaned.isPreferred = patch.isPreferred;
    if (patch.tags !== undefined) cleaned.tags = patch.tags;

    cleaned.updatedAt = FieldValue.serverTimestamp();

    await vendorsCol().doc(id).update(cleaned);

    revalidatePath("/admin/vendors");
    revalidatePath(`/admin/vendors/${id}`);
    return { success: true };
  } catch (err) {
    console.error("updateVendor error:", err);
    return { success: false, error: "Failed to update vendor." };
  }
}

// ─── Delete Vendor ─────────────────────────────────────────────────────────────

export async function deleteVendor(
  id: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  try {
    const existing = await getVendor(id);
    if (!existing) return { success: false, error: "Vendor not found." };

    await deleteVendorDoc(id);

    await logActivity(
      "NOTE_ADDED",
      `Vendor "${existing.name}" removed from network`,
      { vendorId: id }
    ).catch(() => {});

    revalidatePath("/admin/vendors");
    return { success: true };
  } catch (err) {
    console.error("deleteVendor error:", err);
    return { success: false, error: "Failed to delete vendor." };
  }
}

// ─── Reciprocity Counters ──────────────────────────────────────────────────────
// Manual log entry points. Phase 13.19 introduces logReferralSentAction /
// logReferralReceivedAction as the canonical names; the older
// incrementReferralSent / incrementReferralReceived names are kept as aliases
// so existing call sites in the detail page keep working.

export async function logReferralSentAction(
  vendorId: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  try {
    await logVendorReferralSent(vendorId);
    revalidatePath("/admin/vendors");
    revalidatePath(`/admin/vendors/${vendorId}`);
    return { success: true };
  } catch (err) {
    console.error("logReferralSentAction error:", err);
    return { success: false, error: "Failed to update referral count." };
  }
}

export async function logReferralReceivedAction(
  vendorId: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  try {
    await logVendorReferralReceived(vendorId);
    revalidatePath("/admin/vendors");
    revalidatePath(`/admin/vendors/${vendorId}`);
    return { success: true };
  } catch (err) {
    console.error("logReferralReceivedAction error:", err);
    return { success: false, error: "Failed to update referral count." };
  }
}

export async function incrementReferralSent(
  id: string
): Promise<{ success: boolean; error?: string }> {
  return logReferralSentAction(id);
}

export async function incrementReferralReceived(
  id: string
): Promise<{ success: boolean; error?: string }> {
  return logReferralReceivedAction(id);
}
