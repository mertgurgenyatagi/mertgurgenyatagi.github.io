import { useMemo, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { PostWithId } from "./postTypes";
import { Player } from "../profile/usePlayers";
import { buildPlayersByUid } from "../profile/playersByUid";
import { computeThreadStats, replyCountLabel } from "./threadStats";
import { useTimeAgo } from "./forumTime";
import { ForumImageThumb } from "./ForumImageThumb";
import { ThreadPopup } from "./ThreadPopup";
import { fullName, firstNameOnly, avatarSrc, initials } from "../profile/deletedAccount";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/** A one-line wrapper so the live-ticking `useTimeAgo` hook can be used from
 *  inside the row map, where calling a hook directly isn't allowed. */
function PostedAgo({ createdAt }: { createdAt: number }) {
  return <>{useTimeAgo(createdAt)}</>;
}

interface RecentPostsPreviewProps {
  posts: PostWithId[];
  players: Player[];
  uid: string | null;
  /** postId -> set of uids who liked it. */
  likesByPost: Map<string, Set<string>>;
  onToggleLike: (postId: string) => void;
  onSelectParticipant: (uid: string) => void;
  onDeletePost: (postId: string) => void;
  onSaveEdit: (postId: string, text: string) => void;
  onRefetch: () => void;
  /** Defaults to 3 (forum-widget-round-01 Q4) — enough to feel alive in a
   *  home-page cell without turning into the full thread view (that's what
   *  /forum is for). */
  limit?: number;
}

/**
 * "Recent forum posts" per PAGE_BRIEFING's Home brief — a condensed preview.
 * Every row is a single click target (whole-row, gray-on-hover) that opens
 * the exact same ThreadPopup /forum itself uses — the only carve-outs are
 * the like button and the reply-count pill, which both stay their own
 * target (the pill still leads to the same popup, just via its own click
 * rather than the row's, so it can get its own color_accent hover state). Threads
 * sort by last activity, not strictly by when they were first posted, so a
 * reply bumps its thread back to the top (round-01 Q1/Q6).
 */
export function RecentPostsPreview({
  posts,
  players,
  uid,
  likesByPost,
  onToggleLike,
  onSelectParticipant,
  onDeletePost,
  onSaveEdit,
  onRefetch,
  limit = 3,
}: RecentPostsPreviewProps) {
  const [expandedRootId, setExpandedRootId] = useState<string | null>(null);

  const playersByUid = useMemo(() => buildPlayersByUid(players), [players]);
  const stats = computeThreadStats(posts);
  const recent = posts
    .filter((post) => post.parentId === null)
    .sort((a, b) => (stats.get(b.id)?.lastActivityAt ?? b.createdAt) - (stats.get(a.id)?.lastActivityAt ?? a.createdAt))
    .slice(0, limit);

  if (recent.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-6">
        <p className="text-center font-display text-sm text-color_textsecondary italic">Nothing posted yet.</p>
      </div>
    );
  }

  function openPost(postId: string) {
    setExpandedRootId(postId);
  }

  function handleRowKeyDown(e: KeyboardEvent<HTMLDivElement>, postId: string) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openPost(postId);
    }
  }

  return (
    <>
      <ul className="no-scrollbar min-h-0 flex-1 divide-y divide-border/50 overflow-y-auto px-3 sm:px-4">
        {recent.map((post) => {
          const author = playersByUid.get(post.uid);
          const threadStats = stats.get(post.id) ?? { replyCount: 0, lastActivityAt: post.createdAt, latestReply: null };
          const likedBy = likesByPost.get(post.id);
          const liked = uid ? (likedBy?.has(uid) ?? false) : false;
          const likeCount = likedBy?.size ?? 0;
          const replyAuthor = threadStats.latestReply ? playersByUid.get(threadStats.latestReply.uid) : undefined;

          return (
            <li key={post.id}>
              <div
                role="button"
                tabIndex={0}
                aria-label={`${fullName(author)}: ${post.text || "open post"}`}
                onClick={() => openPost(post.id)}
                onKeyDown={(e) => handleRowKeyDown(e, post.id)}
                className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-4 outline-none transition-colors duration-150 ease-[var(--ease-cotton)] hover:bg-color_text/[0.06] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-color_accent"
              >
                {/* Avatar and name are each their own click target into the
                    participant popup, and each stops the row's own
                    open-the-thread handler from also firing. */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectParticipant(post.uid);
                  }}
                  aria-label={`${fullName(author)} profile`}
                  className="shrink-0 cursor-pointer rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-color_accent"
                >
                  <Avatar className="size-8 shrink-0">
                    <AvatarImage src={avatarSrc(author)} alt="" />
                    <AvatarFallback className="font-mono text-[0.6rem] text-color_textsecondary">
                      {initials(author)}
                    </AvatarFallback>
                  </Avatar>
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectParticipant(post.uid);
                      }}
                      className="min-w-0 cursor-pointer truncate text-left font-display text-sm font-medium text-color_text outline-none hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-color_accent"
                    >
                      {fullName(author)}
                    </button>
                    <span className="shrink-0 font-mono text-[0.62rem] text-color_textsecondary tnum">
                      <PostedAgo createdAt={post.createdAt} />
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-start gap-2.5">
                    {post.imageURL && <ForumImageThumb src={post.imageURL} />}
                    <p className="line-clamp-2 min-w-0 flex-1 text-sm text-color_textsecondary">{post.text}</p>
                  </div>
                  <div className="mt-2.5 flex items-center gap-3.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (uid) onToggleLike(post.id);
                      }}
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
                      {/* Always rendered, even at zero — a count that appears/disappears on
                          toggle changes the button's width and snaps the row (and everything
                          below it in this scroll list) sideways/downward. */}
                      <span className="font-mono text-[0.68rem] tnum">{likeCount}</span>
                    </button>
                    {/* No separate onClick — bubbles up to the row's own handler, same
                        destination, so it doesn't need to duplicate that logic. Its only
                        job here is the distinct color_accent hover cue. */}
                    <span className="cursor-pointer font-mono text-[0.68rem] text-color_textsecondary tnum transition-colors duration-150 hover:text-color_accent">
                      {replyCountLabel(threadStats.replyCount)}
                    </span>
                  </div>
                  {threadStats.latestReply && (
                    <p className="mt-2 line-clamp-1 pl-3 text-xs text-color_textsecondary">
                      ↳ <span className="font-medium text-color_text/80">{firstNameOnly(replyAuthor)}:</span>{" "}
                      {threadStats.latestReply.text}
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <ThreadPopup
        rootId={expandedRootId}
        posts={posts}
        players={players}
        uid={uid}
        likesByPost={likesByPost}
        onToggleLike={onToggleLike}
        onOpenChange={(open) => {
          if (!open) setExpandedRootId(null);
        }}
        onSelectParticipant={onSelectParticipant}
        onDelete={(postId) => {
          onDeletePost(postId);
          if (postId === expandedRootId) setExpandedRootId(null);
        }}
        onSaveEdit={onSaveEdit}
        onPosted={onRefetch}
      />
    </>
  );
}

export function ForumPreviewFooter() {
  return (
    <Link
      to="/forum"
      className="shrink-0 border-t border-color_border1/50 px-5 py-2.5 text-center font-mono text-[0.62rem] tracking-[0.14em] text-color_textsecondary uppercase no-underline outline-none transition-colors duration-150 ease-[var(--ease-cotton)] hover:text-color_accent focus-visible:text-color_accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-color_accent sm:px-6"
    >
      Open forum
    </Link>
  );
}
