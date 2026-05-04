"use client";

// components/FirebaseAuthProvider.tsx
// Provides Firebase auth state to all Client Components.
// Also handles the post-sign-in handshake: after Firebase signs the user in,
// we POST the ID token to /api/auth/session to create the server-side cookie.

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
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { firebaseAuth } from "@/lib/firebase";

interface AuthContextValue {
  user:          User | null;
  loading:       boolean;
  role:          "ADMIN" | "CLIENT" | null;
  signOut:       () => Promise<void>;
  /** Call this after any Firebase sign-in to exchange ID token for session cookie */
  afterSignIn:   () => Promise<{ role: string }>;
}

const AuthContext = createContext<AuthContextValue>({
  user:        null,
  loading:     true,
  role:        null,
  signOut:     async () => {},
  afterSignIn: async () => ({ role: "CLIENT" }),
});

export function FirebaseAuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [role,    setRole]    = useState<"ADMIN" | "CLIENT" | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Exchange Firebase ID token for a server-side session cookie
  const afterSignIn = useCallback(async () => {
    const currentUser = firebaseAuth.currentUser;
    if (!currentUser) throw new Error("No user signed in");

    const idToken = await currentUser.getIdToken();
    const res     = await fetch("/api/auth/session", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ idToken }),
    });

    if (!res.ok) throw new Error("Session creation failed");

    const data = await res.json();
    setRole(data.role ?? "CLIENT");
    return data;
  }, []);

  // Sign out from Firebase + clear server session cookie
  const signOut = useCallback(async () => {
    await firebaseSignOut(firebaseAuth);
    await fetch("/api/auth/signout", { method: "POST" });
    setUser(null);
    setRole(null);
    router.push("/");
  }, [router]);

  // Listen for auth state changes (handles page refresh, tab focus, etc.)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Read the role from the custom claim embedded in the token
        const tokenResult = await firebaseUser.getIdTokenResult();
        setRole((tokenResult.claims["role"] as "ADMIN" | "CLIENT") ?? "CLIENT");
      } else {
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, role, signOut, afterSignIn }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}