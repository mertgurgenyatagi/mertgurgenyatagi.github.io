import { useMemo } from "react";
import { TEAMS } from "./teams";
import { TeamCrest } from "../leaderboard/TeamCrest";
import { useBoundaryHover } from "./useBoundaryHover";
import { boundaryBandRole } from "./predictionBoundary";
import { RELEGATION_POSITIONS } from "@/data/scoring";
import { cn } from "@/lib/utils";

interface RankingListProps {
  ranking: string[];
  /** Whether each club's prediction is currently landing correct — omitted
   *  wherever the caller has no live results to compare against yet, in
   *  which case no row glows. irishtable is permanently pre-season, so in
   *  practice nothing passes this today; it stays because the prop is what
   *  keeps the component honest about *why* nothing glows. */
  correctness?: Record<string, boolean>;
  /** The average position everyone (not just this list's owner) predicted
   *  for each club — omitted wherever the caller has no other participants'
   *  tables loaded yet. */
  averagePositions?: Record<string, number>;
  /** Fires with a club's id on row click — opens that club's own dossier
   *  (TeamPopup.tsx), the same cross-link every other club listing in the
   *  app already has. Omitted wherever the caller hasn't wired a popup up,
   *  in which case rows are plain, non-interactive text. */
  onSelectTeam?: (teamId: string) => void;
}

/**
 * A read-only ranked table — the review stage, the profile widget and any
 * other place a finished prediction is displayed rather than edited.
 *
 * Same hover boundary tint as the ranker and the intro's
 * ScoringExampleDiagram — it explains why a club did or didn't glow just as
 * well after the fact as it does while still ranking.
 */
export function RankingList({ ranking, correctness, averagePositions, onSelectTeam }: RankingListProps) {
  // TEAMS never changes at runtime, but this rebuilt the Map from scratch on
  // every render with no memoization at all — every award pick, every stage
  // transition upstream, anything.
  const teamsById = useMemo(
    () => new Map<string, (typeof TEAMS)[number]>(TEAMS.map((team) => [team.id, team])),
    []
  );
  const { activeIndex, handleMouseEnter, handleMouseLeave } = useBoundaryHover();

  return (
    <ol className="flex flex-col gap-2">
      {ranking.map((id, index) => {
        const team = teamsById.get(id);
        const isCorrect = correctness?.[id] ?? false;
        const isChampion = index === 0;
        const isRelegation = RELEGATION_POSITIONS.includes(index + 1);
        const average = averagePositions?.[id];
        const inBand = activeIndex !== null && boundaryBandRole(index, activeIndex, ranking.length) !== "none";
        const isOrigin = index === activeIndex;
        return (
          <li
            key={id}
            onClick={onSelectTeam ? () => onSelectTeam(id) : undefined}
            onMouseEnter={() => handleMouseEnter(index)}
            onMouseLeave={handleMouseLeave}
            className={cn(
              "flex items-center gap-3.5 rounded-lg border px-4 py-3 transition-[background-color,box-shadow] duration-500 ease-[var(--ease-cotton)]",
              onSelectTeam && "cursor-pointer hover:border-color_border1",
              isCorrect
                ? "border-color_green/50 bg-color_green/[0.08] shadow-[0_0_18px_var(--tw-shadow-color)] shadow-color_green/40"
                : isChampion
                  ? "border-color_champion/50 bg-color_champion/[0.07]"
                  : isRelegation
                    ? "border-color_remove/45 bg-color_remove/[0.07]"
                    : "border-color_border1/50 bg-background",
              inBand && cn("bg-foreground/[0.06]", !isOrigin && "animate-pulse")
            )}
          >
            <TeamCrest teamId={id} className="size-8 shrink-0" />
            <span className="min-w-0 flex-1 truncate font-display text-base text-color_text">
              {team?.name ?? id}
            </span>
            {average != null && (
              <span className="shrink-0 font-mono text-sm text-color_textsecondary tnum">
                {average.toFixed(1)}
              </span>
            )}
            <span className="w-7 shrink-0 text-right font-display text-xl font-bold text-color_gold tnum">
              {index + 1}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
