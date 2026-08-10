import { useEffect, useRef, useState } from "react";

// not-started-audit item 11: nothing server-side rate-limits chat/forum
// posting — Firestore rules only ever checked identity, never frequency.
// A real distributed rate limiter needs a server (Cloud Functions/App
// Check), which is real scope beyond "fix without overkill" for a
// ~50-person trust-the-friend-group site. This is the proportionate
// version: a short client-side cooldown after each successful send, which
// stops accidental double-sends and a buggy/looping client from hammering
// Firestore, without pretending to stop a deliberately malicious direct
// API call (nothing client-side ever could).
const COOLDOWN_MS = 1200;

/** `trigger()` starts the cooldown; `isCoolingDown` is true until it elapses. */
export function useSendCooldown(ms: number = COOLDOWN_MS) {
  const [isCoolingDown, setIsCoolingDown] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  function trigger() {
    setIsCoolingDown(true);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsCoolingDown(false), ms);
  }

  return { isCoolingDown, trigger };
}
