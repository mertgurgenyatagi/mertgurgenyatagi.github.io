export interface ForumPost {
  uid: string;
  text: string;
  imageURL: string | null;
  parentId: string | null;
  createdAt: number;
  /** Set on every edit (text only — forum-round-03 Q5: images are permanent
   *  once posted). Drives the "edited" marker; never affects sort order
   *  (forum-round-03 Q6 — only a new reply bumps a thread). */
  editedAt: number | null;
  /** Every uid whose first name is @mentioned in `text`, same convention as
   *  chat (chatMentions.ts, reused as-is). */
  mentionedUids: string[];
  /** Set only on a reply composed via "quote" on another post in the same
   *  thread (forum-round-01 Q3 replaced Reddit-style nesting with quoting).
   *  `quotedPostId` is a live pointer — present in the thread's own post
   *  list only if that post still exists — used to decide the accent vs.
   *  gray treatment and whether the quote is clickable/jumpable. The author
   *  + text are cached at quote time so the quote still renders after the
   *  original is hard-deleted (forum posts have no tombstone). */
  quotedPostId: string | null;
  quotedAuthorUid: string | null;
  quotedText: string | null;
  /** Every uid who's liked this post — denormalized here (not a separate
   *  `postLikes` collection) so "N likes" and "did I like this" come for
   *  free with the post itself, live, instead of a whole extra fetch
   *  (scaling-audit No. 10, 2026-07-31). */
  likedByUids: string[];
}

export interface PostWithId extends ForumPost {
  id: string;
}

// not-started-audit item 10: same cap/warning-threshold pair as chat
// (chat/messageTypes.ts's MESSAGE_MAX_LENGTH/MESSAGE_LENGTH_WARNING_AT) —
// forum posts previously had no length limit at all, anywhere.
export const POST_MAX_LENGTH = 360;
export const POST_LENGTH_WARNING_AT = 300;
