import { Frame, FrameBody } from "@/components/ui/frame";
import { MobileWelcomeBanner } from "./MobileWelcomeBanner";
import { ParticipantStatusList } from "../ParticipantStatusList";
import { RecentPostsPreview } from "../../forum/RecentPostsPreview";
import type { Player } from "../../profile/usePlayers";
import type { PostWithId } from "../../forum/postTypes";

/**
 * Home — logged in, on a phone. Three frames down the page:
 * welcome, who's in, what people are saying.
 *
 * Dropped from the desktop version's four-cell bento: **Chat**, which is now
 * the shell's right-hand drawer and reachable from every screen rather than
 * only this one, and the hero carousel, which appears in no mobile wireframe
 * cell at all.
 *
 * The parent gives the participant list a header here so you can switch lobby
 * scope and make a lobby from it. irishtable has no lobbies, so the header
 * would carry a single static word — it is dropped, and the list runs straight
 * to the frame edge.
 */
export function MobileHomeLoggedIn({
  me,
  players,
  submitterUids,
  posts,
  likesByPost,
  onToggleLike,
  onDeletePost,
  onSaveEdit,
  onRefetchPosts,
  onSelectParticipant,
}: {
  me: Player;
  players: Player[];
  submitterUids: Set<string>;
  posts: PostWithId[];
  likesByPost: Map<string, Set<string>>;
  onToggleLike: (postId: string) => void;
  onDeletePost: (postId: string) => void;
  onSaveEdit: (postId: string, text: string) => void;
  onRefetchPosts: () => void;
  onSelectParticipant: (uid: string) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 py-3">
      <MobileWelcomeBanner me={me} showCta={!submitterUids.has(me.uid)} />

      <Frame className="flex min-h-0 flex-1 flex-col animate-cotton-rise">
        <FrameBody className="min-h-0 flex-1">
          <ParticipantStatusList
            players={players}
            submitterUids={submitterUids}
            onSelectPlayer={onSelectParticipant}
          />
        </FrameBody>
      </Frame>

      <Frame className="flex min-h-0 flex-1 flex-col animate-cotton-rise">
        <FrameBody className="min-h-0 flex-1">
          <RecentPostsPreview
            posts={posts}
            players={players}
            uid={me.uid}
            likesByPost={likesByPost}
            onToggleLike={onToggleLike}
            onSelectParticipant={onSelectParticipant}
            onDeletePost={onDeletePost}
            onSaveEdit={onSaveEdit}
            onRefetch={onRefetchPosts}
          />
        </FrameBody>
      </Frame>
    </div>
  );
}
