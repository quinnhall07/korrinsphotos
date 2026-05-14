"use server";

// app/admin/reports/ad-spend/actions.ts
// Phase 13.18 — Server Actions for the ad-spend report.
//
// All mutations:
//   1. Require admin (the layout guard does not propagate into Server Actions).
//   2. Convert dollars → cents server-side so the client form never has to
//      know cents at all.
//   3. Denormalise `campaignSlug` onto the row when a `campaignId` is given,
//      mirroring the same pattern Wave 7 uses on outbound mail logs.
//   4. Best-effort log to the activity feed, then revalidate the report path.

import { revalidatePath } from "next/cache";
import { Timestamp } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/session";
import { logActivity } from "@/lib/db/activity";
import {
  createAdSpendEntry as dbCreate,
  updateAdSpendEntry as dbUpdate,
  deleteAdSpendEntry as dbDelete,
  type AdChannel,
  type AdSpendEntryDoc,
  AD_CHANNELS,
} from "@/lib/db/ad-spend";
import { getCampaign } from "@/lib/db/campaigns";

// ─── Shared shape ────────────────────────────────────────────────────────────

export type AdSpendActionResult<T = void> =
  | (T extends void ? { success: true } : { success: true; data: T })
  | { success: false; error: string };

export interface AdSpendEntryInput {
  campaignId?: string | null;
  channel: AdChannel;
  /** ISO date string (yyyy-mm-dd). */
  periodStart: string;
  /** ISO date string (yyyy-mm-dd). */
  periodEnd: string;
  /** Dollars (form input). Converted to cents. */
  amount: number;
  impressions?: number;
  clicks?: number;
  notes?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseIsoDateToTimestamp(iso: string): Timestamp {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) {
    throw new Error(`Invalid date string: ${iso}`);
  }
  return Timestamp.fromDate(new Date(Date.UTC(y, m - 1, d, 0, 0, 0)));
}

function dollarsToCents(value: number): number {
  return Math.round(value * 100);
}

function isAdChannel(value: unknown): value is AdChannel {
  return typeof value === "string" && (AD_CHANNELS as readonly string[]).includes(value);
}

async function resolveCampaignSlug(campaignId: string | null | undefined): Promise<string | null> {
  if (!campaignId) return null;
  try {
    const c = await getCampaign(campaignId);
    return c?.slug ?? null;
  } catch {
    return null;
  }
}

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createAdSpendEntryAction(
  input: AdSpendEntryInput
): Promise<AdSpendActionResult<{ id: string }>> {
  await requireAdmin();

  try {
    if (!isAdChannel(input.channel)) {
      return { success: false, error: "Invalid channel." };
    }
    if (!Number.isFinite(input.amount) || input.amount < 0) {
      return { success: false, error: "Amount must be a non-negative number." };
    }
    if (!input.periodStart || !input.periodEnd) {
      return { success: false, error: "Period start and end are required." };
    }

    const periodStart = parseIsoDateToTimestamp(input.periodStart);
    const periodEnd = parseIsoDateToTimestamp(input.periodEnd);
    if (periodEnd.toMillis() < periodStart.toMillis()) {
      return { success: false, error: "Period end must be on or after period start." };
    }

    const campaignId = input.campaignId?.trim() || null;
    const campaignSlug = await resolveCampaignSlug(campaignId);

    const doc: Omit<AdSpendEntryDoc, "id" | "createdAt" | "updatedAt"> = {
      channel: input.channel,
      periodStart,
      periodEnd,
      amountCents: dollarsToCents(input.amount),
      campaignId,
      campaignSlug,
      ...(typeof input.impressions === "number" && Number.isFinite(input.impressions)
        ? { impressions: Math.max(0, Math.round(input.impressions)) }
        : {}),
      ...(typeof input.clicks === "number" && Number.isFinite(input.clicks)
        ? { clicks: Math.max(0, Math.round(input.clicks)) }
        : {}),
      ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
    };

    const created = await dbCreate(doc);

    await logActivity(
      "NOTE_ADDED",
      `Ad-spend logged: ${input.channel} · $${input.amount.toFixed(2)}`,
      { adSpendEntryId: created.id, campaignId: campaignId ?? undefined }
    ).catch(() => {});

    revalidatePath("/admin/reports/ad-spend");
    revalidatePath("/admin/campaigns");

    return { success: true, data: { id: created.id } };
  } catch (err) {
    console.error("createAdSpendEntryAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create ad-spend entry.",
    };
  }
}

// ─── Update ──────────────────────────────────────────────────────────────────

export async function updateAdSpendEntryAction(
  id: string,
  patch: Partial<AdSpendEntryInput>
): Promise<AdSpendActionResult> {
  await requireAdmin();

  try {
    const cleaned: Partial<AdSpendEntryDoc> = {};

    if (patch.channel !== undefined) {
      if (!isAdChannel(patch.channel)) {
        return { success: false, error: "Invalid channel." };
      }
      cleaned.channel = patch.channel;
    }

    if (patch.campaignId !== undefined) {
      const campaignId = patch.campaignId?.trim() || null;
      cleaned.campaignId = campaignId;
      cleaned.campaignSlug = await resolveCampaignSlug(campaignId);
    }

    if (patch.periodStart) cleaned.periodStart = parseIsoDateToTimestamp(patch.periodStart);
    if (patch.periodEnd) cleaned.periodEnd = parseIsoDateToTimestamp(patch.periodEnd);

    if (typeof patch.amount === "number" && Number.isFinite(patch.amount) && patch.amount >= 0) {
      cleaned.amountCents = dollarsToCents(patch.amount);
    }

    if (typeof patch.impressions === "number" && Number.isFinite(patch.impressions)) {
      cleaned.impressions = Math.max(0, Math.round(patch.impressions));
    }
    if (typeof patch.clicks === "number" && Number.isFinite(patch.clicks)) {
      cleaned.clicks = Math.max(0, Math.round(patch.clicks));
    }
    if (patch.notes !== undefined) {
      cleaned.notes = patch.notes.trim();
    }

    await dbUpdate(id, cleaned);

    revalidatePath("/admin/reports/ad-spend");
    revalidatePath("/admin/campaigns");

    return { success: true };
  } catch (err) {
    console.error("updateAdSpendEntryAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update ad-spend entry.",
    };
  }
}

// ─── Delete ──────────────────────────────────────────────────────────────────

export async function deleteAdSpendEntryAction(
  id: string
): Promise<AdSpendActionResult> {
  await requireAdmin();

  try {
    await dbDelete(id);
    revalidatePath("/admin/reports/ad-spend");
    revalidatePath("/admin/campaigns");
    return { success: true };
  } catch (err) {
    console.error("deleteAdSpendEntryAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete ad-spend entry.",
    };
  }
}
