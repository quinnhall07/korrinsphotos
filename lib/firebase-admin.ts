// lib/firebase-admin.ts
// Firebase Admin SDK — server-side only. Never import in Client Components.
//
// Required env vars:
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY   (paste full PEM; \n line breaks are handled)
//
// If any of those env vars are missing, this module exports lazy proxies that
// throw on first actual use instead of crashing at import time. This lets
// Next.js page-data collection succeed during `next build` in environments
// where the secrets aren't loaded (CI, fresh clones), while still failing
// loudly at runtime if a real handler tries to read/write Firestore.

import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth }                      from "firebase-admin/auth";
import { getFirestore, type Firestore }            from "firebase-admin/firestore";

function hasCredentials(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  );
}

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

function throwOnUse(): never {
  throw new Error(
    "Firebase Admin SDK is not initialized — set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY."
  );
}

function lazyProxy<T extends object>(): T {
  return new Proxy({} as T, {
    get: throwOnUse,
    apply: throwOnUse,
    construct: throwOnUse,
  });
}

const initialized = hasCredentials();
const adminApp: App | null         = initialized ? createAdminApp() : null;
export const adminAuth: Auth       = adminApp ? getAuth(adminApp)      : lazyProxy<Auth>();
export const adminDb:   Firestore  = adminApp ? getFirestore(adminApp) : lazyProxy<Firestore>();
