import { PostWithId } from "./postTypes";

export interface ThreadStats {
  /** Every reply under this root post (replies are flat — forum-round-01
   *  Q3 replaced nesting with quoting — but this still walks one extra
   *  level down for safety since the underlying grouping is recursive). */
  replyCount: number;
  /** The root post's own createdAt, or its most recent reply's, whichever
   *  is later — a thread with a fresh reply reads as "recent" even if it
   *  was first posted days ago (forum-widget-round-01 Q1/Q6). Editing a
   *  post never touches this (forum-round-03 Q6). */
  lastActivityAt: number;
  /** The single most recently created reply in the thread, or null if it
   *  has none yet. */
  latestReply: PostWithId | null;
}

/** Keyed by each top-level (parentId === null) post's id. */
export function computeThreadStats(posts: PostWithId[]): Map<string, ThreadStats> {
  const childrenByParent = new Map<string, PostWithId[]>();
  posts.forEach((post) => {
    if (post.parentId === null) return;
    const siblings = childrenByParent.get(post.parentId) ?? [];
    siblings.push(post);
    childrenByParent.set(post.parentId, siblings);
  });

  function collect(postId: string): { count: number; latest: number; latestPost: PostWithId | null } {
    const children = childrenByParent.get(postId) ?? [];
    let count = 0;
    let latest = 0;
    let latestPost: PostWithId | null = null;
    for (const child of children) {
      count += 1;
      if (child.createdAt > latest) {
        latest = child.createdAt;
        latestPost = child;
      }
      const sub = collect(child.id);
      count += sub.count;
      if (sub.latest > latest) {
        latest = sub.latest;
        latestPost = sub.latestPost;
      }
    }
    return { count, latest, latestPost };
  }

  const stats = new Map<string, ThreadStats>();
  posts
    .filter((post) => post.parentId === null)
    .forEach((post) => {
      const { count, latest, latestPost } = collect(post.id);
      stats.set(post.id, {
        replyCount: count,
        lastActivityAt: Math.max(post.createdAt, latest),
        latestReply: latestPost,
      });
    });
  return stats;
}

/** "1 reply" / "3 replies". Turkish has no plural marker here, so the parent
 *  never needed this and a straight translation produced "1 replies". */
export function replyCountLabel(count: number): string {
  return `${count} ${count === 1 ? "reply" : "replies"}`;
}
