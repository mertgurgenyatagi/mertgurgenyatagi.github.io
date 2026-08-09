import { useSyncExternalStore } from "react";

/** Shared by every forum surface that shows a relative post time (the Home
 *  widget, the grid feed, the full-thread popup) — pulled out once actually
 *  duplicated across this rewrite rather than left copy-pasted a third time.
 *
 *  Defensive on both ends: a missing/garbage timestamp renders as an em-dash
 *  rather than "NaNm ago", and a timestamp slightly in the future (client
 *  clock skew — createdAt is written with the poster's own Date.now(), not a
 *  server timestamp, see createPost.ts) clamps to "just now" instead of
 *  rendering a negative count. */
export function timeAgo(createdAt: number): string {
  if (!Number.isFinite(createdAt)) return "—";
  const diffMs = Math.max(0, Date.now() - createdAt);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

// A relative timestamp rendered once at mount is wrong the moment the minute
// rolls over — a post read as "just now" stayed "just now" for as long as the
// tab was open, since nothing re-rendered it. One module-level interval feeds
// every subscriber instead of each row owning its own timer, and it only runs
// while at least one is mounted.
const TICK_MS = 30_000;
let tick = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  if (timer === null) {
    timer = setInterval(() => {
      tick += 1;
      listeners.forEach((l) => l());
    }, TICK_MS);
  }
  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

// Must be a quantized value, not Date.now() — useSyncExternalStore re-runs
// getSnapshot on every render and would loop forever on a always-changing one.
const getSnapshot = () => tick;

/** `timeAgo`, but re-rendering as the clock moves so the label stays true. */
export function useTimeAgo(createdAt: number): string {
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return timeAgo(createdAt);
}
