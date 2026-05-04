// lib/firebase-admin.ts
// Firebase Admin SDK — server-side only. Never import in Client Components.
//
// Required env vars:
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY   (paste full PEM; \n line breaks are handled)

import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth }                      from "firebase-admin/auth";
import { getFirestore, type Firestore }            from "firebase-admin/firestore";

function createAdminApp(): App {
  if (getApps().length > 0) return getApps()[0]!;

  return initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      // Vercel stores multi-line secrets with literal \n — normalise them
      privateKey:  process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    }),
  });
}

const adminApp: App               = createAdminApp();
export const adminAuth: Auth      = getAuth(adminApp);
export const adminDb: Firestore   = getFirestore(adminApp);