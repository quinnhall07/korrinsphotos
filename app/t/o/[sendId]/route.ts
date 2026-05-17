// app/t/o/[sendId]/route.ts
// Phase 1.6 / 4.3 — Email-open tracking pixel. Every tracked outbound email
// embeds <img src="…/t/o/{sendId}" width="1" height="1"> as a final element
// in the body. The mail client fetches the image; we record an
// `emailEvents` row of type "opened" and return a 1×1 transparent GIF.
//
// Design constraints:
//   - NEVER throw. Mail clients that get a 5xx will show a broken-image
//     icon, which is a worse user experience than silently failing.
//   - NEVER cache. Most modern mail clients (Gmail, Outlook) proxy images
//     through their own cache; setting no-store doesn't beat them but it
//     does stop our own CDN from collapsing repeated opens.
//   - Unknown sendId still serves the pixel — we don't want broken images
//     to appear in inboxes if a row was lost.

import { NextRequest, NextResponse } from "next/server";
import { createEmailEvent } from "@/lib/db/email-events";

// 1×1 transparent GIF, base64-encoded. Stable bytes — do not modify.
const PIXEL_BASE64 = "R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";
const PIXEL_BYTES = Buffer.from(PIXEL_BASE64, "base64");

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ sendId: string }> }
): Promise<NextResponse> {
  try {
    const { sendId } = await ctx.params;
    if (sendId && /^[a-f0-9]+$/i.test(sendId)) {
      // Fire-and-forget the event. We don't await with extra error UI; if
      // Firestore is down the pixel still ships.
      const userAgent = req.headers.get("user-agent");
      // We don't know recipientEmail from the pixel hit alone — it lives on
      // the `sent` row. The aggregation join happens via sendId at read time.
      createEmailEvent({
        sendId,
        recipientEmail: "",
        type: "opened",
        userAgent: userAgent ?? null,
      }).catch((err) => {
        console.error("[/t/o/:sendId] createEmailEvent failed", { sendId, err });
      });
    }
  } catch (err) {
    console.error("[/t/o/:sendId] unexpected error", err);
  }

  return new NextResponse(new Uint8Array(PIXEL_BYTES), {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL_BYTES.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
