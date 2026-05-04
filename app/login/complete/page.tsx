"use client";

// app/login/complete/page.tsx (or wherever you handle the email link)
import { isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function CompleteLogin() {
  const { afterSignIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    async function completeSignIn() {
      if (isSignInWithEmailLink(firebaseAuth, window.location.href)) {
        const email = window.localStorage.getItem("emailForSignIn");
        if (email) {
          try {
            await signInWithEmailLink(firebaseAuth, email, window.location.href);
            await afterSignIn(); // CRITICAL: This creates the server-side __session cookie
            window.localStorage.removeItem("emailForSignIn");
            router.push("/gallery");
          } catch (error) {
            console.error("Error signing in with magic link", error);
          }
        }
      }
    }
    completeSignIn();
  }, [afterSignIn, router]);

  return <p>Completing your sign in...</p>;
}