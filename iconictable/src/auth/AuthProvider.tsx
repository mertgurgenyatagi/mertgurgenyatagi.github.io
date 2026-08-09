import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "@/firebase";

type AuthValue = {
  user: User | null;
  /** True until Firebase has reported the initial auth state. Nothing that
   *  depends on "am I signed in" should render before this clears. */
  loading: boolean;
  /** True while a sign-in popup is actually in flight. */
  pending: boolean;
  signIn: () => Promise<void>;
  signOutNow: () => Promise<void>;
  /** Last sign-in failure, surfaced under the button rather than swallowed. */
  error: string | null;
};

const AuthContext = createContext<AuthValue | null>(null);

/**
 * Turns a Firebase auth error code into something a person can act on.
 * Returns null for the one case that genuinely needs no message: the user
 * deliberately closed the popup.
 */
export function signInErrorMessage(code: string): string | null {
  switch (code) {
    case "auth/popup-closed-by-user":
      return null;
    case "auth/operation-not-allowed":
      return "Google sign-in isn't switched on for this site yet.";
    case "auth/unauthorized-domain":
      return "This site isn't authorised for sign-in yet.";
    case "auth/network-request-failed":
      return "Network problem — check your connection and try again.";
    default:
      return "Couldn't sign you in. Try again.";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (next) => {
      setUser(next);
      setLoading(false);
    });
  }, []);

  // Completes the redirect fallback below. Harmless when no redirect happened.
  useEffect(() => {
    getRedirectResult(auth).catch((err) => {
      const code = (err as { code?: string })?.code ?? "";
      const message = signInErrorMessage(code);
      if (message) setError(message);
    });
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      pending,
      error,
      async signIn() {
        // Guard against a second click while the first popup is opening.
        // Without this, the second call aborts the first with
        // `auth/cancelled-popup-request` and *both* silently do nothing —
        // which reads to the user as the button being broken, so they click
        // again, and again.
        if (pending) return;

        setError(null);
        setPending(true);
        try {
          await signInWithPopup(auth, new GoogleAuthProvider());
        } catch (err) {
          const code = (err as { code?: string })?.code ?? "";

          // A popup blocked by the browser isn't a failure to report — it's a
          // reason to use the other flow. Redirect always works.
          if (code === "auth/popup-blocked") {
            try {
              await signInWithRedirect(auth, new GoogleAuthProvider());
              return;
            } catch {
              setError("Couldn't open the Google sign-in window.");
              return;
            }
          }

          // Superseded by a newer request — the newer one owns the outcome.
          if (code === "auth/cancelled-popup-request") return;

          const message = signInErrorMessage(code);
          if (message) setError(message);
        } finally {
          setPending(false);
        }
      },
      async signOutNow() {
        await signOut(auth);
      },
    }),
    [user, loading, pending, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
