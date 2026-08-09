import { useEffect, useState } from "react";
import { onDisconnect, onValue, ref, remove, set } from "firebase/database";
import { rtdb } from "../firebase";

// Moved off Firestore alongside presence (scaling-audit No. 02/16,
// 2026-07-31) — same reasoning: a live collection-wide listener plus
// frequent per-uid writes fanned out as reads to every other watcher.
//
// Anything older than this is treated as stale by the reader — chosen well
// above the composer's own re-send interval (chatMentions/ChatComposer send
// at most once every 2s while actively typing) so a live typist never
// flickers, but short enough that walking away mid-sentence self-clears
// without needing an explicit "stopped" write.
const STALE_MS = 6000;
const RECHECK_MS = 1500;

// Defensive floor (scaling-audit No. 12): even if some future bug called
// setTypingStatus far more often than the composer intends, writes for the
// same uid never actually go out faster than this — a client-side backstop
// on top of database.rules.json's own server-side rate floor, so a runaway
// caller can't generate real cost before either catches it.
const MIN_WRITE_INTERVAL_MS = 1000;
const lastWriteAt = new Map<string, number>();

/** Doc id is the uid, so there's at most one typing signal per person. */
export async function setTypingStatus(uid: string, isTyping: boolean): Promise<void> {
  const typingRef = ref(rtdb, `typingStatus/${uid}`);

  if (!isTyping) {
    lastWriteAt.delete(uid);
    await remove(typingRef);
    return;
  }

  const now = Date.now();
  const last = lastWriteAt.get(uid) ?? 0;
  if (now - last < MIN_WRITE_INTERVAL_MS) return;
  lastWriteAt.set(uid, now);

  await set(typingRef, { updatedAt: now });
  onDisconnect(typingRef)
    .remove()
    .catch((err) => console.error("Failed to register typing-status cleanup", err));
}

/** Uids currently typing, excluding `excludeUid` and anything stale. */
export function useTypingUsers(excludeUid: string): string[] {
  const [docs, setDocs] = useState<{ id: string; updatedAt: number }[]>([]);
  const [, forceTick] = useState(0);

  useEffect(() => {
    const unsubscribe = onValue(
      ref(rtdb, "typingStatus"),
      (snapshot) => {
        const value = (snapshot.val() as Record<string, { updatedAt: number }>) ?? {};
        setDocs(Object.entries(value).map(([id, data]) => ({ id, updatedAt: data.updatedAt })));
      },
      (err: Error) => {
        console.error("Failed to load typing status", err);
      }
    );
    return unsubscribe;
  }, []);

  // Re-render periodically so a typist who never explicitly clears (closed
  // the tab, walked away) still ages out of the list on its own.
  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), RECHECK_MS);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  return docs.filter((d) => d.id !== excludeUid && now - d.updatedAt < STALE_MS).map((d) => d.id);
}
