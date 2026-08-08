import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { getCached, setCached } from "../lib/sessionCache";

const CACHE_KEY = "predictionSubmitters";

/** Just the set of uids with a `predictions/{uid}` doc — who has submitted,
 *  not what they submitted. Full-collection fetch, same pattern as
 *  usePlayers.ts: a one-shot fetch (not a live listener), so cost is
 *  O(page visits), not O(visits × listeners) — fine up to the site's real
 *  target of ~500 participants; only worth revisiting if that target grows
 *  by an order of magnitude (scaling-audit No. 13, 2026-07-31).
 *
 *  Wired into sessionCache 2026-08-07 (scaling-250 design spec §4). At 250
 *  participants this moves ~150 KiB per visit, because a prediction doc carries
 *  a 36-element ranking array and all of it is downloaded purely to read the
 *  document ids. It also gates first paint on LoggedInHome, the most-visited
 *  signed-in page, so a repeat visit paying for it again was a visible cost as
 *  well as a billed one. A genuinely cold visit still pays it once.
 *
 *  Cached as a string[] rather than a Set: sessionCache persists through
 *  JSON.stringify, which a Set does not survive. */
export function usePredictionSubmitters() {
  const cached = getCached<string[]>(CACHE_KEY);
  const [submitterUids, setSubmitterUids] = useState<Set<string>>(() => new Set(cached ?? []));
  const [loading, setLoading] = useState(cached === undefined);

  useEffect(() => {
    let ignore = false;
    getDocs(collection(db, "predictions"))
      .then((snapshot) => {
        if (ignore) return;
        const uids = snapshot.docs.map((docSnap: { id: string }) => docSnap.id);
        setCached(CACHE_KEY, uids);
        setSubmitterUids(new Set(uids));
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load prediction submitters", err);
        if (ignore) return;
        setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  return { submitterUids, loading };
}
