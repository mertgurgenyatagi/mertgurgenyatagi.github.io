// src/forum/ThreadCard.tsx
import { memo, useMemo } from "react";
import { Heart, MessageCircle, Trash2 } from "lucide-react";
import { PostWithId } from "./postTypes";
import { replyCountLabel } from "./threadStats";
import { Player } from "../profile/usePlayers";
import { ReplyRow } from "./ReplyRow";
import { ForumImageThumb } from "./ForumImageThumb";
import { useTimeAgo } from "./forumTime";
import { PostAuthorLink } from "./PostAuthorLink";
import { splitMentionSegments } from "../chat/chatMentions";
import { cn } from "@/lib/utils";

const PREVIEW_REPLY_COUNT = 3;
const LONG_TEXT_THRESHOLD = 200;

interface ThreadCardProps {
  post: PostWithId;
  /** Every reply to this root, any order — the card slices its own
   *  most-recent-3 preview (forum-round-02 Q5: oldest of the three first). */
  replies: PostWithId[];
  players: Player[];
  /** Same players, pre-indexed by uid — built once by the parent instead of
   *  an O(n) `players.find` per card and per reply row. */
  playersByUid: Map<string, Player>;
  /** The full, currently-loaded post list — threaded through to ReplyRow
   *  for its quote-still-exists check. */
  posts: PostWithId[];
  uid: string | null;
  likesByPost: Map<string, Set<string>>;
  onToggleLike: (postId: string) => void;
  onSelectParticipant: (uid: string) => void;
  /** Triggered by "Read more" on a clamped post, the "+N earlier replies"
   *  banner, or the reply-count pill itself — three doors to the same full-
   *  thread popup (forum-round-03 Q2), never a whole-card click target. */
  onExpand: () => void;
  onDelete?: (postId: string) => void;
}

function ThreadCardImpl({
  post,
  replies,
  players,
  playersByUid,
  posts,
  uid,
  likesByPost,
  onToggleLike,
  onSelectParticipant,
  onExpand,
  onDelete,
}: ThreadCardProps) {
  const author = playersByUid.get(post.uid);
  const isOwn = uid !== null && uid === post.uid;
  const isLong = post.text.length > LONG_TEXT_THRESHOLD || post.text.split("\n").length > 3;
  const likedBy = likesByPost.get(post.id);
  const liked = uid ? (likedBy?.has(uid) ?? false) : false;
  const likeCount = likedBy?.size ?? 0;
  // The root post's own time, not the thread's last activity — a reply used
  // to rewrite this line, so a week-old post read "2m ago" under its
  // original author's name. Last activity still drives sort order upstream.
  const postedAgo = useTimeAgo(post.createdAt);

  const { preview, omittedCount, replyCount } = useMemo(() => {
    const sorted = replies.slice().sort((a, b) => a.createdAt - b.createdAt);
    const slice = sorted.slice(-PREVIEW_REPLY_COUNT);
    return { preview: slice, omittedCount: sorted.length - slice.length, replyCount: sorted.length };
  }, [replies]);

  return (
    <div className="flex h-[27rem] flex-col gap-3 overflow-hidden rounded-xl border border-color_border1/60 bg-background p-4">
      <div className="flex shrink-0 items-start justify-between gap-2">
        <PostAuthorLink
          author={author}
          uid={post.uid}
          onSelect={onSelectParticipant}
          meta={
            <span className="block font-mono text-[0.62rem] text-color_textsecondary tnum">
              {postedAgo}
              {post.editedAt && " · edited"}
            </span>
          }
        />
        {isOwn && onDelete && (
          <button
            type="button"
            onClick={() => onDelete(post.id)}
            aria-label="Delete thread"
            className="shrink-0 cursor-pointer rounded-full p-1 text-color_textsecondary outline-none transition-colors hover:text-color_remove focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-color_accent"
          >
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        )}
      </div>

      <div className="flex shrink-0 items-start gap-3">
        {post.imageURL && <ForumImageThumb src={post.imageURL} />}
        <div className="min-h-[3.75rem] min-w-0 flex-1">
          <p className={cn("text-sm break-words whitespace-pre-wrap text-color_textsecondary", "line-clamp-3")}>
            {splitMentionSegments(post.text, players).map((segment, i) =>
              segment.isMention ? (
                <span key={i} className="font-semibold text-color_accent">
                  {segment.text}
                </span>
              ) : (
                <span key={i}>{segment.text}</span>
              )
            )}
          </p>
          {isLong && (
            <button
              type="button"
              onClick={onExpand}
              className="mt-1 cursor-pointer font-mono text-[0.66rem] tracking-wide text-color_textsecondary uppercase hover:text-color_accent"
            >
              Read more
            </button>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3.5">
        <button
          type="button"
          onClick={() => uid && onToggleLike(post.id)}
          disabled={!uid}
          aria-pressed={liked}
          aria-label={!uid ? "Sign in to like" : liked ? "Unlike" : "Like"}
          className={cn(
            "-ml-1.5 flex items-center gap-1 rounded-full px-1.5 py-0.5 outline-none transition-colors duration-150 ease-[var(--ease-cotton)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-color_accent",
            !uid
              ? "cursor-default text-color_textsecondary"
              : liked
                ? "cursor-pointer text-color_accent"
                : "cursor-pointer text-color_textsecondary hover:text-color_accent"
          )}
        >
          <Heart className="size-3.5" fill={liked ? "currentColor" : "none"} strokeWidth={2} aria-hidden />
          <span className="font-mono text-[0.68rem] tnum">{likeCount}</span>
        </button>
        <button
          type="button"
          onClick={onExpand}
          className="flex cursor-pointer items-center gap-1 rounded-full px-1.5 py-0.5 text-color_textsecondary outline-none transition-colors hover:text-color_accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-color_accent"
        >
          <MessageCircle className="size-3.5" aria-hidden />
          <span className="font-mono text-[0.68rem] tnum">{replyCountLabel(replyCount)}</span>
        </button>
      </div>

      {/* Fixed-height card regardless of reply count (Mert's explicit call —
          a 0-reply and a 3-reply thread render the same overall frame). The
          preview always uses ReplyRow's compact layout, sized so its 3 rows
          fit here in full — never scrolls, never clips mid-row. */}
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden border-t border-color_border1/40 pt-2">
        {replyCount === 0 ? (
          <p className="flex flex-1 items-center justify-center text-center font-display text-xs text-color_textsecondary italic">
            No replies yet.
          </p>
        ) : (
          <>
            {omittedCount > 0 && (
              <button
                type="button"
                onClick={onExpand}
                className="shrink-0 cursor-pointer rounded-lg bg-color_secondary/40 px-3 py-1 text-left font-mono text-[0.62rem] tracking-wide text-color_textsecondary uppercase hover:text-color_accent"
              >
                + {omittedCount} earlier {omittedCount === 1 ? "reply" : "replies"} · see all
              </button>
            )}
            <ul className="flex min-h-0 flex-1 flex-col gap-1">
              {preview.map((reply) => {
                const rLikedBy = likesByPost.get(reply.id);
                return (
                  <ReplyRow
                    key={reply.id}
                    reply={reply}
                    players={players}
                    playersByUid={playersByUid}
                    posts={posts}
                    uid={uid}
                    liked={uid ? (rLikedBy?.has(uid) ?? false) : false}
                    likeCount={rLikedBy?.size ?? 0}
                    onToggleLike={onToggleLike}
                    onSelectParticipant={onSelectParticipant}
                    compact
                  />
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

// The /forum grid renders up to 50 of these at once and re-renders on every
// like toggle, search keystroke, and live snapshot. Memoized so a card only
// re-renders when something it actually shows changed — the parent now hands
// down stable, memoized `replies` arrays for this to be worth anything.
export const ThreadCard = memo(ThreadCardImpl);
