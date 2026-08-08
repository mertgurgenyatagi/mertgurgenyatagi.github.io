import { useCallback, useEffect, useMemo, useState } from "react";
import { useImagePreload } from "@/lib/useImagePreload";
import { useAuth } from "../auth/AuthProvider";
import { ParticipantPopup } from "../leaderboard/ParticipantPopup";
import { usePosts } from "../forum/usePosts";
import { usePlayers } from "../profile/usePlayers";
import { buildLikesByPost, setPostLiked } from "../forum/postLikes";
import { deletePost } from "../forum/deletePost";
import { editPost } from "../forum/editPost";
import { resolveMentionedUids } from "../chat/chatMentions";
import { Forum } from "../forum/Forum";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/lib/useIsMobile";
import { useMobilePopups } from "../shell/MobilePopupHost";
import type { RankedEntry } from "../leaderboard/ranking";

function ForumSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6" aria-hidden data-testid="forum-skeleton">
      <Skeleton className="h-16 w-full shrink-0 rounded-xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-xl border border-color_border1/60 p-4">
            <div className="flex items-center gap-2.5">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <Skeleton className="h-4 w-24 rounded-sm" />
            </div>
            <Skeleton className="h-4 w-full rounded-sm" />
            <Skeleton className="h-4 w-2/3 rounded-sm" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ForumPage() {
  const { user } = useAuth();
  const { posts, loading: postsLoading, refetch, loadOlder, hasMore } = usePosts();
  const { players, loading: playersLoading } = usePlayers();

  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedParticipantUid, setSelectedParticipantUid] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const { openParticipant } = useMobilePopups();

  const likesByPost = useMemo(() => buildLikesByPost(posts), [posts]);

  // The parent looks the tapped author up in a ranked leaderboard. There is
  // no leaderboard here — nothing has been played — so the popup gets the
  // player's own record at a nominal rank, and its standings widgets show
  // their pre-season placeholders exactly as they do on Home.
  const selectedPlayer = players.find((p) => p.uid === selectedParticipantUid) ?? null;
  const selectedRanked: RankedEntry | null = selectedPlayer
    ? {
        entry: {
          uid: selectedPlayer.uid,
          displayName: selectedPlayer.displayName,
          photoURL: selectedPlayer.photoURL,
          points: 0,
          ranking: [],
        },
        rank: 1,
      }
    : null;

  // Gate the initial reveal on the first batch's images only — "load older"
  // is a pull, user-triggered action, not a live push (Forum isn't meant to
  // behave as a live feed), so it shouldn't re-hide content that's already
  // on screen. Once revealed once, this stops tracking new images and lets
  // ThreadCard/ForumImageThumb's own per-item skeleton handle anything
  // loaded afterward.
  const [everRevealed, setEverRevealed] = useState(false);
  const initialImageUrls = useMemo(() => {
    if (everRevealed) return [];
    return [
      ...players.map((p) => p.photoURL).filter(Boolean),
      ...posts.map((p) => p.imageURL).filter((u): u is string => Boolean(u)),
    ];
  }, [players, posts, everRevealed]);
  const initialImagesReady = useImagePreload(initialImageUrls);

  useEffect(() => {
    if (!postsLoading && !playersLoading && initialImagesReady) setEverRevealed(true);
  }, [postsLoading, playersLoading, initialImagesReady]);

  const handlePopupOpenChange = useCallback((open: boolean) => {
    if (!open) setSelectedParticipantUid(null);
  }, []);

  async function handleToggleLike(postId: string) {
    if (!user) return;
    const uid = user.uid;
    const wasLiked = likesByPost.get(postId)?.has(uid) ?? false;
    // No manual optimistic state here: `posts` is already a live listener,
    // so Firestore's own local-write cache reflects the toggled
    // likedByUids immediately (and rolls it back on its own if the write
    // ultimately fails) — the derived `likesByPost` just follows along.
    try {
      await setPostLiked(postId, uid, !wasLiked);
    } catch (err) {
      console.error("Failed to toggle post like", err);
    }
  }

  async function handleDeletePost(postId: string) {
    setActionError(null);
    const replies = posts.filter((p) => p.parentId === postId);
    const replyIds = replies.map((p) => p.id);
    const imageURLs = [posts.find((p) => p.id === postId)?.imageURL ?? null, ...replies.map((p) => p.imageURL)];
    try {
      await deletePost(postId, replyIds, imageURLs);
      refetch();
    } catch (err) {
      console.error("Failed to delete post", err);
      setActionError("Couldn’t delete that post. Try again.");
    }
  }

  async function handleSaveEdit(postId: string, text: string) {
    setActionError(null);
    try {
      await editPost(postId, text, resolveMentionedUids(text, players));
      refetch();
    } catch (err) {
      console.error("Failed to edit post", err);
      setActionError("Couldn’t update that post. Try again.");
    }
  }

  if (!everRevealed && (postsLoading || playersLoading || !initialImagesReady)) return <ForumSkeleton />;

  return (
    <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-6 lg:min-h-0 lg:flex-1">
      <Forum
        uid={user?.uid ?? null}
        posts={posts}
        players={players}
        likesByPost={likesByPost}
        onToggleLike={handleToggleLike}
        onSelectParticipant={isMobile ? openParticipant : setSelectedParticipantUid}
        onDeletePost={handleDeletePost}
        onSaveEdit={handleSaveEdit}
        onRefetch={refetch}
        onLoadOlder={loadOlder}
        hasMoreOlder={hasMore}
        actionError={actionError}
      />
      {/* Mobile routes participant taps to the shell's popup host instead,
          so this page doesn't open a second, competing dialog. */}
      {!isMobile && (
        <ParticipantPopup
          ranked={selectedRanked}
          entries={[]}
          players={players}
          results={{}}
          onOpenChange={handlePopupOpenChange}
          onSelectTeam={() => {}}
          tournamentStarted={false}
          viewerLoggedIn={Boolean(user)}
        />
      )}
    </div>
  );
}
