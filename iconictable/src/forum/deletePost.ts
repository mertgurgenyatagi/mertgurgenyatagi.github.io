// src/forum/deletePost.ts
import { doc, writeBatch } from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "../firebase";

/**
 * Real, hard delete — no placeholder (that's a Chat-specific choice, not a
 * forum one; forum-round-01 Q5). Deleting a root post takes every one of its
 * replies with it; `replyIds` is computed by the caller from the already-
 * loaded post list (usePosts() fetches the whole collection, no pagination
 * to re-query against). Deleting a reply on its own — since nesting is flat
 * — never has anything to cascade, so callers just pass an empty array.
 *
 * `imageURLs` (not-started-audit item 08): every imageURL belonging to the
 * post(s) being deleted — the root's own plus each cascaded reply's, `null`
 * entries included and ignored. Without this, a deleted post's image stayed
 * in Storage forever, orphaned. Storage cleanup happens after the Firestore
 * batch succeeds and is best-effort per file (one missing/already-gone
 * object shouldn't block the rest) — the Firestore delete is the operation
 * that actually matters; a stray orphaned file if cleanup fails isn't worth
 * rolling anything back over.
 */
export async function deletePost(
  postId: string,
  replyIds: string[],
  imageURLs: (string | null)[] = []
): Promise<void> {
  const batch = writeBatch(db);
  replyIds.forEach((id) => batch.delete(doc(db, "forumPosts", id)));
  batch.delete(doc(db, "forumPosts", postId));
  await batch.commit();

  await Promise.all(
    imageURLs
      .filter((url): url is string => url !== null)
      .map((url) =>
        deleteObject(ref(storage, url)).catch((err) =>
          console.error("Failed to delete forum image from storage", err)
        )
      )
  );
}
