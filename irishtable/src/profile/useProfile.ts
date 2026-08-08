import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase";
import { useDoc } from "@/lib/useDoc";
import type { Profile } from "./profileTypes";

function toProfile(data: Record<string, unknown>, uid: string): Profile {
  return {
    uid,
    displayName: typeof data.displayName === "string" ? data.displayName : "",
    photoURL: typeof data.photoURL === "string" ? data.photoURL : "",
    createdAt: typeof data.createdAt === "number" ? data.createdAt : 0,
  };
}

export function useProfile(uid: string | null) {
  return useDoc<Profile>(uid ? `profiles/${uid}` : null, toProfile);
}

/**
 * Every participant, for the Home participant list and author lookups.
 *
 * Ignores cache-only snapshots until the first server-confirmed one arrives.
 * This is the parent project's hard-won bug: another listener on
 * `profiles/{me}` primes Firestore's watch cache, so this collection listener
 * can receive a fast partial snapshot containing only the signed-in viewer's
 * own document. Releasing the loading gate on that paints a one-person list
 * that then pops to fifty. Live updates after the first server snapshot are
 * unaffected.
 */
export function usePlayers() {
  const [players, setPlayers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let sawServerSnapshot = false;

    return onSnapshot(
      collection(db, "profiles"),
      (snap) => {
        if (snap.metadata.fromCache && !sawServerSnapshot) return;
        sawServerSnapshot = true;
        setPlayers(snap.docs.map((d) => toProfile(d.data(), d.id)));
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
  }, []);

  return { players, loading, error };
}
