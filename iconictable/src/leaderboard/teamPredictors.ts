import { LeaderboardEntry } from "./leaderboardTypes";
import { TeamResult } from "./teamResultTypes";
import { isPickCorrect } from "./scoring";
import { assignRanks } from "./ranking";

export interface TeamPredictor {
  entry: LeaderboardEntry;
  /** Where this participant predicted the team would finish (1-based) —
   *  shown as this row's own number. */
  predictedPosition: number;
  /** Whether that pick is currently landing, by the same rule as everywhere
   *  else on the site (scoring.ts's `isPickCorrect`). False when the team
   *  has no result yet. */
  correct: boolean;
}

/**
 * The inverse of a participant's own predictions widget: for one team,
 * every participant who predicted it. Ordered by the participant's own
 * *overall* leaderboard standing, not by how bullish their pick was — Mert's
 * own framing: "the person first in the leaderboard is first here." Real
 * data throughout — each participant's full 36-team `ranking` already
 * exists, this just reads off where `teamId` sits in it and where that
 * participant sits on the real leaderboard (SPEC.md §8d's "who picked whom"
 * idea, applied to round 1's league-phase picks).
 */
export function getTeamPredictors(
  teamId: string,
  entries: LeaderboardEntry[],
  results: Record<string, TeamResult>
): TeamPredictor[] {
  const result = results[teamId];
  const rankByUid = new Map(assignRanks(entries).map((r) => [r.entry.uid, r.rank]));

  return entries
    .map((entry) => {
      const index = entry.ranking.indexOf(teamId);
      if (index === -1) return null;
      const predictedPosition = index + 1;
      const correct = result ? isPickCorrect(predictedPosition, result.position) : false;
      return { entry, predictedPosition, correct };
    })
    .filter((p): p is TeamPredictor => p !== null)
    .sort((a, b) => (rankByUid.get(a.entry.uid) ?? Infinity) - (rankByUid.get(b.entry.uid) ?? Infinity));
}
