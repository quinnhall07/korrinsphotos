"use server";

// app/booking/actions.ts
// Server Action: validates booking form and writes to Firestore.
// Also fires an auto-responder email via the Firebase "Trigger Email" extension.
// Applies automatic tags based on inquiry data (Rush, High-Budget, Destination, etc.)

import { adminDb }    from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { z }          from "zod";
import { cookies }    from "next/headers";
import { calculateLeadScore } from "@/lib/lead-scoring";
import { logActivity } from "@/lib/db/activity";
import { createInboxItem } from "@/lib/db/inbox";
import { enqueueTrackedMail } from "@/lib/email/tracking";
import { getCampaignBySlug, incrementCampaignInquiry } from "@/lib/db/campaigns";
import { getFirstAdminUser } from "@/lib/db/users";
import { getStudioHoursOrDefault } from "@/lib/db/admin-settings";
import { isStudioOpen, describeClosedReason } from "@/lib/studio-hours";

// Public session-type vocabulary (May 2026 redesign — operator decision):
// keep Portrait + Family, add Greek-life event. Legacy values
// (Wedding/Engagement/Editorial/Commercial) stay in the schema so projects
// created before this change still validate, but the booking form no longer
// surfaces them. Lead scoring (lib/lead-scoring.ts) covers the same enum.
const BookingSchema = z.object({
  firstName:     z.string().min(1, "First name is required").max(100),
  lastName:      z.string().min(1, "Last name is required").max(100),
  email:         z.string().email("Please enter a valid email address"),
  sessionType:   z.enum([
    "Portrait",
    "Family",
    "Greek-life event",
    // ── Legacy (still accepted on existing projects) ──
    "Wedding",
    "Engagement",
    "Editorial",
    "Commercial",
  ], {
    errorMap: () => ({ message: "Please select a session type" }),
  }),
  preferredDate: z.string().optional(),
  message:       z.string().min(10, "Please tell me a bit more about your vision").max(5000),
  // ── Optional multi-step form extensions (all default to safe no-ops) ────
  phone:             z.string().max(40).optional(),
  smsConsent:        z.union([z.literal("on"), z.literal("true")]).optional(),
  referralSource:    z.enum(["Instagram", "TikTok", "Google", "Friend or Family", "Other"]).optional(),
  referredByEmail:   z.string().email().optional().or(z.literal("")),
  locationLabel:     z.string().max(120).optional(),
  locationDetail:    z.string().max(200).optional(),
  preferredMonth:    z.string().regex(/^\d{4}-\d{2}$/, "Invalid month").optional(),
});

type BookingResult = { success: true } | { success: false; error: string };

export async function submitBooking(formData: FormData): Promise<BookingResult> {
  // Normalise empty strings to undefined so optional enums don't reject "".
  const opt = (v: FormDataEntryValue | null) => {
    const s = typeof v === "string" ? v.trim() : "";
    return s === "" ? undefined : s;
  };

  const parsed = BookingSchema.safeParse({
    firstName:      formData.get("firstName"),
    lastName:       formData.get("lastName"),
    email:          formData.get("email"),
    sessionType:    formData.get("sessionType"),
    preferredDate:  opt(formData.get("preferredDate")),
    message:        formData.get("message"),
    phone:           opt(formData.get("phone")),
    smsConsent:      opt(formData.get("smsConsent")),
    referralSource:  opt(formData.get("referralSource")),
    referredByEmail: opt(formData.get("referredByEmail")),
    locationLabel:   opt(formData.get("locationLabel")),
    locationDetail:  opt(formData.get("locationDetail")),
    preferredMonth:  opt(formData.get("preferredMonth")),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid form data" };
  }

  const {
    firstName, lastName, email, sessionType, preferredDate, message,
    phone, smsConsent, referralSource, referredByEmail,
    locationLabel, locationDetail, preferredMonth,
  } = parsed.data;

  // If only a month was provided (no specific date), use the first of that month
  // so the existing preferredDate-based logic (Rush tag, shootDate) still works.
  const effectivePreferredDate = preferredDate
    ?? (preferredMonth ? `${preferredMonth}-01` : undefined);
  
  const cookieStore = await cookies();
  const originStr = cookieStore.get("__origin")?.value;
  const origin = originStr ? JSON.parse(originStr) : {};

  // Cookie precedence: `__campaign` (set by /c/[slug] on every visit) wins
  // over the generic `__origin` UTM cookie for the three firstTouch UTM
  // fields, because campaigns are explicit higher-intent attribution
  // sources. We do NOT touch `firstTouchLandingUrl` / `firstTouchAt` —
  // those still reflect the first-page-hit values from `__origin`.
  const campaignStr = cookieStore.get("__campaign")?.value;
  let campaignSlug: string | null = null;
  let campaignUtm: { source: string; medium: string; campaign: string } | null = null;
  if (campaignStr) {
    try {
      const parsed = JSON.parse(campaignStr) as { slug?: string };
      const slug = typeof parsed?.slug === "string" ? parsed.slug.trim() : "";
      if (slug) {
        const campaignDoc = await getCampaignBySlug(slug);
        // Only honour ACTIVE campaigns. DRAFT / ARCHIVED / unknown fall back
        // to the existing __origin behaviour.
        if (campaignDoc && campaignDoc.status === "ACTIVE") {
          campaignSlug = campaignDoc.slug;
          campaignUtm = {
            source: campaignDoc.defaultUtm.source,
            medium: campaignDoc.defaultUtm.medium,
            campaign: campaignDoc.defaultUtm.campaign,
          };
        }
      }
    } catch (err) {
      console.error("Failed to resolve __campaign cookie:", err);
    }
  }

  // Resolved first-touch UTM tuple — campaign overrides __origin.
  const firstTouchSource = campaignUtm?.source ?? origin.source ?? "WEBSITE";
  const firstTouchMedium = campaignUtm?.medium ?? origin.medium ?? null;
  const firstTouchCampaign = campaignUtm?.campaign ?? origin.campaign ?? null;

  try {
    // ── Automatic tagging heuristics ──────────────────────────────────────────
    const autoTags: string[] = [sessionType]; // Automatically tag the session type

    // "Rush" — preferred date is within 30 days
    if (effectivePreferredDate) {
      const daysUntil = Math.round(
        (new Date(effectivePreferredDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntil >= 0 && daysUntil <= 30) {
        autoTags.push("Rush");
      }
    }

    // "High Budget" — Wedding and Commercial sessions tend to be higher investment
    if (sessionType === "Wedding" || sessionType === "Commercial") {
      autoTags.push("High Budget");
    }

    // "Destination" — message mentions travel/location keywords, or user
    // explicitly chose the "I'll travel — somewhere else" location bucket.
    const destinationKeywords = [
      "destination", "travel", "out of state", "out-of-state", "flying",
      "abroad", "international", "beach", "resort", "island", "overseas",
      "europe", "mexico", "caribbean", "hawaii", "bali", "italy", "france",
      "spain", "greece", "costa rica", "vineyard", "mountain",
    ];
    const msgLower = message.toLowerCase();
    if (
      destinationKeywords.some((kw) => msgLower.includes(kw)) ||
      locationLabel === "I'll travel — somewhere else"
    ) {
      autoTags.push("Destination");
    }

    // "Needs Follow-Up" — no preferred date (specific or month) means we
    // should reach out to clarify.
    if (!effectivePreferredDate) {
      autoTags.push("Needs Follow-Up");
    }

    // ── Phase 13.2: Studio Hours resolution ─────────────────────────────────
    // Resolve the admin's configured studio hours and decide whether this
    // inquiry came in off-hours. We tag the project so the inbox can
    // filter, and (below, after the main responder) send a second
    // courtesy email setting expectations. Wrapped in try/catch — if any
    // step fails we silently fall back to "open as usual".
    //
    // INTEGRATION CHOICE: send a *second* lightweight follow-up email
    // rather than mutating the existing auto-responder body. Reasons:
    //   1. The main responder template is heavily styled and already
    //      promises a 48h response window — surgery on it risks
    //      contradictions (e.g. "I'll respond in 48h" + "I'll respond by
    //      Monday at 9 AM" in the same email).
    //   2. A separate "we're outside studio hours, you'll hear back by X"
    //      email is the universally accepted modern convention.
    //   3. Tracking-wise, each send gets its own sendId so we can A/B
    //      whether the off-hours preamble lifts engagement.
    let studioWasClosed = false;
    let nextOpenLabel = "";
    let closedReasonLabel = "";
    let customOffHoursMessage = "";
    try {
      const admin = await getFirstAdminUser();
      if (admin) {
        const studioHours = await getStudioHoursOrDefault(admin.uid);
        const status = isStudioOpen(studioHours, new Date());
        if (!status.isOpen) {
          studioWasClosed = true;
          autoTags.push("OFF_HOURS_INQUIRY");
          nextOpenLabel = status.nextOpenLabel;
          closedReasonLabel = describeClosedReason(status.reason, studioHours);
          customOffHoursMessage = (studioHours.offHoursMessage ?? "").trim();
        }
      }
    } catch (err) {
      console.error("[submitBooking] studio-hours resolution failed", err);
    }

    // Calculate initial lead score (with tags applied so they influence score)
    const leadScore = calculateLeadScore({
      sessionType,
      message,
      preferredDate: effectivePreferredDate ?? undefined,
      tags: autoTags,
    });

    // ── Resolve referrer (Phase 4.4 tiered referral engine) ────────────────
    //
    // The `__origin` cookie may contain a `referralCode` from the `?ref=` URL
    // parameter (middleware.ts captures this on first visit; first-touch is
    // immutable per ADR-016). If present, resolve it to a clientId so we can
    // stamp `referredBy` on a brand-new client. Lookup is best-effort — a
    // bad/expired code must not block the submission.
    let referredByClientId: string | null = null;
    const incomingReferralCode: string | null =
      typeof origin?.referralCode === "string" && origin.referralCode.trim() !== ""
        ? origin.referralCode.trim()
        : null;
    if (incomingReferralCode) {
      try {
        const referrerSnap = await adminDb
          .collection("clients")
          .where("referralCode", "==", incomingReferralCode)
          .limit(1)
          .get();
        if (!referrerSnap.empty) {
          referredByClientId = referrerSnap.docs[0].id;
        }
      } catch (err) {
        console.error("Referral code resolution failed", { incomingReferralCode, err });
      }
    }

    // Fallback: the public form lets the visitor type the email of the person
    // who referred them. If we don't already have a referrer from the
    // `?ref=` link, resolve the email → client id. Best-effort; an unknown
    // email is fine (we still want the inquiry).
    const trimmedReferredByEmail = (referredByEmail ?? "").trim().toLowerCase();
    if (!referredByClientId && trimmedReferredByEmail) {
      try {
        const refByEmailSnap = await adminDb
          .collection("clients")
          .where("email", "==", trimmedReferredByEmail)
          .limit(1)
          .get();
        if (!refByEmailSnap.empty) {
          referredByClientId = refByEmailSnap.docs[0].id;
        }
      } catch (err) {
        console.error("referredByEmail resolution failed", { trimmedReferredByEmail, err });
      }
    }

    // 1. Find or create Client
    let clientId: string;
    const clientSnap = await adminDb.collection("clients").where("email", "==", email).limit(1).get();

    if (!clientSnap.empty) {
      // Returning client — never overwrite an existing `referredBy`. First-touch
      // attribution is sticky. Only backfill if the existing client has none.
      const existingDoc = clientSnap.docs[0];
      clientId = existingDoc.id;
      const existingReferredBy = existingDoc.data()?.referredBy;
      const selfReferral = referredByClientId === clientId;
      if (
        referredByClientId &&
        !selfReferral &&
        (existingReferredBy === undefined || existingReferredBy === null)
      ) {
        try {
          await existingDoc.ref.update({
            referredBy: referredByClientId,
            updatedAt: FieldValue.serverTimestamp(),
          });
        } catch (err) {
          console.error("Failed to backfill referredBy", { clientId, err });
        }
      }
    } else {
      const slug = firstName.toLowerCase().replace(/[^a-z0-9]/g, "");
      const randomChars = Math.random().toString(36).substring(2, 6);
      const referralCode = `${slug}-${randomChars}`;

      const clientRef = adminDb.collection("clients").doc();
      clientId = clientRef.id;
      const selfReferral = referredByClientId === clientId;
      await clientRef.set({
        email,
        firstName,
        lastName,
        phone: phone ?? null,
        role: "CLIENT",
        referralCode,
        referredBy: referredByClientId && !selfReferral ? referredByClientId : null,
        referralCredit: 0,
        totalSessionsBooked: 0,
        firstTouchSource,
        firstTouchMedium,
        firstTouchCampaign,
        firstTouchLandingUrl: origin.landingUrl ?? null,
        firstTouchAt: origin.ts ? new Date(origin.ts) : FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // 2. Create Project (replaces bookingInquiry)
    const projectRef = adminDb.collection("projects").doc();
    const projectId = projectRef.id;
    await projectRef.set({
      clientId,
      status: "INQUIRY",
      sessionType,
      title: `${firstName} ${lastName} — ${sessionType}`,
      shootDate: effectivePreferredDate ? new Date(effectivePreferredDate) : null,
      shootLocation: locationDetail || locationLabel || null,
      notes: "",
      leadSource: firstTouchSource,
      leadScore,
      tags: autoTags,
      estimatedValue: null,
      followUpDate: null,
      lastContactedAt: null,
      lastRespondedAt: null,
      // Optional multi-step extensions — null when not collected.
      locationLabel:  locationLabel ?? null,
      preferredMonth: preferredMonth ?? null,
      referralSource: referralSource ?? null,
      referredByEmail: referredByEmail || null,
      smsConsent:     !!smsConsent,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    // 3. Write first inbound message to subcollection
    await projectRef.collection("messages").add({
      direction: "INBOUND",
      channel: "EMAIL",
      body: message,
      sentAt: FieldValue.serverTimestamp(),
      isAutomatic: false,
    });

    // 4. Surface in the unified admin inbox (best-effort — must not break submission).
    await createInboxItem({
      type: "INQUIRY_RECEIVED",
      projectId,
      clientId,
      title: `New inquiry from ${firstName} ${lastName}`,
      body: message,
      link: `/admin/projects/${projectId}`,
      read: false,
    }).catch(() => {});

    // Log to activity feed (best-effort)
    await logActivity(
      "LEAD_RECEIVED",
      `New ${sessionType.toLowerCase()} inquiry from ${firstName} ${lastName}`,
      { projectId, sessionType, email }
    ).catch(() => {});

    // Auto-responder: route through the tracked-mail wrapper so we see
    // open/click engagement on the very first touch.
    await enqueueTrackedMail({
      to: email,
      subject: `Thank you for your inquiry, ${firstName}!`,
      html: buildAutoResponderHtml({ firstName, sessionType }),
      recipientClientId: clientId,
      projectId,
      sendKind: "auto-responder",
    });

    // Phase 13.2: secondary off-hours notice. Send AFTER the primary
    // responder so inbox ordering reads "main confirmation" first, "FYI:
    // we're out" second. Best-effort — failures here must not break the
    // submission.
    if (studioWasClosed) {
      try {
        await enqueueTrackedMail({
          to: email,
          subject: "We received your inquiry — quick note on timing",
          html: buildOffHoursHtml({
            firstName,
            customMessage: customOffHoursMessage,
            closedReasonLabel,
            nextOpenLabel,
          }),
          recipientClientId: clientId,
          projectId,
          sendKind: "off-hours-notice",
        });
      } catch (err) {
        console.error("[submitBooking] off-hours email send failed", err);
      }
    }

    // Campaign inquiry counter — best-effort, never blocks the response.
    if (campaignSlug) {
      await incrementCampaignInquiry(campaignSlug).catch(() => {});
    }

    return { success: true };
  } catch (err) {
    console.error("Booking submission error:", err);
    return { success: false, error: "Unable to submit your inquiry right now. Please try again." };
  }
}

function buildAutoResponderHtml({
  firstName,
  sessionType,
}: {
  firstName: string;
  sessionType: string;
}): string {
  const rates: Record<string, string> = {
    Wedding:    "$2,800 – $6,500 depending on coverage hours and add-ons.",
    Portrait:   "$350 – $750 for a standard 1–2 hour session.",
    Editorial:  "$500 – $2,000 depending on scope and usage.",
    Family:     "$300 – $600 for an outdoor or in-home session.",
    Engagement: "$450 – $850 for a 1.5-hour golden-hour session.",
    Commercial: "$750 – $3,000 depending on scope and licensing.",
  };

  const rate = rates[sessionType] ?? "Rates vary by session type — we'll cover details in our call.";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thank you for your inquiry</title>
</head>
<body style="margin:0;padding:0;background:#FAF9F6;font-family:'Georgia',serif;">
  <div style="max-width:560px;margin:40px auto;background:#FAF9F6;border:0.5px solid rgba(42,42,40,0.15);">
    
    <!-- Header -->
    <div style="background:#2A2A28;padding:32px 40px;">
      <p style="margin:0;font-size:22px;font-weight:300;color:#FAF9F6;letter-spacing:0.04em;">
        Korrin&apos;s Photography<span style="color:#6B7845;">.</span>
      </p>
    </div>

    <!-- Body -->
    <div style="padding:40px;">
      <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#6B7845;">
        Booking Inquiry Received
      </p>
      <h1 style="margin:0 0 24px;font-size:28px;font-weight:300;color:#2A2A28;line-height:1.2;">
        Thank you, ${firstName}
      </h1>

      <p style="margin:0 0 20px;font-size:15px;color:#4A4A47;line-height:1.8;">
        I've received your ${sessionType.toLowerCase()} inquiry and I'm genuinely excited to learn more about your vision. I'll be in touch within <strong>48 hours</strong> to discuss availability and next steps.
      </p>

      <!-- Rate callout -->
      <div style="background:#E8EBD8;border-left:2px solid #6B7845;padding:16px 20px;margin:0 0 24px;">
        <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#6B7845;">
          Typical ${sessionType} Investment
        </p>
        <p style="margin:0;font-size:15px;color:#2A2A28;line-height:1.6;">
          ${rate}
        </p>
      </div>

      <p style="margin:0 0 20px;font-size:15px;color:#4A4A47;line-height:1.8;">
        Every package is tailored to your needs — the figures above are a starting point. We'll find something that feels right for you.
      </p>

      <p style="margin:0 0 8px;font-size:15px;color:#4A4A47;line-height:1.8;">
        In the meantime, feel free to explore my portfolio for a feel of my work.
      </p>

      <a href="${process.env.NEXT_PUBLIC_APP_URL}/portfolio"
         style="display:inline-block;margin-top:12px;padding:12px 28px;background:#6B7845;color:#FAF9F6;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;text-decoration:none;font-family:sans-serif;">
        View Portfolio
      </a>
    </div>

    <!-- Footer -->
    <div style="padding:24px 40px;border-top:0.5px solid rgba(42,42,40,0.12);">
      <p style="margin:0;font-size:12px;color:#8A8A85;line-height:1.6;">
        This is an automated confirmation. Please don't reply to this email — Korrin will reach out directly from her personal address.<br><br>
        © ${new Date().getFullYear()} Korrin's Photography. All rights reserved.
      </p>
    </div>

  </div>
</body>
</html>
  `.trim();
}

/**
 * Phase 13.2 — Off-hours follow-up email. Sent IN ADDITION to the
 * standard auto-responder when a booking arrives outside Korrin's
 * configured studio hours. Sets expectations more precisely than the
 * generic "48 hours" promise.
 *
 * `customMessage`, if provided by the admin in their Settings page, is
 * preferred over the built-in default copy. We swap a literal
 * `{nextOpenLabel}` token in both cases so the admin can write something
 * like "I'll personally reply by {nextOpenLabel}" and have it filled in.
 */
function buildOffHoursHtml({
  firstName,
  customMessage,
  closedReasonLabel,
  nextOpenLabel,
}: {
  firstName: string;
  customMessage: string;
  closedReasonLabel: string;
  nextOpenLabel: string;
}): string {
  const defaultBody =
    "Thanks for reaching out — Korrin is outside studio hours right now. " +
    "You'll hear back by {nextOpenLabel}.";

  const template = customMessage.trim() !== "" ? customMessage : defaultBody;
  const body = template.replace(/\{nextOpenLabel\}/g, nextOpenLabel || "the next business day");

  // Short, calm, single-column email. No CTA — just an expectation reset.
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quick note on timing</title>
</head>
<body style="margin:0;padding:0;background:#FAF9F6;font-family:'Georgia',serif;">
  <div style="max-width:520px;margin:40px auto;background:#FAF9F6;border:0.5px solid rgba(42,42,40,0.15);">
    <div style="background:#2A2A28;padding:24px 36px;">
      <p style="margin:0;font-size:18px;font-weight:300;color:#FAF9F6;letter-spacing:0.04em;">
        Korrin&apos;s Photography<span style="color:#6B7845;">.</span>
      </p>
    </div>
    <div style="padding:32px 36px;">
      <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#6B7845;">
        Outside Studio Hours
      </p>
      <h1 style="margin:0 0 20px;font-size:22px;font-weight:300;color:#2A2A28;line-height:1.25;">
        Hi ${firstName} —
      </h1>
      <p style="margin:0 0 16px;font-size:15px;color:#4A4A47;line-height:1.75;">
        ${body}
      </p>
      ${
        closedReasonLabel
          ? `<p style="margin:0 0 8px;font-size:13px;color:#8A8A85;line-height:1.7;font-style:italic;">
          (We're currently ${closedReasonLabel}.)
        </p>`
          : ""
      }
    </div>
    <div style="padding:18px 36px;border-top:0.5px solid rgba(42,42,40,0.12);">
      <p style="margin:0;font-size:11px;color:#8A8A85;line-height:1.6;">
        Automated notice. Please don't reply — Korrin will follow up from her personal address.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
