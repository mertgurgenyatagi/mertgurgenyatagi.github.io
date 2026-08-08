// src/forum/ThreadPopup.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Trash2, XIcon } from "lucide-react";
import { PostWithId } from "./postTypes";
import { QuoteRef } from "./createPost";
import { Player } from "../profile/usePlayers";
import { ReplyRow } from "./ReplyRow";
import { PostForm } from "./PostForm";
import { ForumImageThumb } from "./ForumImageThumb";
import { useTimeAgo } from "./forumTime";
import { PostAuthorLink } from "./PostAuthorLink";
import { buildPlayersByUid } from "../profile/playersByUid";
import { splitMentionSegments } from "../chat/chatMentions";
import { fullName } from "../profile/deletedAccount";
import { DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Frame, FrameBody } from "@/components/ui/frame";
import { Button } from "@/components/ui/button";

// How long the flash lingers before it starts fading (forum-round-03 Q4:
// "highlights it for a brief second, fading out") — the fade itself is the
// bg-color transition already on ReplyRow's own root element.
const HIGHLIGHT_MS = 1200;

interface ThreadPopupProps {
  /** The expanded thread's root post id, or null when closed. */
  rootId: string | null;
  posts: PostWithId[];
  players: Player[];
  uid: string | null;
  likesByPost: Map<string, Set<string>>;
  onToggleLike: (postId: string) => void;
  onOpenChange: (open: boolean) => void;
  onSelectParticipant: (uid: string) => void;
  onDelete: (postId: string) => void;
  onSaveEdit: (postId: string, text: string) => void;
  onPosted: () => void;
}

export function ThreadPopup({
  rootId,
  posts,
  players,
  uid,
  likesByPost,
  onToggleLike,
  onOpenChange,
  onSelectParticipant,
  onDelete,
  onSaveEdit,
  onPosted,
}: ThreadPopupProps) {
  // Same "keep showing the last real content while the exit animation
  // plays" trick as ParticipantPopup/TeamPopup.
  const [lastRootId, setLastRootId] = useState<string | null>(null);
  useEffect(() => {
    if (rootId) setLastRootId(rootId);
  }, [rootId]);
  const displayedId = rootId ?? lastRootId;

  const root = displayedId ? posts.find((p) => p.id === displayedId) : undefined;
  const replies = useMemo(
    () =>
      displayedId
        ? posts.filter((p) => p.parentId === displayedId).sort((a, b) => a.createdAt - b.createdAt)
        : [],
    [displayedId, posts]
  );

  const [quote, setQuote] = useState<QuoteRef | null>(null);
  const [editingRoot, setEditingRoot] = useState(false);
  const [rootDraft, setRootDraft] = useState("");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const highlightTimeoutRef = useRef<number | null>(null);

  // Switching to a different thread, or closing this one, clears any
  // in-progress reply/edit state rather than carrying it into whatever
  // opens next.
  useEffect(() => {
    setQuote(null);
    setEditingRoot(false);
  }, [displayedId]);
  useEffect(() => {
    if (rootId === null) {
      setQuote(null);
      setEditingRoot(false);
    }
  }, [rootId]);

  const playersByUid = useMemo(() => buildPlayersByUid(players), [players]);
  const author = root ? playersByUid.get(root.uid) : undefined;
  const isOwnRoot = Boolean(root && uid !== null && uid === root.uid);
  const postedAgo = useTimeAgo(root?.createdAt ?? NaN);

  function handleQuote(reply: PostWithId) {
    setQuote({ postId: reply.id, authorUid: reply.uid, text: reply.text.slice(0, 140) });
  }

  function handleJumpToQuote(postId: string) {
    const el = rowRefs.current.get(postId);
    if (!el) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    if (highlightTimeoutRef.current) window.clearTimeout(highlightTimeoutRef.current);
    setHighlightedId(postId);
    highlightTimeoutRef.current = window.setTimeout(() => setHighlightedId(null), HIGHLIGHT_MS);
  }

  function handleSaveRootEdit() {
    if (!root) return;
    const trimmed = rootDraft.trim();
    if (!trimmed) return;
    onSaveEdit(root.id, trimmed);
    setEditingRoot(false);
  }

  return (
    <ResponsiveDialog
      open={rootId !== null}
      onOpenChange={onOpenChange}
      showCloseButton={false}
      desktopClassName="w-full max-w-[calc(100%-2rem)] gap-0 rounded-none bg-transparent p-0 ring-0 sm:max-w-2xl"
      mobileClassName="max-h-[88dvh] bg-transparent p-0"
    >
        {root && (
          <Frame className="flex max-h-[min(88vh,52rem)] w-full min-h-0 flex-col animate-cotton-rise border-color_border1/35 lg:max-h-[min(88vh,52rem)]">
            <div className="relative flex shrink-0 items-start justify-between gap-3 border-b border-color_border1/60 px-4 py-3 sm:px-5">
              <PostAuthorLink
                author={author}
                uid={root.uid}
                onSelect={onSelectParticipant}
                nameSlot={
                  // Rendered as a span, not its default h2 — it now sits
                  // inside the name button, which may only contain phrasing
                  // content. Still the dialog's accessible title.
                  <DialogTitle
                    render={<span />}
                    className="block truncate font-display text-sm font-medium text-color_text"
                  >
                    {fullName(author)}
                  </DialogTitle>
                }
                meta={
                  <>
                    <DialogDescription className="sr-only">
                      {fullName(author)} started this thread. All replies below.
                    </DialogDescription>
                    <span className="block font-mono text-[0.62rem] text-color_textsecondary tnum">
                      {postedAgo}
                      {root.editedAt && " · edited"}
                    </span>
                  </>
                }
              />

              <div className="flex shrink-0 items-center gap-1">
                {isOwnRoot && !editingRoot && (
                  <button
                    type="button"
                    onClick={() => {
                      setRootDraft(root.text);
                      setEditingRoot(true);
                    }}
                    aria-label="Edit"
                    className="cursor-pointer rounded-full p-1.5 text-color_textsecondary outline-none transition-colors hover:text-color_text focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-color_accent"
                  >
                    <Pencil className="size-3.5" aria-hidden />
                  </button>
                )}
                {isOwnRoot && (
                  <button
                    type="button"
                    onClick={() => onDelete(root.id)}
                    aria-label="Delete thread"
                    className="cursor-pointer rounded-full p-1.5 text-color_textsecondary outline-none transition-colors hover:text-color_remove focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-color_accent"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                )}
                <DialogClose render={<Button variant="ghost" size="icon-sm" className="text-color_textsecondary" />}>
                  <XIcon />
                  <span className="sr-only">Close</span>
                </DialogClose>
              </div>
            </div>

            <FrameBody className="min-h-0 flex-1 gap-0 overflow-hidden p-0">
              <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
                <div className="flex items-start gap-3">
                  {/* Never shown while editing — editing only ever touches
                      the text, never the attached image. */}
                  {root.imageURL && !editingRoot && (
                    <ForumImageThumb
                      src={root.imageURL}
                      className="block size-20 shrink-0 cursor-pointer overflow-hidden rounded-md border border-color_border1/50"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    {editingRoot ? (
                      <div className="flex flex-col gap-1.5">
                        <textarea
                          autoFocus
                          value={rootDraft}
                          onChange={(e) => setRootDraft(e.target.value)}
                          rows={3}
                          className="w-full resize-none rounded-md border border-color_border1/70 bg-background px-2.5 py-2 text-sm text-color_text outline-none focus:border-color_accent"
                        />
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={handleSaveRootEdit}
                            className="cursor-pointer font-mono text-[0.66rem] tracking-wide text-color_accent uppercase hover:underline"
                          >
                            Kaydet
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingRoot(false)}
                            className="cursor-pointer font-mono text-[0.66rem] tracking-wide text-color_textsecondary uppercase hover:underline"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm break-words whitespace-pre-wrap text-color_textsecondary">
                        {splitMentionSegments(root.text, players).map((segment, i) =>
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

                <ul className="mt-4 flex flex-col gap-1.5 border-t border-color_border1/40 pt-3">
                  {replies.length === 0 ? (
                    <p className="py-2 font-display text-sm text-color_textsecondary italic">No replies yet.</p>
                  ) : (
                    replies.map((reply) => {
                      const likedBy = likesByPost.get(reply.id);
                      return (
                        <ReplyRow
                          key={reply.id}
                          reply={reply}
                          players={players}
                          playersByUid={playersByUid}
                          posts={posts}
                          uid={uid}
                          liked={uid ? (likedBy?.has(uid) ?? false) : false}
                          likeCount={likedBy?.size ?? 0}
                          onToggleLike={onToggleLike}
                          onSelectParticipant={onSelectParticipant}
                          highlighted={highlightedId === reply.id}
                          rowRef={(el) => {
                            if (el) rowRefs.current.set(reply.id, el);
                            else rowRefs.current.delete(reply.id);
                          }}
                          onQuote={uid ? handleQuote : undefined}
                          onSaveEdit={onSaveEdit}
                          onDelete={onDelete}
                          onJumpToQuote={handleJumpToQuote}
                        />
                      );
                    })
                  )}
                </ul>
              </div>

              {uid && (
                <div className="shrink-0 border-t border-color_border1/60 px-4 py-3 sm:px-5">
                  <PostForm
                    key={root.id}
                    uid={uid}
                    parentId={root.id}
                    players={players}
                    onPosted={onPosted}
                    quote={quote}
                    onClearQuote={() => setQuote(null)}
                    placeholder="Write a reply…"
                  />
                </div>
              )}
            </FrameBody>
          </Frame>
        )}
    </ResponsiveDialog>
  );
}
