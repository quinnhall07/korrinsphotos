"use client";

// components/AuthProvider.tsx
// Wraps the app in a Firebase Auth observer so any Client Component can call
// useAuth() to get the current user without prop drilling.
//
// Also handles the "complete sign-in" step when a user lands back on the
// site after clicking their magic link email.

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
  // Called after any Firebase sign-in (OAuth popup or magic link).
  const afterSignIn = useCallback(async (): Promise<{ role: string }> => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("No user signed in");

    const idToken = await currentUser.getIdToken();
    const res = await fetch("/api/auth/session", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ idToken }),
    });

    if (!res.ok) throw new Error("Session creation failed");
    return res.json();
  }, []);

  // Complete the email-link sign-in when the user lands back on the page
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