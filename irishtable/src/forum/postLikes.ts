import { arrayRemove, arrayUnion, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { PostWithId } from "./postTypes";

export type LikesByPost = Map<string, Set<string>>;

/**
 * Likes used to be their own collection (`postLikes/{postId}_{uid}`),
 * fetched in full on every forum page load and again on every single
 * like/unlike — the whole history of every like ever given, just to render
 * some heart icons (scaling-audit No. 10, 2026-07-31). Likes now live
 * directly on each post's own `likedByUids` array, so this is a pure
 * derivation from data the app already has loaded — no separate fetch, and
 * genuinely live for every viewer (not just the one who clicked), since it
 * rides on whatever's already keeping `posts` live.
 */
export function buildLikesByPost(posts: PostWithId[]): LikesByPost {
  const map: LikesByPost = new Map();
  posts.forEach((post) => {
    map.set(post.id, new Set(post.likedByUids));
  });
  return map;
}

/** Toggles `uid`'s own like on `postId`. A transform op (arrayUnion/Remove),
 *  not a read-then-write, so concurrent likers never clobber each other. */
export async function setPostLiked(postId: string, uid: string, liked: boolean): Promise<void> {
  await updateDoc(doc(db, "forumPosts", postId), {
    likedByUids: liked ? arrayUnion(uid) : arrayRemove(uid),
  });
}
