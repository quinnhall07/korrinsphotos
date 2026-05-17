"use server";

// app/magnet/[slug]/actions.ts
// Server Action for the lead-magnet gate. Reads the `__origin` cookie
// server-side (Next 15 async cookies) and delegates the actual orchestration
// to `lib/domain/lead-magnets > gateLeadMagnetDownload`.

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  gateLeadMagnetDownload,
  type OriginCookie,
} from "@/lib/domain/lead-magnets";

const GateSchema = z.object({
  slug: z.string().min(1, "Missing slug"),
  email: z.string().email("Please enter a valid email address"),
  firstName: z.string().trim().max(100).optional(),
});

export type GateActionResult =
  | { success: true; downloadUrl: string; fileName: string }
  | { success: false; error: string };

function parseOriginCookie(raw: string | undefined): OriginCookie | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as OriginCookie;
    }
    return null;
  } catch {
    return null;
  }
}

export async function gateAction(
  slug: string,
  email: string,
  firstName?: string
): Promise<GateActionResult> {
  const parsed = GateSchema.safeParse({ slug, email, firstName });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Invalid form data.",
    };
  }

  const cookieStore = await cookies();
  const originCookie = parseOriginCookie(cookieStore.get("__origin")?.value);

  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    hdrs.get("x-real-ip") ||
    undefined;
  const userAgent = hdrs.get("user-agent") ?? undefined;

  try {
    const { downloadUrl, magnet } = await gateLeadMagnetDownload({
      slug: parsed.data.slug,
      email: parsed.data.email,
      firstName: parsed.data.firstName,
      originCookie,
      ip,
      userAgent,
    });
    try {
      revalidatePath("/admin/clients");
      revalidatePath(`/admin/lead-magnets/${magnet.id}`);
    } catch {
      // best-effort
    }
    return {
      success: true,
      downloadUrl,
      fileName: magnet.downloadFileName,
    };
  } catch (err) {
    console.error("gateAction failed", { slug, err });
    const msg = err instanceof Error ? err.message : "Could not generate your download link.";
    return { success: false, error: msg };
  }
}
