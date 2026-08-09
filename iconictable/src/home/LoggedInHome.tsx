import { useMemo, useState } from "react";
import { useImagePreload } from "@/lib/useImagePreload";
import { useAuth } from "../auth/AuthProvider";
import { useProfile } from "../profile/useProfile";
import { usePredictionSubmitters } from "../predictions/usePredictionSubmitters";
import { useMessages } from "../chat/useMessages";
import { usePresenceHeartbeat, useOnlineCount } from "../chat/usePresence";
import { useTypingUsers } from "../chat/useTypingStatus";
import { usePosts } from "../forum/usePosts";
import { buildLikesByPost, setPostLiked } from "../forum/postLikes";
import { deletePost } from "../forum/deletePost";
import { editPost } from "../forum/editPost";
import { resolveMentionedUids } from "../chat/chatMentions";
import { HomeLandingLoggedIn } from "./HomeLandingLoggedIn";
import { HomeBentoSkeleton } from "./HomeSkeletons";
import { useIsMobile } from "@/lib/useIsMobile";
import { useMobilePopups } from "../shell/MobilePopupHost";
import { MobileHomeLoggedIn } from "./mobile/MobileHomeLoggedIn";
import type { Player } from "../profile/usePlayers";

/**
 * Data-fetching wrapper around HomeLandingLoggedIn, kept as its own component
 * (rather than fetched straight in HomePage) specifically so `useMessages()` —
 * the one hook here gated on `request.auth != null` by firestore.rules, unlike
 * posts and profiles which are public reads — only ever mounts for a signed-in
 * visitor.
 *
 * The parent's lobby state is gone: no `useMyLobbies`, no lobby members, no
 * lobby messages, no create dialog, no management panel.
 */
export function LoggedInHome({ players }: { players: Player[] }) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { openParticipant } = useMobilePopups();
  const { data: profile, loading: profileLoading } = useProfile(user?.uid ?? null);
  const { submitterUids, loading: submittersLoading } = usePredictionSubmitters();
  const {
    messages,
    loading: messagesLoading,
    loadOlder,
    loadingOlder,
    hasMoreOlder,
  } = useMessages();
  const { posts, loading: postsLoading, refetch: refetchPosts } = usePosts();

  // Home's Forum cell is a bounded preview, not live — its post images are
  // part of this page's initial-load gate, same as every avatar on it.
  const postImageUrls = useMemo(
    () => posts.map((p) => p.imageURL).filter((u): u is string => Boolean(u)),
    [posts]
  );
  const postImagesReady = useImagePreload(postImageUrls);

  usePresenceHeartbeat(user?.uid ?? null);
  const onlineCount = useOnlineCount();
  const typingUids = useTypingUsers(user?.uid ?? "");

  const [likeError, setLikeError] = useState<string | null>(null);
  const [forumActionError, setForumActionError] = useState<string | null>(null);

  // Likes live on each post's own likedByUids array, so this is a pure
  // derivation from the already-live `posts` — no separate fetch, and no
  // manual optimistic overlay: Firestore's local-write cache reflects a toggle
  // immediately and rolls it back itself if the write ultimately fails.
  const likesByPost = useMemo(() => buildLikesByPost(posts), [posts]);

  async function handleToggleLike(postId: string) {
    if (!user) return;
    const uid = user.uid;
    const wasLiked = likesByPost.get(postId)?.has(uid) ?? false;
    setLikeError(null);
    try {
      await setPostLiked(postId, uid, !wasLiked);
    } catch (err) {
      console.error("Failed to toggle post like", err);
      setLikeError("Couldn’t save that like. Try again.");
    }
  }

  async function handleDeletePost(postId: string) {
    setForumActionError(null);
    const replies = posts.filter((p) => p.parentId === postId);
    const replyIds = replies.map((p) => p.id);
    const imageURLs = [
      posts.find((p) => p.id === postId)?.imageURL ?? null,
      ...replies.map((p) => p.imageURL),
    ];
    try {
      await deletePost(postId, replyIds, imageURLs);
      refetchPosts();
    } catch (err) {
      console.error("Failed to delete post", err);
      setForumActionError("Couldn’t delete that post. Try again.");
    }
  }

  async function handleSaveEdit(postId: string, text: string) {
    setForumActionError(null);
    try {
      await editPost(postId, text, resolveMentionedUids(text, players));
      refetchPosts();
    } catch (err) {
      console.error("Failed to edit post", err);
      setForumActionError("Couldn’t update that post. Try again.");
    }
  }

  if (
    !user ||
    profileLoading ||
    submittersLoading ||
    messagesLoading ||
    postsLoading ||
    !profile ||
    !postImagesReady
  ) {
    return <HomeBentoSkeleton />;
  }

  const me: Player = { ...profile, uid: user.uid };

  // Mobile forks here rather than in HomePage, so every listener and handler
  // above is written once and shared. Only the layout differs, and the mobile
  // layout needs a strict subset of these props — no chat, which lives in the
  // shell drawer.
  if (isMobile) {
    return (
      <MobileHomeLoggedIn
        me={me}
        players={players}
        submitterUids={submitterUids}
        posts={posts}
        likesByPost={likesByPost}
        onToggleLike={handleToggleLike}
        onDeletePost={handleDeletePost}
        onSaveEdit={handleSaveEdit}
        onRefetchPosts={refetchPosts}
        onSelectParticipant={openParticipant}
      />
    );
  }

  return (
    <HomeLandingLoggedIn
      me={me}
      players={players}
      submitterUids={submitterUids}
      messages={messages}
      onLoadOlderMessages={loadOlder}
      loadingOlderMessages={loadingOlder}
      hasMoreOlderMessages={hasMoreOlder}
      onlineCount={onlineCount}
      typingUids={typingUids}
      posts={posts}
      likesByPost={likesByPost}
      onToggleLike={handleToggleLike}
      likeError={likeError}
      onDeletePost={handleDeletePost}
      onSaveEdit={handleSaveEdit}
      onRefetchPosts={refetchPosts}
      forumActionError={forumActionError}
    />
  );
}
