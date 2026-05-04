// lib/firebase-email.ts
// Server-side utility that sends Firebase Authentication email sign-in links.
//
// WHY THIS EXISTS:
//   Firebase Admin SDK's generateSignInWithEmailLink() only GENERATES the URL —
//   it does NOT send the email. The client SDK's sendSignInLinkToEmail() sends
//   the email automatically, but only runs in the browser.
//
//   This module calls the Firebase Identity Toolkit REST API directly, which
//   IS able to trigger email delivery from a server context. Firebase's own
//   email template and delivery infrastructure handles the actual send.
//
// SETUP REQUIRED IN FIREBASE CONSOLE:
//   1. Authentication → Sign-in method → Email/Password → Enable "Email link"
//   2. Authentication → Settings → Authorized domains → add your domain
//   3. Authentication → Templates → Customize the sign-in link email (optional)

const IDENTITY_TOOLKIT_URL =
  "https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode";

interface SendLinkOptions {
  /** Where Firebase redirects after the user clicks the link.
   *  Should point to your /login page so AuthProvider can complete sign-in.
   *  Include the user's email and desired post-login path as query params. */
  continueUrl: string;
}

/**
 * Sends a Firebase sign-in link email to the given address.
 * Firebase delivers the email using its own templates and sending infrastructure.
 *
 * @throws if the Firebase project is mis-configured or the API key is invalid.
 */
export async function sendFirebaseSignInLink(
  email: string,
  { continueUrl }: SendLinkOptions
): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "NEXT_PUBLIC_FIREBASE_API_KEY is not set. " +
        "Add it to your .env.local file."
    );
  }

  const res = await fetch(`${IDENTITY_TOOLKIT_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestType: "EMAIL_SIGNIN",
      email,
      continueUrl,
      // Required for email-link sign-in
      canHandleCodeInApp: true,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message =
      (data as { error?: { message?: string } })?.error?.message ??
      `HTTP ${res.status}`;
    throw new Error(`Firebase sign-in link failed: ${message}`);
  }
}

/**
 * Builds the continueUrl that Firebase embeds in the email link.
 *
 * This URL must:
 *   a) point to your /login page (so AuthProvider can intercept and complete sign-in)
 *   b) include the recipient's email so sign-in can complete cross-device
 *   c) optionally include a `next` param to redirect after login
 *
 * Firebase will append oobCode, apiKey, and mode params automatically.
 */
export function buildContinueUrl({
  email,
  next,
}: {
  email: string;
  next?: string;
}): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL is not set. Add it to your .env.local file."
    );
  }

  const params = new URLSearchParams({ email });
  if (next) params.set("next", next);

  return `${appUrl}/login?${params.toString()}`;
}