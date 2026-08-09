import { TeamCrest } from "../leaderboard/TeamCrest";
import { Team } from "./teams";
import { BOUNDARY_SPAN } from "./predictionBoundary";
import { cn } from "@/lib/utils";

interface ScoringExampleDiagramProps {
  teams: Team[];
  centerIndex: number;
}

/**
 * The scoring band — the centred club plus everything still within
 * `BOUNDARY_SPAN` of it — sits just barely brighter than the page background
 * and pulses like a heartbeat, except the centred row itself, which stays
 * still so the club actually being explained doesn't compete for attention
 * with its own explanation. The outermost rows match the background exactly,
 * showing what's just *outside* the band.
 *
 * A static, one-time illustration of the off-by-one rule, distinct from the
 * ranker's own hover bracket (TeamDropList.tsx) which explains the same rule
 * live. Only the centred row shows a club (crest + name); every other row is
 * just its rank number — the point is the shape of the band, not who's in it.
 */
export function ScoringExampleDiagram({ teams, centerIndex }: ScoringExampleDiagramProps) {
  return (
    <div className="flex w-full max-w-xs flex-col gap-1.5">
      {teams.map((team, index) => {
        const inBand = Math.abs(index - centerIndex) <= BOUNDARY_SPAN;
        const isCenter = index === centerIndex;
        return (
          <div
            key={team.id}
            className={cn(
              "flex items-center gap-3 rounded-lg border px-3 py-2",
              inBand
                ? cn("border-color_border1 bg-foreground/[0.06]", !isCenter && "animate-pulse")
                : "border-color_border1/50 bg-background"
            )}
          >
            <span className="w-5 shrink-0 text-right font-mono text-sm font-bold text-color_gold tnum">
              {index + 1}
            </span>
            {isCenter && (
              <>
                <TeamCrest teamId={team.id} className="size-7 shrink-0" />
                <span className="min-w-0 flex-1 truncate font-display text-sm font-semibold text-color_text">
                  {team.name}
                </span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
