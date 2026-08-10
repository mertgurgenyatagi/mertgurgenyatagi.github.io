// src/forum/ReplyRow.tsx
import { memo, useMemo, useState, type KeyboardEvent } from "react";
import { Heart, Quote, Pencil, Trash2 } from "lucide-react";
import { PostWithId } from "./postTypes";
import { Player } from "../profile/usePlayers";
import { splitMentionSegments } from "../chat/chatMentions";
import { useTimeAgo } from "./forumTime";
import { PostAuthorLink } from "./PostAuthorLink";
import { ForumImageThumb } from "./ForumImageThumb";
import { firstNameOnly } from "../profile/deletedAccount";
import { cn } from "@/lib/utils";

interface ReplyRowProps {
  reply: PostWithId;
  players: Player[];
  /** Same players, pre-indexed by uid — see ThreadCard's identical prop. */
  playersByUid: Map<string, Player>;
  /** The full, currently-loaded post list — used only to check whether
   *  `reply.quotedPostId` still exists, to decide the accent-vs-gray quote
   *  treatment (forum-round-02 Q9). */
  posts: PostWithId[];
  uid: string | null;
  liked: boolean;
  likeCount: number;
  onToggleLike: (postId: string) => void;
  onSelectParticipant: (uid: string) => void;
  /** True for one brief moment right after a quote-click jumps here
   *  (forum-round-03 Q4: "highlights it for a brief second, fading out"). */
  highlighted?: boolean;
  rowRef?: (el: HTMLLIElement | null) => void;
  /** Omitting any of these three drops that affordance entirely — the grid
   *  feed's compact 3-reply preview passes none of them (read-only except
   *  liking, same convention RecentPostsPreview already set); the full
   *  thread popup passes all three. */
  onQuote?: (reply: PostWithId) => void;
  onSaveEdit?: (replyId: string, text: string) => void;
  onDelete?: (replyId: string) => void;
  onJumpToQuote?: (postId: string) => void;
  /** Condensed single-line rendering for ThreadCard's fixed-height 3-reply
   *  preview, which must never scroll — merges name/timestamp/like onto one
   *  row, clamps text to a single line, and drops the quote-preview block
   *  (still visible in full once the thread popup opens). */
  compact?: boolean;
}

function ReplyRowImpl({
  reply,
  players,
  playersByUid,
  posts,
  uid,
  liked,
  likeCount,
  onToggleLike,
  onSelectParticipant,
  highlighted,
  rowRef,
  onQuote,
  onSaveEdit,
  onDelete,
  onJumpToQuote,
  compact,
}: ReplyRowProps) {
  const author = playersByUid.get(reply.uid);
  const isOwn = uid !== null && uid === reply.uid;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(reply.text);
  const [hoverPreview, setHoverPreview] = useState<{ x: number; y: number } | null>(null);
  const repliedAgo = useTimeAgo(reply.createdAt);

  const quoteTargetExists = useMemo(
    () => (reply.quotedPostId ? posts.some((p) => p.id === reply.quotedPostId) : false),
    [reply.quotedPostId, posts]
  );
  const quoteAuthor = reply.quotedAuthorUid ? playersByUid.get(reply.quotedAuthorUid) : undefined;
  const quoteClickable = Boolean(onJumpToQuote && quoteTargetExists);

  if (compact) {
    return (
      <li
        ref={rowRef}
        className={cn(
          "flex flex-col gap-1 rounded-lg bg-color_secondary/60 px-2.5 py-1.5 transition-colors duration-700 ease-[var(--ease-cotton)]",
          highlighted && "bg-color_accent/[0.16]"
        )}
      >
        <div className="flex items-center gap-2">
          <PostAuthorLink
            author={author}
            uid={reply.uid}
            onSelect={onSelectParticipant}
            className="min-w-0 flex-1 gap-1.5"
            avatarClassName="size-5"
            fallbackClassName="text-[0.5rem]"
            nameClassName="text-[0.76rem]"
          />
          <button
            type="button"
            onClick={() => uid && onToggleLike(reply.id)}
            disabled={!uid}
            aria-pressed={liked}
            aria-label={!uid ? "Sign in to like" : liked ? "Unlike" : "Like"}
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-full px-1 py-0.5 outline-none transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-color_accent",
              !uid
                ? "cursor-default text-color_textsecondary"
                : liked
                  ? "cursor-pointer text-color_accent"
                  : "cursor-pointer text-color_textsecondary hover:text-color_accent"
            )}
          >
            <Heart className="size-2.5" fill={liked ? "currentColor" : "none"} strokeWidth={2} aria-hidden />
            <span className="font-mono text-[0.6rem] tnum">{likeCount}</span>
          </button>
        </div>
        <div className="flex items-center gap-1.5 pl-6">
          {reply.imageURL && (
            <ForumImageThumb src={reply.imageURL} className="block size-5 shrink-0 cursor-pointer overflow-hidden rounded border border-color_border1/50" />
          )}
          <p className="line-clamp-1 min-w-0 flex-1 text-[0.78rem] break-words text-color_textsecondary">{reply.text}</p>
        </div>
      </li>
    );
  }

  function handleSave() {
    if (!onSaveEdit) return;
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSaveEdit(reply.id, trimmed);
    setEditing(false);
  }

  function handleEditKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      setDraft(reply.text);
      setEditing(false);
    }
  }

  return (
    <li
      ref={rowRef}
      className={cn(
        "flex flex-col gap-1.5 rounded-lg bg-color_secondary/60 px-3 py-2.5 transition-colors duration-700 ease-[var(--ease-cotton)]",
        highlighted && "bg-color_accent/[0.16]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <PostAuthorLink
          author={author}
          uid={reply.uid}
          onSelect={onSelectParticipant}
          className="gap-2"
          avatarClassName="size-6"
          fallbackClassName="text-[0.55rem]"
          nameClassName="text-[0.82rem]"
        />
        <span className="shrink-0 font-mono text-[0.6rem] text-color_textsecondary tnum">
          {repliedAgo}
          {reply.editedAt && " · edited"}
        </span>
      </div>

      {reply.quotedPostId && (
        <div
          className="relative"
          onMouseEnter={(e) => {
            if (!onJumpToQuote) return;
            const rect = e.currentTarget.getBoundingClientRect();
            setHoverPreview({ x: rect.left, y: rect.bottom + 4 });
          }}
          onMouseLeave={() => setHoverPreview(null)}
        >
          <button
            type="button"
            disabled={!quoteClickable}
            onClick={() => reply.quotedPostId && onJumpToQuote?.(reply.quotedPostId)}
            className={cn(
              "flex w-full items-start rounded-md border-l-2 py-1 pl-2 text-left text-[0.76rem] leading-snug",
              quoteClickable
                ? "cursor-pointer border-color_accent/50 text-color_text/80 hover:bg-color_accent/[0.08]"
                : "cursor-default border-color_border1 text-color_textsecondary italic"
            )}
          >
            <span className="min-w-0 truncate">
              <span className={cn("font-medium", quoteTargetExists ? "text-color_accent" : "text-color_textsecondary")}>
                {firstNameOnly(quoteAuthor)}:
              </span>{" "}
              &ldquo;{reply.quotedText}&rdquo;
            </span>
          </button>
          {hoverPreview && onJumpToQuote && (
            <div
              className="fixed z-50 max-w-64 rounded-lg border border-color_border1 bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-frame"
              style={{ left: hoverPreview.x, top: hoverPreview.y }}
            >
              {quoteTargetExists ? (
                <>
                  <span className="font-medium text-color_accent">{firstNameOnly(quoteAuthor)}:</span> {reply.quotedText}
                </>
              ) : (
                "This post was deleted."
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex items-start gap-2.5">
        {/* Never shown while editing — editing only ever touches the text,
            never the attached image (forum-round-03 spec). */}
        {reply.imageURL && !editing && (
          <ForumImageThumb
            src={reply.imageURL}
            className="block size-12 shrink-0 cursor-pointer overflow-hidden rounded-md border border-color_border1/50"
          />
        )}
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex flex-col gap-1.5">
              <textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleEditKeyDown}
                rows={2}
                className="w-full resize-none rounded-md border border-color_border1/70 bg-background px-2 py-1.5 text-sm text-color_text outline-none focus:border-color_accent"
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSave}
                  className="cursor-pointer font-mono text-[0.66rem] tracking-wide text-color_accent uppercase hover:underline"
                >
                  Kaydet
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(reply.text);
                    setEditing(false);
                  }}
                  className="cursor-pointer font-mono text-[0.66rem] tracking-wide text-color_textsecondary uppercase hover:underline"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm break-words whitespace-pre-wrap text-color_textsecondary">
              {splitMentionSegments(reply.text, players).map((segment, i) =>
                segment.isMention ? (
                  <span key={i} className="font-semibold text-color_accent">
                    {segment.text}
                  </span>
                ) : (
                  <span key={i}>{segment.text}</span>
                )
              )}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => uid && onToggleLike(reply.id)}
          disabled={!uid}
          aria-pressed={liked}
          aria-label={!uid ? "Sign in to like" : liked ? "Unlike" : "Like"}
          className={cn(
            "-ml-1 flex items-center gap-1 rounded-full px-1 py-0.5 outline-none transition-colors duration-150 ease-[var(--ease-cotton)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-color_accent",
            !uid
              ? "cursor-default text-color_textsecondary"
              : liked
                ? "cursor-pointer text-color_accent"
                : "cursor-pointer text-color_textsecondary hover:text-color_accent"
          )}
        >
          <Heart className="size-3" fill={liked ? "currentColor" : "none"} strokeWidth={2} aria-hidden />
          <span className="font-mono text-[0.64rem] tnum">{likeCount}</span>
        </button>
        {onQuote && (
          <button
            type="button"
            onClick={() => onQuote(reply)}
            aria-label="Quote"
            className="flex cursor-pointer items-center gap-1 rounded-full px-1 py-0.5 text-color_textsecondary outline-none transition-colors duration-150 hover:text-color_accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-color_accent"
          >
            <Quote className="size-3" aria-hidden />
          </button>
        )}
        {isOwn && onSaveEdit && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Edit"
            className="flex cursor-pointer items-center gap-1 rounded-full px-1 py-0.5 text-color_textsecondary outline-none transition-colors duration-150 hover:text-color_text focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-color_accent"
          >
            <Pencil className="size-3" aria-hidden />
          </button>
        )}
        {isOwn && onDelete && (
          <button
            type="button"
            onClick={() => onDelete(reply.id)}
            aria-label="Delete"
            className="flex cursor-pointer items-center gap-1 rounded-full px-1 py-0.5 text-color_textsecondary outline-none transition-colors duration-150 hover:text-color_remove focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-color_accent"
          >
            <Trash2 className="size-3" aria-hidden />
          </button>
        )}
      </div>
    </li>
  );
}

// Rendered up to 3× per thread card across a 50-card grid, plus every reply
// in an open thread popup — same memo rationale as ThreadCard.
export const ReplyRow = memo(ReplyRowImpl);
