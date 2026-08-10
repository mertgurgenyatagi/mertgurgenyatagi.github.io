import { memo, useMemo } from "react";
import { XIcon } from "lucide-react";
import { TEAM_BY_ID, TEAMS, teamCrestSrc } from "../predictions/teams";
import { LeaderboardEntry } from "./leaderboardTypes";
import { Player } from "../profile/usePlayers";
import { buildPlayersByUid } from "../profile/playersByUid";
import { fullName, initials as sharedInitials } from "../profile/deletedAccount";
import { TeamResult } from "./teamResultTypes";
import { getTeamPredictors } from "./teamPredictors";
import { TeamCrest } from "./TeamCrest";
import { TeamPopupTuning, DEFAULT_TEAM_POPUP_TUNING } from "./teamPopupTuning";
import { useImagePreload } from "@/lib/useImagePreload";
import { PLAYERS, MANAGERS, SEASON_START_YEAR, type Position } from "@/data/people";
import { DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { useIsMobile } from "@/lib/useIsMobile";
import { Frame, FrameBody } from "@/components/ui/frame";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TEAM_CREST_URLS = TEAMS.map((t) => teamCrestSrc(t.id));

const NOT_VIEWABLE_MESSAGE = "Not viewable until the season starts.";

function NotViewablePlaceholder() {
  return (
    <p className="flex h-full items-center justify-center px-4 text-center font-display text-sm text-color_textsecondary italic">
      {NOT_VIEWABLE_MESSAGE}
    </p>
  );
}

const WIDGET_BLOCK =
  "flex min-h-0 flex-col rounded-xl bg-background border border-color_border1/60";

const POSITION_LABEL: Record<Position, string> = {
  GK: "GOALKEEPERS",
  DF: "DEFENDERS",
  MF: "MIDFIELDERS",
  FW: "FORWARDS",
};

interface TeamPopupProps {
  /** The clicked club's id, or null when closed. */
  teamId: string | null;
  entries: LeaderboardEntry[];
  players: Player[];
  results: Record<string, TeamResult>;
  onOpenChange: (open: boolean) => void;
  /** Selecting a predictor closes this popup and opens theirs — the two
   *  dossiers cross-link. */
  onSelectParticipant: (uid: string) => void;
  /**
   * Before the season starts there is no table position, no points, and
   * predictions are still secret because the deadline has not passed. Every
   * widget that would show one renders a plain "not viewable yet" placeholder,
   * exactly as the parent does pre-season.
   */
  tournamentStarted: boolean;
  tuning?: Partial<TeamPopupTuning>;
}

/**
 * The club dossier.
 *
 * Cloned from kupatakipucl's, with two substantive changes, both flagged
 * because neither is cosmetic:
 *
 * 1. **The pitch diagram is gone.** The parent draws a likely XI in a
 *    formation, and both the formation and the XI are invented by a seeded
 *    PRNG — its own source calls it "dummy squad data". irishtable has real
 *    squads but no formation and no team-sheet source, so drawing one would be
 *    fabricating a fact on a page shown to a prospective partner.
 *
 * 2. **The three fabricated stat lists — top scorers, top assisters, top rated —
 *    are replaced by the club's real squad**, grouped by position, straight from
 *    `src/data/people.ts`. Same widget blocks, same treatment, same place in the
 *    grid. Nothing has been played yet, so there are no scorers to rank; the
 *    squad is the true thing that fits that space. (`people.ts` is drafted and
 *    carries its own review banner — that is the one file to correct, and
 *    fixing it fixes this popup and all eight award pickers at once.)
 */
export const TeamPopup = memo(function TeamPopup({
  teamId,
  entries,
  players,
  results,
  onOpenChange,
  onSelectParticipant,
  tournamentStarted,
  tuning,
}: TeamPopupProps) {
  const isMobile = useIsMobile();
  const t = { ...DEFAULT_TEAM_POPUP_TUNING, ...tuning };

  const team = teamId ? TEAM_BY_ID[teamId] : undefined;
  const result = teamId ? results[teamId] : undefined;

  const manager = useMemo(
    () => (teamId ? MANAGERS.find((m) => m.clubId === teamId) : undefined),
    [teamId]
  );

  const squadByPosition = useMemo(() => {
    if (!teamId) return [] as { position: Position; members: typeof PLAYERS }[];
    const order: Position[] = ["GK", "DF", "MF", "FW"];
    return order
      .map((position) => ({
        position,
        members: PLAYERS.filter((p) => p.clubId === teamId && p.position === position),
      }))
      .filter((group) => group.members.length > 0);
  }, [teamId]);

  const playersByUid = useMemo(() => buildPlayersByUid(players), [players]);

  const predictors = useMemo(
    () => (tournamentStarted && teamId ? getTeamPredictors(teamId, entries, results) : []),
    [tournamentStarted, teamId, entries, results]
  );

  const avgPredicted = useMemo(() => {
    if (!tournamentStarted || !teamId || entries.length === 0) return null;
    const positions = entries
      .map((e) => e.ranking.indexOf(teamId))
      .filter((i) => i !== -1)
      .map((i) => i + 1);
    if (positions.length === 0) return null;
    return (positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(1);
  }, [tournamentStarted, teamId, entries]);

  const popupImageUrls = useMemo(
    () => (team ? TEAM_CREST_URLS : []),
    [team]
  );
  const popupImagesReady = useImagePreload(popupImageUrls);

  return (
    <ResponsiveDialog
      open={teamId !== null}
      onOpenChange={onOpenChange}
      showCloseButton={false}
      desktopClassName="w-full max-w-[calc(100%-2rem)] gap-0 rounded-none bg-transparent p-0 ring-0 sm:max-w-4xl"
      mobileClassName="h-[88dvh] bg-transparent p-0"
    >
      {team && !popupImagesReady && (
        <Frame
          className="h-full w-full animate-cotton-rise border-color_border1/35 lg:h-[min(92vh,60rem)]"
          aria-hidden
          data-testid="team-popup-skeleton"
        >
          <div className="flex h-full flex-col gap-3 p-4">
            <Skeleton className="h-16 w-full shrink-0 rounded-xl" />
            <Skeleton className="min-h-0 flex-1 rounded-xl" />
          </div>
        </Frame>
      )}

      {team && popupImagesReady && (
        <Frame className="h-full w-full animate-cotton-rise border-color_border1/35 lg:h-[min(92vh,60rem)]">
          {/* Profile band — the club's own crest, blurred and scaled into an
              abstract darkened backdrop. Crest + name + manager left, big
              rank/points right. */}
          <div className="relative shrink-0 overflow-hidden px-4 py-3 sm:px-5 sm:py-4">
            <img
              src={teamCrestSrc(team.id)}
              alt=""
              aria-hidden
              className="absolute inset-0 -z-20 size-full scale-[3] object-cover blur-2xl brightness-50"
            />
            <div className="absolute inset-0 -z-10 bg-background/60" />

            <DialogClose
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-2 right-2 text-color_textsecondary hover:bg-color_hover/10 hover:text-color_text"
                />
              }
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </DialogClose>

            <div className="flex items-center" style={{ gap: `${t.headerGap}rem` }}>
              <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                <TeamCrest
                  teamId={team.id}
                  style={{ width: `${t.crestSize}rem`, height: `${t.crestSize}rem` }}
                />
                <div className="min-w-0">
                  <DialogTitle className="truncate font-display text-lg font-semibold tracking-[-0.01em] text-color_text sm:text-xl">
                    {team.name}
                  </DialogTitle>
                  <DialogDescription className="sr-only">
                    {team.name}: manager, squad, and who predicted this club where.
                  </DialogDescription>
                  {manager && (
                    <div className="mt-0.5 flex items-center gap-2">
                      <p className="truncate font-display text-sm text-color_textsecondary">
                        {manager.name}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-5 sm:gap-6">
                {tournamentStarted && avgPredicted !== null && (
                  <div className="flex flex-col items-end leading-none">
                    <span className="font-mono text-[0.65rem] tracking-wider text-color_textsecondary uppercase">
                      Avg. pick
                    </span>
                    <span
                      className="mt-1 font-display font-bold text-color_gold"
                      style={{ fontSize: `${t.rankPtsSize * 0.85}rem` }}
                    >
                      {avgPredicted}
                    </span>
                  </div>
                )}
                <div className="flex flex-col items-end leading-none">
                  <span className="font-mono text-[0.65rem] tracking-wider text-color_textsecondary uppercase">
                    Position
                  </span>
                  <span
                    aria-label={`Position ${tournamentStarted && result ? result.position : "unknown"}`}
                    className="mt-1 font-display font-bold text-color_text tnum"
                    style={{ fontSize: `${t.rankPtsSize}rem` }}
                  >
                    {tournamentStarted && result ? `#${result.position}` : "#-"}
                  </span>
                </div>
                <div className="flex flex-col items-end leading-none">
                  <span className="font-mono text-[0.65rem] tracking-wider text-color_textsecondary uppercase">
                    Points
                  </span>
                  <span
                    aria-label={`Points ${tournamentStarted ? (result?.points ?? "-") : "-"}`}
                    className="mt-1 font-display font-bold text-color_text tnum"
                    style={{ fontSize: `${t.rankPtsSize}rem` }}
                  >
                    {tournamentStarted ? (result?.points ?? "-") : "-"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <FrameBody className="no-scrollbar min-h-0 gap-3 overflow-y-auto p-3 sm:p-4">
            {/* Mobile keeps only the columns with content a phone screen
                earns: the squad, and who predicted this club. */}
            <div
              className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)]"
              style={{
                gridTemplateColumns: isMobile
                  ? "minmax(0,1fr)"
                  : `${t.col1 + t.col2}fr ${t.col3}fr`,
                gap: `${t.gridGap}rem`,
              }}
            >
              <div className={cn(WIDGET_BLOCK, "min-h-0")}>
                <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-2">
                  {squadByPosition.length === 0 ? (
                    <p className="flex h-full items-center justify-center px-4 text-center font-display text-sm text-color_textsecondary italic">
                      No squad listed for this club yet.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {squadByPosition.map((group) => (
                        <div key={group.position}>
                          <p className="mb-1 border-b border-color_border1/60 pb-1 font-mono text-[0.55rem] tracking-[0.16em] text-color_textsecondary uppercase">
                            {POSITION_LABEL[group.position]}
                          </p>
                          <ul className="flex flex-col">
                            {group.members.map((member) => (
                              <li
                                key={member.id}
                                className="flex items-baseline justify-between gap-2 py-0.5"
                              >
                                <span className="min-w-0 truncate font-display text-xs text-color_text">
                                  {member.name}
                                </span>
                                <span className="shrink-0 font-mono text-[0.6rem] text-color_textsecondary tnum">
                                  {SEASON_START_YEAR - member.bornYear}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex min-h-0 flex-col gap-3">
                <div
                  className={cn(WIDGET_BLOCK, "min-h-0 flex-1")}
                  title="Where each participant predicted this club to finish"
                >
                  <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-2 py-2">
                    {!tournamentStarted ? (
                      <NotViewablePlaceholder />
                    ) : predictors.length === 0 ? (
                      <p className="px-2 py-2 font-display text-sm text-color_textsecondary italic">
                        Nobody has predicted this club.
                      </p>
                    ) : (
                      predictors.map((p) => {
                        const player = playersByUid.get(p.entry.uid);
                        return (
                          <button
                            key={p.entry.uid}
                            type="button"
                            onClick={() => onSelectParticipant(p.entry.uid)}
                            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-left transition-colors duration-150 ease-[var(--ease-cotton)] hover:bg-color_hoverfill"
                          >
                            <Avatar className="size-5 shrink-0">
                              <AvatarImage src={player?.photoURL || undefined} alt="" />
                              <AvatarFallback className="font-mono text-[0.5rem] text-color_text">
                                {sharedInitials(player)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="min-w-0 flex-1 truncate font-display text-xs text-color_text">
                              {fullName(player)}
                            </span>
                            <span
                              className={cn(
                                "shrink-0 font-mono text-[0.65rem] tnum",
                                p.correct ? "font-bold text-color_green" : "text-color_textsecondary"
                              )}
                            >
                              {p.predictedPosition}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </FrameBody>
        </Frame>
      )}
    </ResponsiveDialog>
  );
});
