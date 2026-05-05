"use client";

// components/AuthProvider.tsx
// Wraps the app in a Firebase Auth observer so any Client Component can call
// useAuth() to get the current user without prop drilling.
//
// Also handles the "complete sign-in" step when a user lands back on the
// site after clicking their magic link invite email.
//
// Two-step admin session flow:
//   afterSignIn() → POST idToken → if needsRefresh, force-refresh token
//   → POST fresh token → session cookie now contains role:"ADMIN".

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { firebaseAuth as auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

type AuthContextValue = {
  user:        User | null;
  loading:     boolean;
  signOut:     () => Promise<void>;
  afterSignIn: () => Promise<{ role: string }>;
};

const AuthContext = createContext<AuthContextValue>({
  user:        null,
  loading:     true,
  signOut:     async () => {},
  afterSignIn: async () => ({ role: "CLIENT" }),
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router                = useRouter();

  // Exchange Firebase ID token for a server-side session cookie.
  // Handles the two-step flow needed when admin claims are set for the
  // first time so that the resulting cookie embeds role:"ADMIN".
  const afterSignIn = useCallback(async (): Promise<{ role: string }> => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("No user signed in");

    // ── Step 1: send the current token ────────────────────────────────────
    const idToken = await currentUser.getIdToken();
    const res = await fetch("/api/auth/session", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ idToken }),
    });

    if (!res.ok) throw new Error("Session creation failed");
    const data: { ok: boolean; role: string; needsRefresh?: boolean } = await res.json();

    // ── Step 2 (admin first login only): refresh token & re-create session ─
    // The server just set the ADMIN custom claim. The current token doesn't
    // carry it yet, so the session cookie would be missing the role.
    // Force Firebase to issue a fresh token, then create a proper session.
    if (data.needsRefresh) {
      // Bust the client-side token cache — next getIdToken() hits Firebase.
      await currentUser.getIdToken(/* forceRefresh= */ true);
      const freshToken = await currentUser.getIdToken();

      const res2 = await fetch("/api/auth/session", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ idToken: freshToken }),
      });

      if (!res2.ok) throw new Error("Session refresh failed");
      return res2.json() as Promise<{ role: string }>;
    }

    return data;
  }, []);

  // Complete the email-link sign-in when the user lands back from an invite.
  // This only runs on the /login/complete page (or if AuthProvider detects
  // a magic-link URL before the complete page mounts).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isSignInWithEmailLink(auth, window.location.href)) return;

    const email = window.localStorage.getItem("emailForSignIn");
    if (!email) return;

    signInWithEmailLink(auth, email, window.location.href)
      .then(async () => {
        window.localStorage.removeItem("emailForSignIn");
        await afterSignIn();
        router.replace("/gallery");
      })
      .catch((err) => {
        console.error("Email link sign-in failed:", err);
        router.replace("/login?error=1");
      });
  }, [router, afterSignIn]);

  // Keep local state in sync with Firebase Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsub;
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    await fetch("/api/auth/signout", { method: "POST" });
    setUser(null);
    setLoading(false);
    router.push("/");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, signOut, afterSignIn }}>
      {children}
    </AuthContext.Provider>
  );
}