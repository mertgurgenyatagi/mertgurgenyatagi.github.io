import { useState } from "react";
import { Link } from "react-router-dom";
import { Frame, FrameHeader, FrameTitle, FrameBody } from "@/components/ui/frame";
import { ChatRoom } from "../chat/ChatRoom";
import { RecentPostsPreview, ForumPreviewFooter } from "../forum/RecentPostsPreview";
import { ParticipantStatusList } from "./ParticipantStatusList";
import { HomeHero } from "./HomeHero";
import { HomeWelcomeBanner } from "./HomeWelcomeBanner";
import { ParticipantPopup } from "../leaderboard/ParticipantPopup";
import { TeamPopup } from "../leaderboard/TeamPopup";
import type { RankedEntry } from "../leaderboard/ranking";
import type { Player } from "../profile/usePlayers";
import type { MessageWithId } from "../chat/useMessages";
import type { PostWithId } from "../forum/postTypes";

interface HomeLandingLoggedInProps {
  me: Player;
  players: Player[];
  submitterUids: Set<string>;
  messages: MessageWithId[];
  onLoadOlderMessages: () => void;
  loadingOlderMessages: boolean;
  hasMoreOlderMessages: boolean;
  onlineCount: number;
  typingUids: string[];
  posts: PostWithId[];
  likesByPost: Map<string, Set<string>>;
  onToggleLike: (postId: string) => void;
  likeError: string | null;
  onDeletePost: (postId: string) => void;
  onSaveEdit: (postId: string, text: string) => void;
  onRefetchPosts: () => void;
  forumActionError: string | null;
}

const PAGE_SHELL =
  "relative mx-auto flex w-full max-w-[1400px] min-w-0 flex-col gap-4 p-4 sm:p-6 lg:h-full lg:min-h-0 lg:flex-1 lg:gap-5 lg:p-6";

// The hero is pinned to a fixed 300px rather than an fr-share of the row;
// Forum and Chat give up the width it gains. Column ratios are the parent's,
// carried over exactly.
const CELL_ROW =
  "grid min-w-0 flex-1 gap-4 sm:gap-5 lg:h-full lg:min-h-0 lg:grid-cols-[13.409345fr_14.7953275fr_300px_14.7953275fr] [&>*]:min-h-0 [&>*]:min-w-0";
const CELL = "h-[26rem] lg:h-full animate-cotton-rise";

/**
 * Home, signed in and pre-season — the four-cell bento.
 *
 * Cloned from kupatakipucl. The band colour shows up as each cell's header,
 * not as a full-width strip under AppShell's own band: stacking two full-bleed
 * bars is the "corporate masthead" silhouette the parent rejected once already.
 *
 * **The lobby controls are gone**, per the scope decision that irishtable has
 * no Special Lobbies. The two cells that carried them — Players and Chat —
 * keep their exact geometry and banded headers; they simply have less in the
 * header. That is the one place this composition reads slightly emptier than
 * the parent's, and it is deliberate rather than unfinished.
 */
export function HomeLandingLoggedIn({
  me,
  players,
  submitterUids,
  messages,
  onLoadOlderMessages,
  loadingOlderMessages,
  hasMoreOlderMessages,
  onlineCount,
  typingUids,
  posts,
  likesByPost,
  onToggleLike,
  likeError,
  onDeletePost,
  onSaveEdit,
  onRefetchPosts,
  forumActionError,
}: HomeLandingLoggedInProps) {
  // Home's Players list is the only place this state can open the participant
  // popup from, and there is no leaderboard to look a rank or points up in —
  // everyone is tied pre-season anyway, which is exactly what is shown. The
  // popup's own widgets gate themselves on `tournamentStarted`.
  const [selectedPlayerUid, setSelectedPlayerUid] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const selectedPlayer = players.find((p) => p.uid === selectedPlayerUid) ?? null;
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

  return (
    <div className={PAGE_SHELL}>
      <HomeWelcomeBanner me={me} showCta={!submitterUids.has(me.uid)} />

      <div className={CELL_ROW}>
        <Frame className={CELL} style={{ animationDelay: "60ms" }}>
          <FrameHeader tone="navy">
            <FrameTitle className="text-base text-color_text sm:text-lg">Players</FrameTitle>
            <span className="font-mono text-[0.62rem] tracking-[0.1em] text-color_text/70 uppercase tnum">
              {players.length}
            </span>
          </FrameHeader>
          <FrameBody>
            <ParticipantStatusList
              players={players}
              submitterUids={submitterUids}
              onSelectPlayer={setSelectedPlayerUid}
            />
          </FrameBody>
        </Frame>

        <Frame className={CELL} style={{ animationDelay: "120ms" }}>
          <FrameHeader tone="navy">
            <FrameTitle className="text-base text-color_text sm:text-lg">
              <Link to="/forum" className="cursor-pointer no-underline hover:underline">
                Forum
              </Link>
            </FrameTitle>
          </FrameHeader>
          <FrameBody>
            <RecentPostsPreview
              posts={posts}
              players={players}
              uid={me.uid}
              likesByPost={likesByPost}
              onToggleLike={onToggleLike}
              onSelectParticipant={setSelectedPlayerUid}
              onDeletePost={onDeletePost}
              onSaveEdit={onSaveEdit}
              onRefetch={onRefetchPosts}
            />
            {(likeError || forumActionError) && (
              <p role="alert" className="shrink-0 px-5 pb-2 text-[0.72rem] text-color_remove sm:px-6">
                {likeError ?? forumActionError}
              </p>
            )}
            <ForumPreviewFooter />
          </FrameBody>
        </Frame>

        <HomeHero className={CELL} style={{ animationDelay: "180ms" }} />

        <Frame className={CELL} style={{ animationDelay: "240ms" }}>
          <FrameHeader tone="navy">
            <FrameTitle className="text-base text-color_text sm:text-lg">Chat</FrameTitle>
            <span className="flex items-center gap-1.5 font-mono text-[0.62rem] tracking-[0.1em] text-color_text/70 uppercase tnum">
              <span className="size-1.5 rounded-full bg-color_accent" aria-hidden />
              {onlineCount} online
            </span>
          </FrameHeader>
          <FrameBody>
            <ChatRoom
              uid={me.uid}
              players={players}
              messages={messages}
              onLoadOlder={onLoadOlderMessages}
              loadingOlder={loadingOlderMessages}
              hasMoreOlder={hasMoreOlderMessages}
              typingUids={typingUids}
              onSelectParticipant={setSelectedPlayerUid}
            />
          </FrameBody>
        </Frame>
      </div>

      <ParticipantPopup
        ranked={selectedRanked}
        entries={[]}
        players={players}
        results={{}}
        onOpenChange={(open) => {
          if (!open) setSelectedPlayerUid(null);
        }}
        onSelectTeam={(teamId) => {
          setSelectedPlayerUid(null);
          setSelectedTeamId(teamId);
        }}
        tournamentStarted={false}
      />

      <TeamPopup
        teamId={selectedTeamId}
        entries={[]}
        players={players}
        results={{}}
        onOpenChange={(open) => {
          if (!open) setSelectedTeamId(null);
        }}
        onSelectParticipant={(uid) => {
          setSelectedTeamId(null);
          setSelectedPlayerUid(uid);
        }}
        tournamentStarted={false}
      />
    </div>
  );
}
