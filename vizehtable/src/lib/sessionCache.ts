// Two layers, used by the one-shot data hooks (usePlayers, useLeaderboard,
// useResults, usePosts, usePostLikes, useProfile) so navigating back to a
// page shows the last-known data immediately instead of flashing back to a
// loading/skeleton state while it refetches in the background:
//
// 1. An in-memory Map — cleared on a full page reload, shared across every
//    mount within the same already-loaded session.
// 2. localStorage with a short TTL — survives a reload or a fresh tab, so a
//    genuinely repeat visit within a few minutes also skips a real refetch
//    (scaling-audit No. 15, 2026-07-31). Read/write failures (private
//    browsing, quota, no localStorage) are swallowed — the cache just
//    behaves as memory-only in that case, never throws.
const PREFIX = "vizehtable-cache:";
const TTL_MS = 5 * 60 * 1000;

interface StoredEntry<T> {
  value: T;
  storedAt: number;
}

const memory = new Map<string, unknown>();

function readPersisted<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return undefined;
    const entry = JSON.parse(raw) as StoredEntry<T>;
    if (Date.now() - entry.storedAt > TTL_MS) {
      localStorage.removeItem(PREFIX + key);
      return undefined;
    }
    return entry.value;
  } catch {
    return undefined;
  }
}

function writePersisted<T>(key: string, value: T): void {
  try {
    const entry: StoredEntry<T> = { value, storedAt: Date.now() };
    localStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // private browsing / quota exceeded / no localStorage — memory layer still works
  }
}

export function getCached<T>(key: string): T | undefined {
  if (memory.has(key)) return memory.get(key) as T;
  const persisted = readPersisted<T>(key);
  if (persisted !== undefined) memory.set(key, persisted);
  return persisted;
}

export function setCached<T>(key: string, value: T): void {
  memory.set(key, value);
  writePersisted(key, value);
}

export function deleteCached(key: string): void {
  memory.delete(key);
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

// Test-only: the cache is a module-level singleton by design (that's what
// makes it survive a page navigation), which means it also survives between
// `it()` blocks in the same test file unless cleared — call this from a
// beforeEach in any test that exercises a cached hook. Wipes both layers.
export function clearSessionCache(): void {
  memory.clear();
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) localStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
}

// Test-only: drops just the in-memory layer, to exercise the localStorage
// fallback path as if this were a fresh tab/reload.
export function clearInMemoryCacheForTest(): void {
  memory.clear();
}
