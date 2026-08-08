import { useCallback, useEffect, useRef, useState } from "react";
import { collection, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { ForumPost, PostWithId } from "./postTypes";
import { getCached, setCached } from "../lib/sessionCache";
import { PAGE_SIZE, subscribeToRecentMessages, fetchOlderMessages } from "../chat/paginatedMessages";

const CACHE_KEY = "forumPosts";

/**
 * The live window is capped at the most recent PAGE_SIZE posts, same shape
 * as chat (paginatedMessages.ts) — no more re-downloading every post ever
 * made on every app open (scaling-audit No. 04, 2026-07-31).
 *
 * Unlike chat, a reply can be much newer than its root post (a thread bumps
 * to the top on a new reply, forum-round-01 Q2), so a reply arriving inside
 * the live window can reference a root that's fallen outside it. Rather
 * than render that reply as orphaned, `fetchMissingRoots` fetches just that
 * root by id (one cheap doc read, not a re-fetch of anything else) and
 * merges it in. `loadOlder` is the explicit "see further back" action, same
 * pattern as chat's own fetchOlderMessages.
 *
 * Accepted trade-off: Forum.tsx's search filters whatever's currently
 * loaded — unlike chat, which does a dedicated full-history fetch for
 * search — so a thread nobody's touched that hasn't been paged into view
 * won't surface in search until it has been. Fine at this friend-group's
 * scale, revisit only if that ever proves wrong in practice.
 */
async function fetchMissingRoots(known: Map<string, PostWithId>): Promise<PostWithId[]> {
  const missingIds = new Set<string>();
  known.forEach((post) => {
    if (post.parentId && !known.has(post.parentId)) missingIds.add(post.parentId);
  });
  if (missingIds.size === 0) return [];

  const fetched = await Promise.all(
    Array.from(missingIds).map(async (id) => {
      const snap = await getDoc(doc(db, "forumPosts", id));
      return snap.exists() ? ({ id: snap.id, ...(snap.data() as ForumPost) } as PostWithId) : null;
    })
  );
  return fetched.filter((p): p is PostWithId => p !== null);
}

export function usePosts() {
  const cached = getCached<PostWithId[]>(CACHE_KEY);
  const byId = useRef(new Map<string, PostWithId>((cached ?? []).map((p) => [p.id, p])));
  const [posts, setPosts] = useState<PostWithId[]>(cached ?? []);
  const [loading, setLoading] = useState(cached === undefined);
  // Starts null ("don't know yet"), not true. It used to start true, so on a
  // warm cache the feed painted with "Load older threads" already
  // visible for the split second before the first snapshot came back and set
  // it false — a flash of a button that was never actually applicable.
  const [hasMore, setHasMore] = useState<boolean | null>(null);
  const backfillToken = useRef(0);

  const commit = useCallback(() => {
    const next = Array.from(byId.current.values());
    setCached(CACHE_KEY, next);
    setPosts(next);
  }, []);

  const backfillRoots = useCallback(() => {
    const token = ++backfillToken.current;
    fetchMissingRoots(byId.current).then((roots) => {
      if (roots.length === 0 || token !== backfillToken.current) return;
      roots.forEach((root) => byId.current.set(root.id, root));
      commit();
    });
  }, [commit]);

  useEffect(() => {
    // Same fromCache guard as usePlayers.ts — a snapshot synthesized from
    // whatever this collection's docs already happen to be cached from an
    // unrelated read (fetchMissingRoots' own one-off getDoc calls, or a
    // prior listener elsewhere) shouldn't be trusted as "the page has
    // loaded" until the server confirms it (2026-08-03).
    let confirmed = false;
    return subscribeToRecentMessages<ForumPost>(
      collection(db, "forumPosts"),
      (docs, fromCache) => {
        if (!confirmed && fromCache) return;
        confirmed = true;
        docs.forEach((post) => byId.current.set(post.id, post));
        commit();
        setLoading(false);
        setHasMore(docs.length >= PAGE_SIZE);
        backfillRoots();
      },
      (err: Error) => {
        console.error("Failed to load forum posts", err);
        setLoading(false);
      }
    );
  }, [commit, backfillRoots]);

  const loadOlder = useCallback(async () => {
    if (hasMore !== true) return;
    const oldest = Array.from(byId.current.values()).reduce<number | null>(
      (min, p) => (min === null || p.createdAt < min ? p.createdAt : min),
      null
    );
    if (oldest === null) return;

    try {
      const docs = await fetchOlderMessages<ForumPost>(collection(db, "forumPosts"), oldest);
      if (docs.length < PAGE_SIZE) setHasMore(false);
      if (docs.length > 0) {
        docs.forEach((post) => byId.current.set(post.id, post));
        commit();
      }
      backfillRoots();
    } catch (err) {
      console.error("Failed to load older forum posts", err);
    }
  }, [commit, backfillRoots, hasMore]);

  const refetch = useCallback(() => {}, []);

  // Collapses the tri-state to the boolean consumers actually render on:
  // "not known yet" shows no button, same as "no more".
  return { posts, loading, refetch, loadOlder, hasMore: hasMore === true };
}
