import { memo, useMemo } from "react";
import { XIcon } from "lucide-react";
import { RankedEntry } from "./ranking";
import { LeaderboardEntry } from "./leaderboardTypes";
import { Player } from "../profile/usePlayers";
import { buildPlayersByUid } from "../profile/playersByUid";
import { fullName, initials } from "../profile/deletedAccount";
import { TeamResult } from "./teamResultTypes";
import { qualificationBand } from "./qualification";
import { isPickCorrect } from "./scoring";
import { useSurveyResponse } from "../predictions/useSurveyResponse";
import { TEAM_BY_ID, TEAMS, teamCrestSrc } from "../predictions/teams";
import { ballKnowledgeLabel, deviceLabel } from "../predictions/surveyTypes";
import { clubName } from "@/data/clubs";
import { countryName } from "@/data/countries";
import { TeamCrest } from "./TeamCrest";
import { useImagePreload } from "@/lib/useImagePreload";
import { DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { useIsMobile } from "@/lib/useIsMobile";
import { Frame, FrameBody } from "@/components/ui/frame";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Every call site's page has already preloaded the crest set and every
// avatar, so this almost always resolves instantly — the gate exists for
// correctness rather than because it is expected to visibly stall.
const TEAM_CREST_URLS = TEAMS.map((t) => teamCrestSrc(t.id));

interface ParticipantPopupProps {
  /** The clicked participant + their standing rank, or null when closed. */
  ranked: RankedEntry | null;
  entries: LeaderboardEntry[];
  /** Resolves each uid to a name and avatar. */
  players: Player[];
  results: Record<string, TeamResult>;
  onOpenChange: (open: boolean) => void;
  /** Selecting a club from the predictions grid closes this popup and opens
   *  that club's own dossier — the cross-link the row click was built for. */
  onSelectTeam: (teamId: string) => void;
  /**
   * Before the season starts, nobody's predicted table is meaningful yet —
   * and, more importantly, predictions are not locked until the deadline, so
   * showing one participant's table to another would let it be copied. That
   * gate is the parent's and it is kept.
   *
   * irishtable is permanently pre-season by design, so in practice this is
   * always false and the predictions grid always shows its placeholder.
   */
  tournamentStarted: boolean;
  /** Quiz answers are signed-in only, matching firestore.rules' own
   *  `surveyResponses` gate. When false the read is skipped entirely rather
   *  than attempted and surfaced as a permission error. */
  viewerLoggedIn?: boolean;
}

const NOT_VIEWABLE_MESSAGE = "Not viewable until the season starts.";

function NotViewablePlaceholder() {
  return (
    <p className="flex h-full items-center justify-center px-4 text-center font-display text-sm text-color_textsecondary italic">
      {NOT_VIEWABLE_MESSAGE}
    </p>
  );
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

// No title bar on any widget block (the non-busyness rule) — the
// colour-distinct background and border alone mark the boundary.
const WIDGET_BLOCK =
  "flex min-h-0 flex-col rounded-xl bg-background border border-color_border1/60";

const PRED_HEADER_CELL = "flex h-4 items-center border-b border-color_border1/60";
const PRED_GRID_COLUMNS = "auto minmax(4rem,1fr) repeat(5, 1.6rem)";
const PRED_STAT_COLUMNS: { key: keyof TeamResult; label: string; help: string }[] = [
  { key: "matchesPlayed", label: "P", help: "Played" },
  { key: "goalsFor", label: "F", help: "Goals for" },
  { key: "goalsAgainst", label: "A", help: "Goals against" },
  { key: "goalDifference", label: "GD", help: "Goal difference" },
  { key: "points", label: "PTS", help: "Points" },
];

function ensurePeriod(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/**
 * The participant dossier.
 *
 * Cloned from kupatakipucl's classic compact view. Two of the parent's
 * sections are gone rather than ported, because neither has any data path in
 * irishtable — not a stalled one, none at all:
 *
 * - **The knockout expanded view.** irishtable has no knockout stage, no
 *   bracket component and no knockout prediction model.
 * - **The rank-history sparkline.** The parent replays it from its dev-only
 *   `devMatches` collection; real results have no equivalent mechanism even
 *   there, and irishtable has neither.
 *
 * **One deliberate divergence from the parent, flagged:** the parent gates the
 * quiz-answers widget on `tournamentStarted` along with everything else, which
 * in a permanently pre-season app would mean this popup showed a name and two
 * empty boxes for its entire life. Quiz answers leak nothing — they are not
 * predictions, and the deadline has no bearing on them — so they render for
 * any signed-in viewer. The predictions grid stays gated, because that one
 * genuinely is secret until the deadline passes.
 */
export const ParticipantPopup = memo(function ParticipantPopup({
  ranked,
  entries: _entries,
  players,
  results,
  onOpenChange,
  onSelectTeam,
  tournamentStarted,
  viewerLoggedIn = true,
}: ParticipantPopupProps) {
  const isMobile = useIsMobile();
  const displayed = ranked;
  const displayedUid = displayed?.entry.uid ?? null;

  const playersByUid = useMemo(() => buildPlayersByUid(players), [players]);
  const displayedPlayer = displayedUid ? playersByUid.get(displayedUid) : undefined;

  const {
    data: survey,
    loading: surveyLoading,
    error: surveyError,
  } = useSurveyResponse(viewerLoggedIn ? displayedUid : null);

  const popupImageUrls = useMemo(
    () => (displayed ? [displayed.entry.photoURL, ...TEAM_CREST_URLS] : []),
    [displayed]
  );
  const popupImagesReady = useImagePreload(popupImageUrls);

  const quizRows = useMemo(() => {
    if (!survey) return [];
    return [
      { question: "How old are you?", answer: String(survey.age) },
      { question: "Where are you watching from?", answer: countryName(survey.country) },
      { question: "Who do you support?", answer: supportLabel(survey.clubSupported) },
      {
        question: "Rate your football knowledge",
        answer: `${ballKnowledgeLabel(survey.ballKnowledge)} (${survey.ballKnowledge} / 7)`,
      },
      { question: "What are you mostly on?", answer: deviceLabel(survey.device) },
    ];
  }, [survey]);

  return (
    <ResponsiveDialog
      open={ranked !== null}
      onOpenChange={onOpenChange}
      showCloseButton={false}
      desktopClassName="w-full gap-0 rounded-none bg-transparent p-0 ring-0 max-w-[calc(100%-2rem)] sm:max-w-2xl"
      mobileClassName="h-[88dvh] bg-transparent p-0"
    >
      {displayed && !popupImagesReady && (
        <Frame
          className={cn(
            "w-full animate-cotton-rise border-color_border1/35",
            isMobile ? "h-full" : "h-[min(85vh,44rem)]"
          )}
          aria-hidden
          data-testid="participant-popup-skeleton"
        >
          <div className="flex h-full flex-col gap-3 p-4">
            <Skeleton className="h-16 w-full shrink-0 rounded-xl" />
            <Skeleton className="min-h-0 flex-1 rounded-xl" />
          </div>
        </Frame>
      )}

      {displayed && popupImagesReady && (
        <Frame className="w-full animate-cotton-rise border-color_border1/35 max-h-[min(85vh,44rem)]">
          {/* Profile band — the participant's own photo, blurred and scaled
              up into an abstract darkened colour field. Picture + name on one
              line, rank and points smaller beneath. */}
          <div className="relative shrink-0 overflow-hidden border-b border-color_border1/30 px-4 py-3 sm:px-5 sm:py-4">
            {displayed.entry.photoURL && (
              <img
                src={displayed.entry.photoURL}
                alt=""
                aria-hidden
                className="absolute inset-0 -z-20 size-full scale-[5] object-cover blur-2xl brightness-50"
              />
            )}
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

            <div className="flex items-center gap-3 sm:gap-4">
              <Avatar className="size-12 shrink-0 sm:size-14">
                <AvatarImage src={displayed.entry.photoURL || undefined} alt="" />
                <AvatarFallback className="bg-color_accent/20 font-mono text-sm text-color_text">
                  {initials(displayedPlayer)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate font-display text-lg font-semibold tracking-[-0.01em] text-color_text sm:text-xl">
                  {fullName(displayedPlayer)}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  {fullName(displayedPlayer)}: rank, points, predicted table and quiz answers.
                </DialogDescription>

                <div className="mt-1 flex items-baseline gap-4">
                  <span className="flex items-baseline gap-1.5">
                    <span className="font-mono text-[0.55rem] tracking-[0.18em] text-color_textsecondary uppercase">
                      Rank
                    </span>
                    <span className="font-display text-sm leading-none font-bold text-color_accent tnum">
                      {tournamentStarted ? displayed.rank : "—"}
                    </span>
                  </span>
                  <span className="flex items-baseline gap-1.5">
                    <span className="font-mono text-[0.55rem] tracking-[0.18em] text-color_textsecondary uppercase">
                      Points
                    </span>
                    <span className="font-display text-sm leading-none font-bold text-color_text tnum">
                      {tournamentStarted ? displayed.entry.points : "—"}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <FrameBody className="min-h-0 gap-3 p-3 sm:p-4">
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:h-56 lg:flex-none lg:grid-cols-2 lg:sm:h-64">
              {/* Their predicted table */}
              <div className={WIDGET_BLOCK}>
                <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-2">
                  {!tournamentStarted ? (
                    <NotViewablePlaceholder />
                  ) : (
                    <div
                      role="table"
                      className="grid text-xs"
                      style={{ gridTemplateColumns: PRED_GRID_COLUMNS }}
                    >
                      <div role="rowgroup" className="contents">
                        <div role="row" className="contents">
                          <div role="columnheader" className={cn(PRED_HEADER_CELL, "pl-1")} />
                          <div
                            role="columnheader"
                            className={cn(
                              PRED_HEADER_CELL,
                              "pl-1 font-mono text-[0.55rem] tracking-[0.12em] text-color_textsecondary uppercase"
                            )}
                          >
                            Club
                          </div>
                          {PRED_STAT_COLUMNS.map((col) => (
                            <div
                              key={col.key}
                              role="columnheader"
                              title={col.help}
                              className={cn(
                                PRED_HEADER_CELL,
                                "justify-end pr-1 font-mono text-[0.55rem] tracking-[0.12em] text-color_textsecondary uppercase"
                              )}
                            >
                              {col.label}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div role="rowgroup" className="contents">
                        {displayed.entry.ranking.map((teamId, index) => {
                          const predictedPosition = index + 1;
                          const team = TEAM_BY_ID[teamId];
                          const result = results[teamId];
                          const band = qualificationBand(predictedPosition);
                          const correct = result
                            ? isPickCorrect(predictedPosition, result.position)
                            : false;
                          const cell = cn(
                            "flex items-center border-b border-color_border1/30 py-1 transition-colors duration-150 ease-[var(--ease-cotton)] group-hover:bg-color_hoverfill",
                            correct && "bg-color_green/[0.12]"
                          );
                          const statCell = cn(cell, "justify-end pr-1");
                          return (
                            <div
                              key={teamId}
                              role="row"
                              onClick={() => onSelectTeam(teamId)}
                              className="group contents cursor-pointer"
                            >
                              <div role="cell" className={cn(cell, "gap-1 pl-1")}>
                                {band === "champion" && (
                                  <span className="h-2.5 w-1 shrink-0 rounded-r-full bg-color_accent" />
                                )}
                                {band === "relegation" && (
                                  <span className="h-2.5 w-1 shrink-0 rounded-r-full bg-color_remove" />
                                )}
                                {band === "mid" && <span className="w-1 shrink-0" />}
                                <span className="font-mono text-[0.65rem] text-color_textsecondary tnum">
                                  {predictedPosition}
                                </span>
                              </div>
                              <div role="cell" className={cn(cell, "min-w-0 gap-1.5 pl-1")}>
                                <TeamCrest teamId={teamId} className="size-5 shrink-0" />
                                <span
                                  title={team?.name}
                                  className="min-w-0 truncate font-display text-xs font-medium text-color_text"
                                >
                                  {team?.shortName ?? teamId}
                                </span>
                              </div>
                              {PRED_STAT_COLUMNS.map((col) => (
                                <div key={col.key} role="cell" className={statCell}>
                                  <span
                                    className={cn(
                                      "font-mono text-[0.65rem] tnum",
                                      col.key === "points"
                                        ? "font-bold text-color_text"
                                        : "text-color_textsecondary"
                                    )}
                                  >
                                    {result
                                      ? col.key === "goalDifference"
                                        ? signed(result.goalDifference)
                                        : result[col.key]
                                      : "-"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Quiz answers — see the divergence note on this component. */}
              <div className={WIDGET_BLOCK}>
                <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-2">
                  {!viewerLoggedIn ? (
                    <p className="py-2 font-display text-sm text-color_textsecondary italic">
                      Sign in to see quiz answers.
                    </p>
                  ) : quizRows.length > 0 ? (
                    <div className="flex flex-col gap-4">
                      {quizRows.map((row) => (
                        <div key={row.question}>
                          <p className="font-display text-sm leading-snug font-semibold text-color_text">
                            {row.question}
                          </p>
                          <p className="mt-0.5 font-display text-sm leading-snug font-light text-color_gold italic">
                            {ensurePeriod(row.answer)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : surveyError ? (
                    <p className="py-2 font-display text-sm text-color_textsecondary italic">
                      Quiz answers can’t be shown right now.
                    </p>
                  ) : !surveyLoading ? (
                    <p className="py-2 font-display text-sm text-color_textsecondary italic">
                      This one hasn’t answered the quiz.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </FrameBody>
        </Frame>
      )}
    </ResponsiveDialog>
  );
});

/** The quiz's club question allows "another club" and "none", neither of
 *  which is a club id. */
function supportLabel(value: string): string {
  if (value === "other") return "A club outside the Premier League";
  if (value === "none") return "Nobody in particular";
  return clubName(value);
}
