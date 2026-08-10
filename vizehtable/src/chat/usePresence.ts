import { useEffect, useState } from "react";
import { onDisconnect, onValue, ref, remove, set } from "firebase/database";
import { rtdb } from "../firebase";

// Presence used to be a Firestore collection with a client-side heartbeat
// every 20s and a live listener over the whole collection — meaning every
// heartbeat write fanned out as a read to every other client watching the
// online count, an O(writers × listeners) cost that could exhaust the daily
// free-tier read budget in minutes at real concurrency (scaling-audit
// No. 01, 2026-07-31). Realtime Database is built for exactly this: no
// heartbeat at all, just a value plus a server-side onDisconnect() hook that
// fires the instant the connection actually drops (tab closed, network
// lost, browser crashed) — and it's metered on its own separate free tier,
// entirely off the Firestore budget (scaling-audit No. 16). No staleness
// window needed either: the server removes the entry itself, so the live
// listener below is always accurate, not aged out client-side.

/** Marks `uid` present while mounted, and lets Firebase's own server clear
 *  it the moment the connection drops — call once, near the top of the
 *  signed-in Home tree, so "online" tracks "has Home open." */
export function usePresenceHeartbeat(uid: string | null): void {
  useEffect(() => {
    if (!uid) return;

    const myPresenceRef = ref(rtdb, `presence/${uid}`);
    const connectedRef = ref(rtdb, ".info/connected");

    const unsubscribe = onValue(connectedRef, (snapshot) => {
      if (snapshot.val() !== true) return;
      onDisconnect(myPresenceRef)
        .remove()
        .then(() => set(myPresenceRef, true))
        .catch((err) => console.error("Failed to register presence", err));
    });

    return () => {
      unsubscribe();
      remove(myPresenceRef).catch((err) => console.error("Failed to clear presence on unmount", err));
    };
  }, [uid]);
}

/** Count of participants currently present. */
export function useOnlineCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const unsubscribe = onValue(
      ref(rtdb, "presence"),
      (snapshot) => {
        setCount(snapshot.exists() ? Object.keys(snapshot.val() as Record<string, true>).length : 0);
      },
      (err: Error) => {
        console.error("Failed to load presence", err);
      }
    );
    return unsubscribe;
  }, []);

  return count;
}
